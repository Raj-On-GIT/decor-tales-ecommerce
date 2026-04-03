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


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_payment_order(request):
    address_id = request.data.get("address_id")
    coupon_code = request.data.get("coupon_code", "")

    if not address_id:
        return Response({"error": "Address required."}, status=400)

    try:
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
    razorpay_order_id = request.data.get("razorpay_order_id")
    razorpay_payment_id = request.data.get("razorpay_payment_id")
    razorpay_signature = request.data.get("razorpay_signature")

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
        message = mark_order_payment_failed(
            user=request.user,
            order_id=order_id,
            message=request.data.get("message"),
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
        reconciled = reconcile_stale_orders(limit=int(request.data.get("limit", 50)))
    except ImproperlyConfigured as exc:
        return Response({"error": str(exc)}, status=500)
    except Exception:
        return Response({"error": "Unable to reconcile payments."}, status=500)

    return Response({"message": "Reconciliation completed.", "reconciled": reconciled})
