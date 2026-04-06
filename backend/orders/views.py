from decimal import Decimal
import logging
import mimetypes

from django.conf import settings
from django.core.files.storage import default_storage
from django.http import FileResponse, Http404
from django.db import transaction
from django.db.models import F, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.urls import reverse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import (
    Cart,
    CartItem,
    CartItemImage,
    Coupon,
    CouponUsage,
    Order,
    OrderItem,
    OrderItemImage,
)
from .serializers import AddToCartSerializer
from products.models import Product, ProductVariant
from products.media_utils import build_media_url, normalize_media_name

logger = logging.getLogger(__name__)


def get_product_price(product):
    return product.slashed_price or product.mrp


def serialize_category_trail(product):
    return {
        "category": (
            {
                "name": product.category.name,
                "slug": product.category.slug,
            }
            if product.category
            else None
        ),
        "sub_category": (
            {
                "name": product.sub_category.name,
                "slug": product.sub_category.slug,
            }
            if product.sub_category
            else None
        ),
    }


def serialize_pricing(product, variant=None, effective_price=None):
    original_price = None
    sale_price = None
    discount_percent = None

    if variant:
        original_price = variant.mrp
        sale_price = variant.slashed_price or variant.mrp
        discount_percent = variant.discount_percent
    else:
        original_price = product.mrp
        sale_price = product.slashed_price or product.mrp
        discount_percent = product.discount_percent

    if effective_price is not None:
        sale_price = effective_price

    return {
        "price": str(sale_price or Decimal("0.00")),
        "mrp": str(original_price) if original_price is not None else None,
        "slashed_price": str(sale_price) if sale_price is not None else None,
        "discount_percent": discount_percent,
    }


def build_image_urls(request, image_objects):
    return [
        request.build_absolute_uri(build_media_url(image.image))
        for image in image_objects
        if image.image and build_media_url(image.image)
    ]


def get_custom_image_files(request):
    image_files = request.FILES.getlist("custom_images")

    if image_files:
        return image_files

    legacy_image = request.FILES.get("custom_image")
    return [legacy_image] if legacy_image else []


def get_first_error_message(errors):
    if isinstance(errors, list) and errors:
        return get_first_error_message(errors[0])

    if isinstance(errors, dict):
        if "non_field_errors" in errors:
            return get_first_error_message(errors["non_field_errors"])
        first_key = next(iter(errors), None)
        if first_key is not None:
            return get_first_error_message(errors[first_key])

    return str(errors)


def build_secure_order_media_url(request, file_field):
    normalized_name = normalize_media_name(getattr(file_field, "name", ""))
    if not normalized_name or not normalized_name.startswith("order_customizations/"):
        return build_media_url(file_field)

    secure_path = reverse("order_media", kwargs={"file_path": normalized_name})
    return request.build_absolute_uri(secure_path) if request else secure_path


def build_secure_order_image_urls(request, image_objects):
    return [
        build_secure_order_media_url(request, image.image)
        for image in image_objects
        if image.image and build_secure_order_media_url(request, image.image)
    ]


def get_order_owner_for_media(file_path):
    normalized_path = normalize_media_name(file_path)
    if not normalized_path.startswith("order_customizations/"):
        raise Http404("Unsupported media path.")

    order_item_image = (
        OrderItemImage.objects.select_related("order_item__order__user")
        .filter(image=normalized_path)
        .first()
    )
    if order_item_image:
        return order_item_image.order_item.order.user

    order_item = (
        OrderItem.objects.select_related("order__user")
        .filter(custom_image=normalized_path)
        .first()
    )
    if order_item:
        return order_item.order.user

    raise Http404("Media file not found.")


def _serve_order_media_response(request, file_path):
    normalized_path = normalize_media_name(file_path)
    owner = get_order_owner_for_media(normalized_path)

    if not (request.user.is_staff or owner.id == request.user.id):
        raise Http404("Media file not found.")

    if not default_storage.exists(normalized_path):
        raise Http404("Media file not found.")

    media_file = default_storage.open(normalized_path, "rb")
    content_type = mimetypes.guess_type(normalized_path)[0] or "application/octet-stream"
    response = FileResponse(media_file, content_type=content_type)
    response["Cache-Control"] = "private, max-age=300"
    return response


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def serve_order_media(request, file_path):
    return _serve_order_media_response(request, file_path)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def serve_order_media_direct(request, file_path):
    return _serve_order_media_response(
        request,
        f"order_customizations/{normalize_media_name(file_path)}",
    )


def get_coupon_queryset():
    now = timezone.now()
    return (
        Coupon.objects.filter(
            is_active=True,
            start_date__lte=now,
        )
        .filter(Q(end_date__isnull=True) | Q(end_date__gte=now))
        .prefetch_related("categories", "subcategories")
    )


def get_coupon_usage_queryset():
    return CouponUsage.objects.exclude(order__status__in=["cancelled", "failed"])


def get_coupon_description_lines(description):
    return [line.strip("•- \t") for line in (description or "").splitlines() if line.strip()]


def get_cart_line_items(cart_items):
    line_items = []

    for item in cart_items:
        product = item.product
        variant = item.variant

        if product.stock_type == "variants":
            price = variant.slashed_price or variant.mrp or Decimal("0.00")
        else:
            price = get_product_price(product) or Decimal("0.00")

        price = Decimal(price)
        line_items.append(
            {
                "item": item,
                "product": product,
                "variant": variant,
                "price": price,
                "line_total": price * item.quantity,
            }
        )

    return line_items


def get_coupon_eligible_subtotal(coupon, cart_items):
    category_ids = set(coupon.categories.values_list("id", flat=True))
    subcategory_ids = set(coupon.subcategories.values_list("id", flat=True))

    if not category_ids and not subcategory_ids:
        return sum((item["line_total"] for item in cart_items), Decimal("0.00"))

    eligible_total = Decimal("0.00")
    for item in cart_items:
        product = item["product"]
        if (
            product.category_id in category_ids
            or product.sub_category_id in subcategory_ids
        ):
            eligible_total += item["line_total"]

    return eligible_total


def evaluate_coupon_for_cart(coupon, user, cart_items):
    subtotal = sum((item["line_total"] for item in cart_items), Decimal("0.00"))
    eligible_subtotal = get_coupon_eligible_subtotal(coupon, cart_items)

    if not cart_items:
        return {
            "eligible": False,
            "reason": "Your cart is empty.",
            "eligible_subtotal": eligible_subtotal,
            "discount_amount": Decimal("0.00"),
            "subtotal": subtotal,
            "display_in_list": True,
        }

    usage_qs = get_coupon_usage_queryset().filter(coupon=coupon)

    if coupon.usage_limit is not None and usage_qs.count() >= coupon.usage_limit:
        return {
            "eligible": False,
            "reason": "This coupon has reached its usage limit.",
            "eligible_subtotal": eligible_subtotal,
            "discount_amount": Decimal("0.00"),
            "subtotal": subtotal,
            "display_in_list": False,
        }

    if (
        coupon.usage_limit_per_user is not None
        and usage_qs.filter(user=user).count() >= coupon.usage_limit_per_user
    ):
        return {
            "eligible": False,
            "reason": "You have already used this coupon the maximum number of times.",
            "eligible_subtotal": eligible_subtotal,
            "discount_amount": Decimal("0.00"),
            "subtotal": subtotal,
            "display_in_list": False,
        }

    if coupon.first_order_only and user.orders.exclude(status__in=["cancelled", "failed"]).exists():
        return {
            "eligible": False,
            "reason": "This coupon is only available on your first order.",
            "eligible_subtotal": eligible_subtotal,
            "discount_amount": Decimal("0.00"),
            "subtotal": subtotal,
            "display_in_list": False,
        }

    if eligible_subtotal <= 0:
        return {
            "eligible": False,
            "reason": "No items in your cart qualify for this coupon.",
            "eligible_subtotal": eligible_subtotal,
            "discount_amount": Decimal("0.00"),
            "subtotal": subtotal,
            "display_in_list": True,
        }

    if coupon.min_order_amount and eligible_subtotal < coupon.min_order_amount:
        shortfall = coupon.min_order_amount - eligible_subtotal
        return {
            "eligible": False,
            "reason": f"Add Rs {shortfall:.2f} more in eligible items to use this coupon.",
            "eligible_subtotal": eligible_subtotal,
            "discount_amount": Decimal("0.00"),
            "subtotal": subtotal,
            "display_in_list": True,
        }

    if coupon.discount_type == Coupon.TYPE_PERCENT:
        discount_amount = (eligible_subtotal * coupon.discount_value) / Decimal("100")
    else:
        discount_amount = coupon.discount_value

    if coupon.max_discount_amount is not None:
        discount_amount = min(discount_amount, coupon.max_discount_amount)

    discount_amount = min(discount_amount, eligible_subtotal).quantize(
        Decimal("0.01")
    )

    return {
        "eligible": discount_amount > 0,
        "reason": "" if discount_amount > 0 else "This coupon is not eligible for this cart.",
        "eligible_subtotal": eligible_subtotal,
        "discount_amount": discount_amount,
        "subtotal": subtotal,
        "display_in_list": True,
    }


def serialize_coupon(coupon, evaluation):
    description_lines = get_coupon_description_lines(coupon.description)
    return {
        "code": coupon.code,
        "title": coupon.title,
        "description": coupon.description,
        "description_lines": description_lines,
        "discount_type": coupon.discount_type,
        "discount_value": str(coupon.discount_value),
        "min_order_amount": str(coupon.min_order_amount),
        "max_discount_amount": (
            str(coupon.max_discount_amount)
            if coupon.max_discount_amount is not None
            else None
        ),
        "first_order_only": coupon.first_order_only,
        "eligible": evaluation["eligible"],
        "reason": evaluation["reason"],
        "eligible_subtotal": str(evaluation["eligible_subtotal"]),
        "discount_amount": str(evaluation["discount_amount"]),
    }


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def add_to_cart(request):
    try:
        try:
            quantity = int(request.data.get("quantity", 1))
        except (TypeError, ValueError):
            return Response({"error": "Quantity must be a valid integer."}, status=400)

        if quantity < 1:
            return Response({"error": "Quantity must be at least 1."}, status=400)

        serializer = AddToCartSerializer(
            data={
                "product_id": request.data.get("product_id"),
                "quantity": quantity,
                "variant_id": request.data.get("variant_id"),
                "custom_text": request.data.get("custom_text"),
                "custom_images": get_custom_image_files(request),
            }
        )
        if not serializer.is_valid():
            return Response(
                {"error": get_first_error_message(serializer.errors)},
                status=400,
            )

        product = serializer.validated_data["product"]
        cart, _ = Cart.objects.get_or_create(user=request.user)
        variant = serializer.validated_data["variant"]
        custom_text = serializer.validated_data["custom_text"]
        custom_images = serializer.validated_data["custom_images"]

        available_stock = variant.stock if variant else product.stock

        if custom_text is None and not custom_images:
            cart_item = (
                CartItem.objects.filter(
                    cart=cart,
                    product=product,
                    variant=variant,
                    custom_images__isnull=True,
                )
                .filter(Q(custom_text__isnull=True) | Q(custom_text=""))
                .filter(Q(custom_image__isnull=True) | Q(custom_image=""))
                .first()
            )

            if cart_item:
                CartItem.objects.filter(id=cart_item.id).update(
                    quantity=F("quantity") + quantity
                )
                cart_item.refresh_from_db()

                if cart_item.quantity > available_stock:
                    cart_item.quantity = available_stock
                    cart_item.save()
            else:
                if quantity > available_stock:
                    quantity = available_stock

                cart_item = CartItem.objects.create(
                    cart=cart,
                    product=product,
                    variant=variant,
                    quantity=quantity,
                    custom_text=None,
                    custom_image=None,
                )
        else:
            if quantity > available_stock:
                quantity = available_stock

            cart_item = CartItem.objects.create(
                cart=cart,
                product=product,
                variant=variant,
                quantity=quantity,
                custom_text=custom_text,
                custom_image=None,
            )

            for image_file in custom_images:
                CartItemImage.objects.create(cart_item=cart_item, image=image_file)

        price = (
            variant.slashed_price or variant.mrp or get_product_price(product)
            if variant
            else get_product_price(product)
        )

        return Response(
            {
                "message": "Product added to cart",
                "cart_item": {
                    "id": cart_item.id,
                    "quantity": cart_item.quantity,
                    "total": str(cart_item.quantity * price),
                },
            },
            status=201,
        )

    except Exception as e:
        logger.exception(
            "cart_add_failed user_id=%s product_id=%s variant_id=%s",
            getattr(request.user, "id", None),
            request.data.get("product_id"),
            request.data.get("variant_id"),
        )
        return Response({"error": str(e)}, status=400)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_cart(request):
    try:
        cart = Cart.objects.filter(user=request.user).first()

        if not cart:
            return Response({"items": [], "total": "0.00", "count": 0})

        cart_items = (
            CartItem.objects.filter(cart=cart)
            .select_related("product", "variant", "variant__size", "variant__color")
            .prefetch_related("custom_images")
        )

        items = []
        total = 0

        for item in cart_items:
            if item.variant:
                price = item.variant.slashed_price or item.variant.mrp or 0
            else:
                price = get_product_price(item.product) or 0

            price = float(price)
            item_total = price * item.quantity
            total += item_total

            items.append(
                {
                    "id": item.id,
                    "product": {
                        "id": item.product.id,
                        "title": item.product.title,
                        "slug": item.product.slug,
                        "image": (
                            request.build_absolute_uri(build_media_url(item.product.image))
                            if item.product.image
                            else None
                        ),
                        "stock": item.product.stock,
                        "stock_type": item.product.stock_type,
                        "allow_custom_text": item.product.allow_custom_text,
                        "allow_custom_image": item.product.allow_custom_image,
                        **serialize_category_trail(item.product),
                        **serialize_pricing(item.product, item.variant, Decimal(str(price))),
                    },
                    "variant": (
                        {
                            "id": item.variant.id,
                            "size_name": item.variant.size.name if item.variant.size else None,
                            "color_name": item.variant.color.name if item.variant.color else None,
                            "stock": item.variant.stock,
                            "mrp": str(item.variant.mrp) if item.variant.mrp is not None else None,
                            "slashed_price": (
                                str(item.variant.slashed_price)
                                if item.variant.slashed_price is not None
                                else None
                            ),
                            "discount_percent": item.variant.discount_percent,
                        }
                        if item.variant
                        else None
                    ),
                    "quantity": item.quantity,
                    "custom_text": item.custom_text,
                    "custom_images": build_secure_order_image_urls(request, item.custom_images.all()),
                    "custom_image": (
                        build_secure_order_media_url(request, item.custom_image)
                        if item.custom_image
                        else (
                            build_secure_order_media_url(request, item.custom_images.first().image)
                            if item.custom_images.exists()
                            else None
                        )
                    ),
                }
            )

        return Response({"items": items, "total": str(total), "count": len(items)})

    except Exception as e:
        logger.exception(
            "cart_get_failed user_id=%s",
            getattr(request.user, "id", None),
        )
        return Response({"error": str(e)}, status=400)


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def remove_from_cart(request, item_id):
    cart = Cart.objects.filter(user=request.user).first()

    if not cart:
        return Response({"error": "Cart not found"}, status=404)

    cart_item = get_object_or_404(CartItem, id=item_id, cart=cart)
    cart_item.delete()

    return Response({"message": "Item removed"})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def update_cart_item(request, item_id):
    quantity = int(request.data.get("quantity", 1))

    if quantity < 1:
        return Response({"error": "Invalid quantity"}, status=400)

    cart = Cart.objects.filter(user=request.user).first()
    if not cart:
        return Response({"error": "Cart not found"}, status=404)

    cart_item = get_object_or_404(CartItem, id=item_id, cart=cart)

    available_stock = cart_item.variant.stock if cart_item.variant else cart_item.product.stock

    if quantity > available_stock:
        return Response(
            {"error": f"Only {available_stock} items available in stock."},
            status=400,
        )

    cart_item.quantity = quantity
    cart_item.save()

    if cart_item.variant:
        price = cart_item.variant.slashed_price or cart_item.variant.mrp
    else:
        price = get_product_price(cart_item.product)

    return Response(
        {
            "message": "Cart updated",
            "cart_item": {
                "id": cart_item.id,
                "quantity": cart_item.quantity,
                "total": str(cart_item.quantity * price),
            },
        }
    )


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def clear_cart(request):
    cart = Cart.objects.filter(user=request.user).first()

    if cart:
        CartItem.objects.filter(cart=cart).delete()

    return Response({"message": "Cart cleared"})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_available_coupons(request):
    cart = Cart.objects.filter(user=request.user).first()
    cart_items = []

    if cart:
        cart_items = list(
            CartItem.objects.select_related(
                "product",
                "product__category",
                "product__sub_category",
                "variant",
            ).filter(cart=cart)
        )

    line_items = get_cart_line_items(cart_items)
    coupons = []
    for coupon in get_coupon_queryset():
        evaluation = evaluate_coupon_for_cart(coupon, request.user, line_items)
        if not evaluation["display_in_list"]:
            continue
        coupons.append(serialize_coupon(coupon, evaluation))

    return Response({"coupons": coupons})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@transaction.atomic
def create_order(request):
    try:
        from .payment_services import release_expired_reservations

        if not getattr(settings, "ALLOW_LEGACY_DIRECT_ORDER", False):
            return Response(
                {
                    "error": "Direct order creation is disabled for safety. Use the payment order flow instead."
                },
                status=400,
            )

        release_expired_reservations()
        cart = Cart.objects.filter(user=request.user).first()

        if not cart or not CartItem.objects.filter(cart=cart).exists():
            return Response({"error": "Cart is empty"}, status=400)

        address_id = request.data.get("address_id")

        if not address_id:
            return Response({"error": "Address required"}, status=400)

        from accounts.models import Address

        address = get_object_or_404(Address, id=address_id, user=request.user)

        cart_items = CartItem.objects.select_related(
            "product",
            "product__category",
            "product__sub_category",
            "variant",
        ).prefetch_related("custom_images").filter(cart=cart)

        subtotal_amount = Decimal("0.00")
        discount_amount = Decimal("0.00")
        applied_coupon = None

        for item in cart_items:
            product = item.product
            variant = item.variant

            if product.stock_type == "variants":
                available_stock = variant.stock if variant else 0
                price = variant.slashed_price or variant.mrp
            else:
                available_stock = product.stock
                price = get_product_price(product)

            if item.quantity > available_stock:
                return Response(
                    {"error": f"{product.title} has only {available_stock} left in stock."},
                    status=400,
                )

            subtotal_amount += Decimal(price) * item.quantity

        coupon_code = (request.data.get("coupon_code") or "").strip().upper()

        if coupon_code:
            try:
                applied_coupon = get_coupon_queryset().get(code=coupon_code)
            except Coupon.DoesNotExist:
                return Response({"error": "Coupon is invalid or unavailable."}, status=400)

            evaluation = evaluate_coupon_for_cart(
                applied_coupon,
                request.user,
                get_cart_line_items(cart_items),
            )

            if not evaluation["eligible"]:
                return Response(
                    {"error": evaluation["reason"] or "Coupon is not eligible for this cart."},
                    status=400,
                )

            discount_amount = evaluation["discount_amount"]

        total_amount = subtotal_amount - discount_amount

        order = Order.objects.create(
            user=request.user,
            subtotal_amount=subtotal_amount,
            discount_amount=discount_amount,
            total_amount=total_amount,
            coupon_code=applied_coupon.code if applied_coupon else "",
            shipping_address=f"{address.address_line_1}, {address.address_line_2}",
            city=address.city,
            postal_code=address.postal_code,
            phone=address.phone,
            status="pending",
        )

        for item in cart_items:
            product = item.product
            variant = item.variant

            if product.stock_type == "variants":
                price = variant.slashed_price or variant.mrp
            else:
                price = get_product_price(product)

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

            if product.stock_type == "variants":
                ProductVariant.objects.filter(id=variant.id).update(
                    stock=F("stock") - item.quantity
                )
            else:
                Product.objects.filter(id=product.id).update(
                    stock=F("stock") - item.quantity
                )

        if applied_coupon and discount_amount > 0:
            CouponUsage.objects.create(
                coupon=applied_coupon,
                user=request.user,
                order=order,
                discount_amount=discount_amount,
            )

        cart_items.delete()

        return Response(
            {
                "message": "Order created",
                "order": {
                    "id": order.id,
                    "order_number": str(order.order_number),
                    "subtotal": str(order.subtotal_amount),
                    "discount": str(order.discount_amount),
                    "coupon_code": order.coupon_code,
                    "total": str(order.total_amount),
                    "status": order.status,
                    "created_at": order.created_at,
                },
            },
            status=201,
        )

    except Exception as e:
        return Response({"error": str(e)}, status=400)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_my_orders(request):
    orders = Order.objects.filter(user=request.user).order_by("-created_at")

    data = [
        {
                "id": order.id,
                "order_number": str(order.order_number),
                "subtotal": str(order.subtotal_amount),
                "discount": str(order.discount_amount),
                "coupon_code": order.coupon_code,
                "total": str(order.total_amount),
                "status": order.status,
                "created_at": order.created_at,
                "items_count": order.items.count(),
                "items": [
                    {
                        "product": {
                            "id": item.product.id,
                            "title": item.product.title,
                            "slug": item.product.slug,
                            "image": (
                                request.build_absolute_uri(build_media_url(item.product.image))
                                if item.product.image
                                else None
                            ),
                            **serialize_category_trail(item.product),
                            **serialize_pricing(item.product, item.variant, item.price),
                        },
                        "variant": (
                            {
                                "size_name": item.variant.size.name if item.variant and item.variant.size else None,
                                "color_name": item.variant.color.name if item.variant and item.variant.color else None,
                                "mrp": str(item.variant.mrp) if item.variant and item.variant.mrp is not None else None,
                                "slashed_price": (
                                    str(item.variant.slashed_price)
                                    if item.variant and item.variant.slashed_price is not None
                                    else None
                                ),
                                "discount_percent": item.variant.discount_percent if item.variant else None,
                            }
                            if item.variant
                            else None
                        ),
                        "quantity": item.quantity,
                    }
                    for item in order.items.select_related(
                        "product",
                        "product__category",
                        "product__sub_category",
                        "variant",
                        "variant__size",
                        "variant__color",
                    )
                ],
        }
        for order in orders
    ]

    return Response({"orders": data, "count": len(data)})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_order_detail(request, order_id):
    order = get_object_or_404(Order, id=order_id, user=request.user)

    items = [
        {
            "product": {
                "id": item.product.id,
                "title": item.product.title,
                "image": (
                    request.build_absolute_uri(build_media_url(item.product.image))
                    if item.product.image
                    else None
                ),
                "slug": item.product.slug,
                **serialize_category_trail(item.product),
                **serialize_pricing(item.product, item.variant, item.price),
            },
            "variant": (
                {
                    "size_name": item.variant.size.name if item.variant and item.variant.size else None,
                    "color_name": item.variant.color.name if item.variant and item.variant.color else None,
                    "mrp": str(item.variant.mrp) if item.variant and item.variant.mrp is not None else None,
                    "slashed_price": (
                        str(item.variant.slashed_price)
                        if item.variant and item.variant.slashed_price is not None
                        else None
                    ),
                    "discount_percent": item.variant.discount_percent if item.variant else None,
                }
                if item.variant
                else None
            ),
            "quantity": item.quantity,
            "price": str(item.price),
            "total": str(item.price * item.quantity),
            "custom_text": item.custom_text,
            "custom_images": build_secure_order_image_urls(request, item.custom_images.all()),
            "custom_image": (
                build_secure_order_media_url(request, item.custom_image)
                if item.custom_image
                else (
                    build_secure_order_media_url(request, item.custom_images.first().image)
                    if item.custom_images.exists()
                    else None
                )
            ),
        }
        for item in order.items.select_related(
            "product",
            "product__category",
            "product__sub_category",
            "variant",
            "variant__size",
            "variant__color",
        ).prefetch_related("custom_images")
    ]

    return Response(
        {
            "order": {
                "id": order.id,
                "order_number": str(order.order_number),
                "subtotal": str(order.subtotal_amount),
                "discount": str(order.discount_amount),
                "coupon_code": order.coupon_code,
                "total": str(order.total_amount),
                "status": order.status,
                "created_at": order.created_at,
                "shipping_address": order.shipping_address,
                "city": order.city,
                "postal_code": order.postal_code,
                "phone": order.phone,
                "items": items,
            }
        }
    )
