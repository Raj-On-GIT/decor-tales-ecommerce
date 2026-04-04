from django.core.exceptions import ImproperlyConfigured
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .payment_services import (
    PaymentError,
    create_pending_order_from_cart,
    mark_order_payment_failed,
    process_razorpay_webhook,
    reconcile_stale_orders,
    verify_and_capture_payment,
)


def _coerce_positive_int(value, *, field_name):
    # SECURITY FIX: reject malformed identifiers early to avoid relying on
    # implicit casting deeper in the payment flow.
    try:
        coerced = int(str(value).strip())
    except (TypeError, ValueError):
        raise PaymentError(f"{field_name} must be a valid integer.")

    if coerced <= 0:
        raise PaymentError(f"{field_name} must be a valid integer.")

    return coerced


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_payment_order(request):
    address_id = request.data.get("address_id")
    coupon_code = str(request.data.get("coupon_code", "") or "").strip()

    if not address_id:
        return Response({"error": "Address required."}, status=400)

    try:
        # SECURITY FIX: normalize and validate address input before touching the
        # checkout flow so tampered payloads fail fast with a 400.
        address_id = _coerce_positive_int(address_id, field_name="address_id")
        payment_payload = create_pending_order_from_cart(
            user=request.user,
            address_id=address_id,
            coupon_code=coupon_code,
        )
    except PaymentError as exc:
        return Response({"error": str(exc)}, status=400)
    except ImproperlyConfigured as exc:
        return Response({"error": str(exc)}, status=500)
    except Exception:
        return Response({"error": "Unable to initialize payment."}, status=500)

    order = payment_payload["order"]
    razorpay_order = payment_payload["razorpay_order"]

    return Response(
        {
            "message": "Payment order created.",
            "payment": {
                "key_id": payment_payload["key_id"],
                "currency": razorpay_order.get("currency", "INR"),
                "amount": razorpay_order["amount"],
                "razorpay_order_id": razorpay_order["id"],
            },
            "order": {
                "id": order.id,
                "order_number": order.order_number,
                "subtotal": str(order.subtotal_amount),
                "discount": str(order.discount_amount),
                "coupon_code": order.coupon_code,
                "total": str(order.total_amount),
                "status": order.status,
            },
        },
        status=201,
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def verify_payment(request):
    order_id = request.data.get("order_id")
    razorpay_order_id = str(request.data.get("razorpay_order_id", "") or "").strip()
    razorpay_payment_id = str(request.data.get("razorpay_payment_id", "") or "").strip()
    razorpay_signature = str(request.data.get("razorpay_signature", "") or "").strip()

    required_fields = {
        "order_id": order_id,
        "razorpay_order_id": razorpay_order_id,
        "razorpay_payment_id": razorpay_payment_id,
        "razorpay_signature": razorpay_signature,
    }
    missing_fields = [field for field, value in required_fields.items() if not value]
    if missing_fields:
        return Response(
            {"error": f"Missing required field(s): {', '.join(missing_fields)}."},
            status=400,
        )

    try:
        # SECURITY FIX: reject malformed order identifiers before verification.
        order_id = _coerce_positive_int(order_id, field_name="order_id")
        order = verify_and_capture_payment(
            user=request.user,
            order_id=order_id,
            razorpay_order_id=razorpay_order_id,
            razorpay_payment_id=razorpay_payment_id,
            razorpay_signature=razorpay_signature,
        )
    except PaymentError as exc:
        return Response({"error": str(exc)}, status=400)
    except ImproperlyConfigured as exc:
        return Response({"error": str(exc)}, status=500)
    except Exception:
        return Response({"error": "Unable to verify payment."}, status=500)

    return Response(
        {
            "message": "Payment verified.",
            "order": {
                "id": order.id,
                "order_number": order.order_number,
                "status": order.status,
                "total": str(order.total_amount),
            },
        }
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def mark_payment_failed(request):
    order_id = request.data.get("order_id")

    if not order_id:
        return Response({"error": "order_id is required."}, status=400)

    try:
        # SECURITY FIX: reject malformed order identifiers before state changes.
        order_id = _coerce_positive_int(order_id, field_name="order_id")
        message = mark_order_payment_failed(
            user=request.user,
            order_id=order_id,
            message=str(request.data.get("message", "") or "").strip(),
        )
    except PaymentError as exc:
        return Response({"error": str(exc)}, status=400)

    return Response({"message": message})


@api_view(["POST"])
@permission_classes([AllowAny])
def razorpay_webhook(request):
    try:
        result = process_razorpay_webhook(
            body=request.body,
            signature=request.headers.get("X-Razorpay-Signature", ""),
        )
    except PaymentError as exc:
        if "signature verification failed" in str(exc).lower():
            return Response({"error": str(exc)}, status=400)
        return Response({"message": "Webhook acknowledged.", "error": str(exc)}, status=200)
    except ImproperlyConfigured as exc:
        return Response({"error": str(exc)}, status=500)
    except Exception:
        return Response({"error": "Unable to process webhook."}, status=500)

    return Response({"message": "Webhook processed.", **result})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def reconcile_payments(request):
    try:
        # SECURITY FIX: reconciliation is an operational endpoint and should not
        # be callable by regular authenticated customers.
        if not request.user.is_staff:
            return Response({"error": "Forbidden."}, status=403)

        limit = request.data.get("limit", 50)
        reconciled = reconcile_stale_orders(limit=_coerce_positive_int(limit, field_name="limit"))
    except ImproperlyConfigured as exc:
        return Response({"error": str(exc)}, status=500)
    except Exception:
        return Response({"error": "Unable to reconcile payments."}, status=500)

    return Response({"message": "Reconciliation completed.", "reconciled": reconciled})
