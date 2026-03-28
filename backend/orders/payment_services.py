import hashlib
import hmac
import os
from decimal import Decimal, ROUND_HALF_UP

import razorpay
from django.core.exceptions import ImproperlyConfigured
from django.db import transaction
from django.utils import timezone

from accounts.models import Address
from products.models import Product, ProductVariant

from .models import Cart, CartItem, Coupon, CouponUsage, Order, OrderItem, OrderItemImage
from .views import evaluate_coupon_for_cart, get_cart_line_items, get_coupon_queryset, get_product_price

PAISE_MULTIPLIER = Decimal("100")


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


def validate_cart_item_stock(cart_items):
    for item in cart_items:
        product = item.product
        variant = item.variant

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

            for image in item.custom_images.all():
                OrderItemImage.objects.create(order_item=order_item, image=image.image)

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

    product_ids = sorted(
        {item.product_id for item in order_items if item.product and item.product.stock_type != "variants"}
    )
    variant_ids = sorted({item.variant_id for item in order_items if item.variant_id})

    products_by_id = {
        product.id: product
        for product in Product.objects.select_for_update().filter(id__in=product_ids)
    }
    variants_by_id = {
        variant.id: variant
        for variant in ProductVariant.objects.select_for_update().filter(id__in=variant_ids)
    }

    return order_items, products_by_id, variants_by_id


def deduct_stock_for_order(order):
    order_items, products_by_id, variants_by_id = lock_inventory_for_order(order)

    for item in order_items:
        product = item.product
        if product.stock_type == "variants":
            variant = variants_by_id.get(item.variant_id)
            available_stock = variant.stock if variant else 0
            if item.quantity > available_stock:
                raise PaymentError(
                    f"{product.title} no longer has enough stock to complete payment."
                )
        else:
            locked_product = products_by_id.get(item.product_id)
            available_stock = locked_product.stock if locked_product else 0
            if item.quantity > available_stock:
                raise PaymentError(
                    f"{product.title} no longer has enough stock to complete payment."
                )

    for item in order_items:
        product = item.product
        if product.stock_type == "variants":
            variant = variants_by_id[item.variant_id]
            variant.stock -= item.quantity
            variant.save(update_fields=["stock"])
        else:
            locked_product = products_by_id[item.product_id]
            locked_product.stock -= item.quantity
            locked_product.save(update_fields=["stock"])


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


def verify_and_capture_payment(
    *,
    user,
    order_id,
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
):
    with transaction.atomic():
        try:
            order = (
                Order.objects.select_for_update()
                .select_related("user")
                .get(id=order_id, user=user)
            )
        except Order.DoesNotExist as exc:
            raise PaymentError("Order not found.") from exc

        if order.status == "paid":
            return order

        if order.razorpay_order_id != razorpay_order_id:
            order.status = "failed"
            order.save(update_fields=["status", "updated_at"])
            raise PaymentError("Payment order mismatch.")

        if not verify_razorpay_signature(
            razorpay_order_id=razorpay_order_id,
            razorpay_payment_id=razorpay_payment_id,
            razorpay_signature=razorpay_signature,
        ):
            order.status = "failed"
            order.save(update_fields=["status", "updated_at"])
            raise PaymentError("Payment signature verification failed.")

        if not order.items.exists():
            order.status = "failed"
            order.save(update_fields=["status", "updated_at"])
            raise PaymentError("Order has no items to verify.")

        deduct_stock_for_order(order)

        order.status = "paid"
        order.razorpay_payment_id = razorpay_payment_id
        order.razorpay_signature = razorpay_signature
        order.payment_verified_at = timezone.now()
        order.save(
            update_fields=[
                "status",
                "razorpay_payment_id",
                "razorpay_signature",
                "payment_verified_at",
                "updated_at",
            ]
        )

        ensure_coupon_usage(order)
        clear_user_cart(order.user)

    return order


def mark_order_payment_failed(*, user, order_id, message=None):
    with transaction.atomic():
        try:
            order = Order.objects.select_for_update().get(id=order_id, user=user)
        except Order.DoesNotExist:
            raise PaymentError("Order not found.")

        if order.status != "paid":
            order.status = "failed"
            order.save(update_fields=["status", "updated_at"])

    return message or "Payment failed."
