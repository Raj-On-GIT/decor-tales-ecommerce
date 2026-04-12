import hashlib
import hmac
import json
import logging
import os
from datetime import timedelta
from decimal import Decimal, ROUND_HALF_UP

import razorpay
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from accounts.models import Address
from products.models import Product, ProductVariant

from .models import (
    Cart,
    CartItem,
    Coupon,
    CouponUsage,
    Order,
    OrderItem,
    OrderItemImage,
    StockReservation,
)
from .views import (
    evaluate_coupon_for_cart,
    get_cart_line_items,
    get_coupon_queryset,
    get_product_price,
    resolve_cart_item_variant,
)

PAISE_MULTIPLIER = Decimal("100")
logger = logging.getLogger(__name__)


class PaymentError(Exception):
    pass


def get_razorpay_credentials():
    key_id = os.getenv("RAZORPAY_KEY_ID", "").strip()
    key_secret = os.getenv("RAZORPAY_KEY_SECRET", "").strip()

    if not key_id or not key_secret:
        raise ImproperlyConfigured(
            "RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be configured."
        )

    return key_id, key_secret


def get_razorpay_client():
    key_id, key_secret = get_razorpay_credentials()
    return razorpay.Client(auth=(key_id, key_secret))


def amount_to_paise(amount):
    return int((Decimal(amount) * PAISE_MULTIPLIER).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def _normalize_entity_identifier(value):
    return str(value).strip() if value is not None else ""


def validate_payment_entity_for_order(*, order, payment_entity):
    # SECURITY FIX: enforce backend-side trust by validating the fetched Razorpay
    # payment entity against the server-side order before marking anything paid.
    if not isinstance(payment_entity, dict):
        raise PaymentError("Unable to validate payment with provider.")

    payment_order_id = _normalize_entity_identifier(payment_entity.get("order_id"))
    if payment_order_id != _normalize_entity_identifier(order.razorpay_order_id):
        raise PaymentError("Payment order mismatch.")

    payment_status = _normalize_entity_identifier(payment_entity.get("status")).lower()
    if payment_status not in {"captured", "authorized"}:
        raise PaymentError("Payment has not been confirmed by the provider.")

    payment_amount = payment_entity.get("amount")
    if payment_amount is not None and int(payment_amount) != amount_to_paise(order.total_amount):
        raise PaymentError("Payment amount mismatch.")

    payment_notes = payment_entity.get("notes") or {}
    noted_order_id = _normalize_entity_identifier(payment_notes.get("order_id"))
    if noted_order_id and noted_order_id != str(order.id):
        raise PaymentError("Payment notes mismatch.")

    noted_user_id = _normalize_entity_identifier(payment_notes.get("user_id"))
    if noted_user_id and noted_user_id != str(order.user_id):
        raise PaymentError("Payment user mismatch.")

    return payment_entity


def get_checkout_cart_queryset(user, lock=False):
    cart = Cart.objects.filter(user=user).first()
    if not cart:
        return cart, CartItem.objects.none()

    queryset = CartItem.objects.select_related(
        "product",
        "product__category",
        "product__sub_category",
        "variant",
        "variant__size",
        "variant__color",
    ).prefetch_related("custom_images").filter(cart=cart)

    if lock:
        queryset = queryset.select_for_update()

    return cart, queryset


def get_reservation_expiry():
    return timezone.now() + timedelta(
        minutes=max(1, getattr(settings, "PAYMENT_RESERVATION_MINUTES", 15))
    )


def release_expired_reservations(*, now=None):
    now = now or timezone.now()
    return StockReservation.objects.filter(
        consumed_at__isnull=True,
        released_at__isnull=True,
        reserved_until__lt=now,
    ).update(released_at=now)


def get_active_reserved_quantity(*, product_id=None, variant_id=None):
    filters = {
        "consumed_at__isnull": True,
        "released_at__isnull": True,
        "reserved_until__gte": timezone.now(),
    }
    if variant_id is not None:
        filters["variant_id"] = variant_id
    else:
        filters["product_id"] = product_id
        filters["variant_id__isnull"] = True

    return (
        StockReservation.objects.filter(**filters).aggregate(total=Sum("quantity"))["total"]
        or 0
    )


def lock_stock_targets_for_items(items):
    product_ids = sorted(
        {
            item.product_id
            for item in items
            if item.product and not item.variant_id
        }
    )
    variant_ids = sorted({item.variant_id for item in items if item.variant_id})

    products_by_id = {
        product.id: product
        for product in Product.objects.select_for_update().filter(id__in=product_ids)
    }
    variants_by_id = {
        variant.id: variant
        for variant in ProductVariant.objects.select_for_update().filter(id__in=variant_ids)
    }
    return products_by_id, variants_by_id


def validate_cart_item_stock(cart_items):
    for item in cart_items:
        product = item.product
        variant = resolve_cart_item_variant(item, persist=True)

        if not product.is_active:
            raise PaymentError(f"{product.title} is no longer available.")

        # Variant was deleted (SET_NULL) but cart item survived — block checkout.
        if product.stock_type == "variants" and variant is None:
            raise PaymentError(
                f"A variant of {product.title} is no longer available. "
                "Please remove it from your cart before proceeding."
            )

        if product.stock_type == "variants":
            available_stock = variant.stock if variant else 0
        else:
            available_stock = product.stock

        if item.quantity > available_stock:
            raise PaymentError(
                f"{product.title} has only {available_stock} left in stock."
            )


def build_cart_pricing_snapshot(user, coupon_code=""):
    cart, cart_items = get_checkout_cart_queryset(user)
    cart_items = list(cart_items)

    if not cart or not cart_items:
        raise PaymentError("Cart is empty.")

    validate_cart_item_stock(cart_items)

    line_items = get_cart_line_items(cart_items)
    subtotal_amount = sum((item["line_total"] for item in line_items), Decimal("0.00"))
    discount_amount = Decimal("0.00")
    applied_coupon = None
    normalized_coupon_code = (coupon_code or "").strip().upper()

    if normalized_coupon_code:
        try:
            applied_coupon = get_coupon_queryset().get(code=normalized_coupon_code)
        except Coupon.DoesNotExist as exc:
            raise PaymentError("Coupon is invalid or unavailable.") from exc

        evaluation = evaluate_coupon_for_cart(applied_coupon, user, line_items)
        if not evaluation["eligible"]:
            raise PaymentError(
                evaluation["reason"] or "Coupon is not eligible for this cart."
            )
        discount_amount = evaluation["discount_amount"]

    total_amount = subtotal_amount - discount_amount

    return {
        "cart": cart,
        "cart_items": cart_items,
        "subtotal_amount": subtotal_amount,
        "discount_amount": discount_amount,
        "total_amount": total_amount,
        "applied_coupon": applied_coupon,
    }


def build_checkout_snapshot(user, address_id, coupon_code=""):
    snapshot = build_cart_pricing_snapshot(user, coupon_code)

    try:
        address = Address.objects.get(id=address_id, user=user)
    except Address.DoesNotExist as exc:
        raise PaymentError("Selected address was not found.") from exc

    snapshot["address"] = address
    return snapshot


def create_pending_order_from_cart(*, user, address_id, coupon_code=""):
    snapshot = build_checkout_snapshot(user, address_id, coupon_code)
    client = get_razorpay_client()
    key_id, _ = get_razorpay_credentials()

    with transaction.atomic():
        release_expired_reservations()
        products_by_id, variants_by_id = lock_stock_targets_for_items(snapshot["cart_items"])

        for item in snapshot["cart_items"]:
            product = item.product
            if product.stock_type == "variants":
                variant = variants_by_id.get(item.variant_id)
                available_stock = variant.stock if variant else 0
                reserved_stock = get_active_reserved_quantity(variant_id=item.variant_id)
            else:
                locked_product = products_by_id.get(item.product_id)
                available_stock = locked_product.stock if locked_product else 0
                reserved_stock = get_active_reserved_quantity(product_id=item.product_id)

            if item.quantity > max(0, available_stock - reserved_stock):
                raise PaymentError(
                    f"{product.title} no longer has enough stock to start payment."
                )

        order = Order.objects.create(
            user=user,
            subtotal_amount=snapshot["subtotal_amount"],
            discount_amount=snapshot["discount_amount"],
            total_amount=snapshot["total_amount"],
            coupon_code=snapshot["applied_coupon"].code if snapshot["applied_coupon"] else "",
            shipping_address=", ".join(
                filter(
                    None,
                    [
                        snapshot["address"].address_line_1,
                        snapshot["address"].address_line_2,
                    ],
                )
            ),
            city=snapshot["address"].city,
            postal_code=snapshot["address"].postal_code,
            phone=snapshot["address"].phone,
            status="pending",
        )

        for item in snapshot["cart_items"]:
            product = item.product
            variant = item.variant
            if product.stock_type == "variants":
                price = variant.slashed_price or variant.mrp or Decimal("0.00")
            else:
                price = get_product_price(product) or Decimal("0.00")

            order_item = OrderItem.objects.create(
                order=order,
                product=product,
                variant=variant,
                quantity=item.quantity,
                price=price,
                custom_text=item.custom_text,
                custom_image=item.custom_image if not item.custom_images.exists() else None,
            )
            order_item.capture_product_snapshot(product=product, variant=variant)
            order_item.save(update_fields=[
                "product_title",
                "product_slug",
                "product_image",
                "product_category_name",
                "product_category_slug",
                "product_sub_category_name",
                "product_sub_category_slug",
                "variant_size_name",
                "variant_color_name",
                "variant_sku",
            ])

            for image in item.custom_images.all():
                OrderItemImage.objects.create(order_item=order_item, image=image.image)

            StockReservation.objects.create(
                order=order,
                product=product if product.stock_type != "variants" else None,
                variant=variant if product.stock_type == "variants" else None,
                quantity=item.quantity,
                reserved_until=get_reservation_expiry(),
            )

        razorpay_order = client.order.create(
            {
                "amount": amount_to_paise(order.total_amount),
                "currency": "INR",
                "receipt": order.order_number,
                "payment_capture": 1,
                "notes": {
                    "order_id": str(order.id),
                    "order_number": order.order_number,
                    "user_id": str(user.id),
                },
            }
        )

        order.razorpay_order_id = razorpay_order["id"]
        order.save(update_fields=["razorpay_order_id", "updated_at"])

    return {
        "key_id": key_id,
        "order": order,
        "razorpay_order": razorpay_order,
    }


def verify_razorpay_signature(*, razorpay_order_id, razorpay_payment_id, razorpay_signature):
    _, key_secret = get_razorpay_credentials()
    message = f"{razorpay_order_id}|{razorpay_payment_id}".encode("utf-8")
    expected_signature = hmac.new(
        key_secret.encode("utf-8"),
        message,
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected_signature, razorpay_signature)


def lock_inventory_for_order(order):
    order_items = list(
        order.items.select_related("product", "variant").order_by("product_id", "variant_id", "id")
    )

    products_by_id, variants_by_id = lock_stock_targets_for_items(order_items)

    return order_items, products_by_id, variants_by_id


def deduct_stock_for_order(order):
    order_items, products_by_id, variants_by_id = lock_inventory_for_order(order)
    reservations = list(
        order.stock_reservations.select_for_update().filter(
            consumed_at__isnull=True,
            released_at__isnull=True,
        )
    )
    reservations_by_target = {}
    for reservation in reservations:
        key = ("variant", reservation.variant_id) if reservation.variant_id else ("product", reservation.product_id)
        reservations_by_target[key] = reservations_by_target.get(key, 0) + reservation.quantity

    for item in order_items:
        product = item.product
        if item.variant_id:
            variant = variants_by_id.get(item.variant_id)
            available_stock = variant.stock if variant else 0
            reserved_stock = reservations_by_target.get(("variant", item.variant_id), 0)
            if item.quantity > available_stock or reserved_stock < item.quantity:
                raise PaymentError(
                    f"{product.title} no longer has enough stock to complete payment."
                )
        else:
            locked_product = products_by_id.get(item.product_id)
            available_stock = locked_product.stock if locked_product else 0
            reserved_stock = reservations_by_target.get(("product", item.product_id), 0)
            if item.quantity > available_stock or reserved_stock < item.quantity:
                raise PaymentError(
                    f"{product.title} no longer has enough stock to complete payment."
                )

    for item in order_items:
        if item.variant_id:
            variant = variants_by_id[item.variant_id]
            variant.stock -= item.quantity
            variant.save(update_fields=["stock"])
        else:
            locked_product = products_by_id[item.product_id]
            locked_product.stock -= item.quantity
            locked_product.save(update_fields=["stock"])

    now = timezone.now()
    for reservation in reservations:
        reservation.consumed_at = now
        reservation.save(update_fields=["consumed_at"])


def release_order_reservations(order):
    order.stock_reservations.filter(
        consumed_at__isnull=True,
        released_at__isnull=True,
    ).update(released_at=timezone.now())


def clear_user_cart(user):
    cart = Cart.objects.filter(user=user).first()
    if cart:
        CartItem.objects.filter(cart=cart).delete()


def ensure_coupon_usage(order):
    if not order.coupon_code or order.discount_amount <= 0:
        return

    coupon = Coupon.objects.filter(code=order.coupon_code).first()
    if not coupon:
        return

    CouponUsage.objects.get_or_create(
        coupon=coupon,
        user=order.user,
        order=order,
        defaults={"discount_amount": order.discount_amount},
    )


def get_payment_entity_data(payload):
    payload_object = payload.get("payload", {}) if isinstance(payload, dict) else {}
    payment_entity = payload_object.get("payment", {}).get("entity", {}) or payload.get("payment", {}).get("entity", {})
    order_entity = payload_object.get("order", {}).get("entity", {}) or payload.get("order", {}).get("entity", {})
    return payment_entity, order_entity


def get_order_from_payment_event(payload):
    payment_entity, order_entity = get_payment_entity_data(payload)
    notes = payment_entity.get("notes") or order_entity.get("notes") or {}
    order_id = notes.get("order_id")
    razorpay_order_id = (
        payment_entity.get("order_id")
        or order_entity.get("id")
        or payload.get("razorpay_order_id")
    )

    queryset = Order.objects.select_for_update().select_related("user")

    if order_id:
        try:
            return queryset.get(id=order_id)
        except Order.DoesNotExist:
            pass

    if razorpay_order_id:
        try:
            return queryset.get(razorpay_order_id=razorpay_order_id)
        except Order.DoesNotExist:
            pass

    raise PaymentError("Order not found.")


def process_successful_payment(*, order, razorpay_order_id, razorpay_payment_id, razorpay_signature=""):
    if order.payment_processed or order.status == "paid":
        if razorpay_payment_id and not order.razorpay_payment_id:
            order.razorpay_payment_id = razorpay_payment_id
            order.save(update_fields=["razorpay_payment_id", "updated_at"])
        return order

    if order.razorpay_order_id != razorpay_order_id:
        raise PaymentError("Payment order mismatch.")

    if not order.items.exists():
        raise PaymentError("Order has no items to verify.")

    active_reservations_exist = order.stock_reservations.filter(
        consumed_at__isnull=True,
        released_at__isnull=True,
        reserved_until__gte=timezone.now(),
    ).exists()
    if not active_reservations_exist:
        raise PaymentError("Reservation expired before payment completion.")

    deduct_stock_for_order(order)

    order.status = "paid"
    order.payment_processed = True
    order.razorpay_payment_id = razorpay_payment_id
    if razorpay_signature:
        order.razorpay_signature = razorpay_signature
    order.payment_verified_at = timezone.now()
    order.save(
        update_fields=[
            "status",
            "payment_processed",
            "razorpay_payment_id",
            "razorpay_signature",
            "payment_verified_at",
            "updated_at",
        ]
    )

    ensure_coupon_usage(order)
    clear_user_cart(order.user)
    return order


def mark_order_payment_stock_conflict(*, order, reason):
    if order.payment_processed or order.status == "paid":
        return order

    release_order_reservations(order)
    order.status = "failed"
    order.save(update_fields=["status", "updated_at"])
    logger.error(
        "Payment stock conflict order_id=%s order_number=%s razorpay_order_id=%s reason=%s",
        order.id,
        order.order_number,
        order.razorpay_order_id or "",
        reason,
    )

    if order.payment_processed or order.refund_processed or not order.razorpay_payment_id:
        return order

    try:
        client = get_razorpay_client()
        client.payment.refund(order.razorpay_payment_id)
        order.refund_processed = True
        order.save(update_fields=["refund_processed", "updated_at"])
        logger.info(
            "Refund initiated for order_id=%s payment_id=%s",
            order.id,
            order.razorpay_payment_id,
        )
    except Exception as exc:
        logger.error(
            "Refund FAILED for order_id=%s payment_id=%s error=%s",
            order.id,
            order.razorpay_payment_id,
            str(exc),
        )

    return order


def process_captured_payment_with_stock_safety(*, order, razorpay_order_id, razorpay_payment_id):
    try:
        return process_successful_payment(
            order=order,
            razorpay_order_id=razorpay_order_id,
            razorpay_payment_id=razorpay_payment_id,
        )
    except PaymentError as exc:
        if razorpay_payment_id and not order.razorpay_payment_id:
            order.razorpay_payment_id = razorpay_payment_id
            order.save(update_fields=["razorpay_payment_id", "updated_at"])
        return mark_order_payment_stock_conflict(order=order, reason=str(exc))


def get_captured_payment_for_order(*, order, client=None):
    client = client or get_razorpay_client()

    if order.razorpay_payment_id:
        payment_response = client.payment.fetch(order.razorpay_payment_id)
        try:
            return validate_payment_entity_for_order(order=order, payment_entity=payment_response)
        except PaymentError:
            pass

    payments_response = client.order.payments(order.razorpay_order_id)
    payment_items = payments_response.get("items", []) if isinstance(payments_response, dict) else []
    for item in payment_items:
        try:
            return validate_payment_entity_for_order(order=order, payment_entity=item)
        except PaymentError:
            continue
    return None


def verify_razorpay_webhook_signature(*, body, signature):
    webhook_secret = getattr(settings, "RAZORPAY_WEBHOOK_SECRET", "").strip()
    if not webhook_secret:
        raise ImproperlyConfigured("RAZORPAY_WEBHOOK_SECRET must be configured.")

    expected_signature = hmac.new(
        webhook_secret.encode("utf-8"),
        body,
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected_signature, signature or "")


def process_razorpay_webhook(*, body, signature):
    if not verify_razorpay_webhook_signature(body=body, signature=signature):
        raise PaymentError("Webhook signature verification failed.")

    try:
        payload = json.loads(body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise PaymentError("Invalid webhook payload.") from exc

    event = payload.get("event") or ""
    if event not in {"payment.captured", "order.paid"}:
        logger.info("Ignoring Razorpay webhook event=%s", event)
        return {"ignored": True, "event": event}

    payload_object = payload.get("payload", {}) if isinstance(payload, dict) else {}
    if event == "order.paid":
        razorpay_order_id = payload_object.get("order", {}).get("entity", {}).get("id", "")
    else:
        razorpay_order_id = payload_object.get("payment", {}).get("entity", {}).get("order_id", "")

    logger.info("Processing Razorpay webhook event=%s razorpay_order_id=%s", event, razorpay_order_id or "")

    if not razorpay_order_id:
        raise PaymentError("Webhook payload missing razorpay_order_id.")

    with transaction.atomic():
        order = (
            Order.objects.select_for_update()
            .select_related("user")
            .filter(razorpay_order_id=razorpay_order_id)
            .first()
        )

        if not order:
            raise PaymentError("Order not found.")

        if order.payment_processed:
            logger.info(
                "Skipping Razorpay webhook event=%s razorpay_order_id=%s reason=already_processed",
                event,
                razorpay_order_id,
            )
            return {"ignored": False, "event": event, "order_id": order.id, "skipped": True}

        updated_order = reconcile_order_payment(order)

    logger.info(
        "Processed Razorpay webhook event=%s razorpay_order_id=%s updated=%s",
        event,
        razorpay_order_id,
        bool(updated_order.payment_processed),
    )

    return {
        "ignored": False,
        "event": event,
        "order_id": updated_order.id,
        "updated": bool(updated_order.payment_processed),
    }


def reconcile_order_payment(order):
    if order.payment_processed or not order.razorpay_order_id:
        return order

    client = get_razorpay_client()
    successful_payment = get_captured_payment_for_order(order=order, client=client)

    if not successful_payment:
        return order

    with transaction.atomic():
        locked_order = Order.objects.select_for_update().select_related("user").get(id=order.id)
        return process_captured_payment_with_stock_safety(
            order=locked_order,
            razorpay_order_id=locked_order.razorpay_order_id,
            razorpay_payment_id=successful_payment.get("id", ""),
        )


def reconcile_stale_orders(*, limit=50):
    queryset = Order.objects.filter(
        payment_processed=False,
        razorpay_order_id__isnull=False,
    ).exclude(razorpay_order_id="").filter(status__in=["pending", "failed"]).order_by("created_at")[:limit]

    reconciled = 0
    for order in queryset:
        try:
            updated_order = reconcile_order_payment(order)
        except PaymentError:
            continue

        if updated_order.payment_processed:
            reconciled += 1

    return reconciled


def verify_and_capture_payment(
    *,
    user,
    order_id,
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
):
    conflict_message = None
    client = get_razorpay_client()

    with transaction.atomic():
        try:
            order = (
                Order.objects.select_for_update()
                .select_related("user")
                .get(id=order_id, user=user)
            )
        except Order.DoesNotExist as exc:
            raise PaymentError("Order not found.") from exc

        if order.payment_processed or order.status == "paid":
            return order

        if order.razorpay_order_id != razorpay_order_id:
            raise PaymentError("Payment order mismatch.")

        if not verify_razorpay_signature(
            razorpay_order_id=razorpay_order_id,
            razorpay_payment_id=razorpay_payment_id,
            razorpay_signature=razorpay_signature,
        ):
            raise PaymentError("Payment signature verification failed.")

        # SECURITY FIX: fetch and validate the payment directly from Razorpay so
        # the backend never trusts client-submitted amount/order context alone.
        payment_response = client.payment.fetch(razorpay_payment_id)
        validate_payment_entity_for_order(order=order, payment_entity=payment_response)

        try:
            order = process_successful_payment(
                order=order,
                razorpay_order_id=razorpay_order_id,
                razorpay_payment_id=razorpay_payment_id,
                razorpay_signature=razorpay_signature,
            )
        except PaymentError as exc:
            if str(exc) in {
                "Reservation expired before payment completion.",
            } or "no longer has enough stock to complete payment." in str(exc):
                conflict_message = str(exc)
            else:
                raise

    if conflict_message:
        with transaction.atomic():
            order = (
                Order.objects.select_for_update()
                .select_related("user")
                .get(id=order_id, user=user)
            )
            if razorpay_payment_id and not order.razorpay_payment_id:
                order.razorpay_payment_id = razorpay_payment_id
                order.save(update_fields=["razorpay_payment_id", "updated_at"])

            mark_order_payment_stock_conflict(order=order, reason=conflict_message)
        raise PaymentError(conflict_message)

    return order


def mark_order_payment_failed(*, user, order_id, message=None):
    with transaction.atomic():
        try:
            order = Order.objects.select_for_update().get(id=order_id, user=user)
        except Order.DoesNotExist:
            raise PaymentError("Order not found.")

        if order.payment_processed or order.status == "paid":
            return message or "Payment already verified."

        release_expired_reservations()

        active_reservations_exist = order.stock_reservations.filter(
            consumed_at__isnull=True,
            released_at__isnull=True,
            reserved_until__gte=timezone.now(),
        ).exists()

        if not active_reservations_exist:
            release_order_reservations(order)
            order.status = "failed"
            order.save(update_fields=["status", "updated_at"])
            return message or "Payment failed."

    return message or "Payment status remains pending until server verification completes."
