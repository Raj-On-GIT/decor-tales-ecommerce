from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404
from django.db.models import F,Q
from django.db import transaction

from .models import Order, Cart, CartItem, OrderItem
from products.models import Product, ProductVariant


# ============================================================================
# HELPER
# ============================================================================

def get_product_price(product):
    """
    Returns effective price considering discount.
    """
    return product.slashed_price or product.mrp


# ============================================================================
# CART APIs (PROTECTED)
# ============================================================================

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def add_to_cart(request):
    try:
        product_id = request.data.get("product_id")
        quantity = int(request.data.get("quantity", 1))

        product = get_object_or_404(Product, id=product_id)
        cart, _ = Cart.objects.get_or_create(user=request.user)

        variant_id = request.data.get("variant_id")
        variant = None

        if variant_id:
            variant = get_object_or_404(ProductVariant, id=variant_id)

        custom_text = request.data.get("custom_text")
        custom_image = request.FILES.get("custom_image")

        # normalize empty values
        if custom_text == "":
            custom_text = None

        # --------------------------------------------------
        # VALIDATE CUSTOMIZATION PERMISSIONS
        # --------------------------------------------------

        if custom_image and not product.allow_custom_image:
            return Response(
                {"error": "This product does not allow image customization."},
                status=400
            )

        if custom_text and not product.allow_custom_text:
            return Response(
                {"error": "This product does not allow text customization."},
                status=400
            )

        # --------------------------------------------------
        # DETERMINE AVAILABLE STOCK
        # --------------------------------------------------

        available_stock = variant.stock if variant else product.stock

        # --------------------------------------------------
        # NORMAL PRODUCT (NO CUSTOMIZATION)
        # Merge quantities
        # --------------------------------------------------

        if custom_text is None and custom_image is None:

            cart_item = CartItem.objects.filter(
                cart=cart,
                product=product,
                variant=variant
            ).filter(
                Q(custom_text__isnull=True) | Q(custom_text="")
            ).filter(
                Q(custom_image__isnull=True) | Q(custom_image="")
            ).first()


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
                    custom_image=None
                )

        # --------------------------------------------------
        # CUSTOMIZED PRODUCT
        # Always create a new cart item
        # --------------------------------------------------

        else:

            if quantity > available_stock:
                quantity = available_stock

            cart_item = CartItem.objects.create(
                cart=cart,
                product=product,
                variant=variant,
                quantity=quantity,
                custom_text=custom_text,
                custom_image=custom_image
            )

        # --------------------------------------------------
        # PRICE CALCULATION
        # --------------------------------------------------

        price = (
            variant.slashed_price
            or variant.mrp
            or get_product_price(product)
            if variant
            else get_product_price(product)
        )

        return Response({
            "message": "Product added to cart",
            "cart_item": {
                "id": cart_item.id,
                "quantity": cart_item.quantity,
                "total": str(cart_item.quantity * price)
            }
        }, status=201)

    except Exception as e:
        print("ADD TO CART ERROR:", str(e))
        return Response({"error": str(e)}, status=400)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_cart(request):
    try:
        cart = Cart.objects.filter(user=request.user).first()

        if not cart:
            return Response({
                "items": [],
                "total": "0.00",
                "count": 0
            })

        cart_items = (
            CartItem.objects
            .filter(cart=cart)
            .select_related("product", "variant", "variant__size", "variant__color")
        )

        items = []
        total = 0

        for item in cart_items:

            # ✅ Variant-aware safe pricing
            if item.variant:
                price = (
                    item.variant.slashed_price
                    or item.variant.mrp
                    or 0
                )
            else:
                price = get_product_price(item.product) or 0

            price = float(price)
            item_total = price * item.quantity
            total += item_total

            items.append({
                "id": item.id,

                "product": {
                    "id": item.product.id,
                    "title": item.product.title,
                    "price": str(price),

                    "image": (
                        request.build_absolute_uri(item.product.image.url)
                        if item.product.image else None
                    ),

                    "category": {
                        "name": item.product.category.name,
                        "slug": item.product.category.slug,
                    } if item.product.category else None,

                    "stock": item.product.stock,
                    "stock_type": item.product.stock_type,
                },

                "variant": {
                    "id": item.variant.id,
                    "size_name": item.variant.size.name if item.variant.size else None,
                    "color_name": item.variant.color.name if item.variant.color else None,
                    "stock": item.variant.stock,
                } if item.variant else None,

                "quantity": item.quantity,

                "custom_text": item.custom_text,
                "custom_image": (
                    request.build_absolute_uri(item.custom_image.url)
                    if item.custom_image else None
                ),
            })

        return Response({
            "items": items,
            "total": str(total),
            "count": len(items)
        })

    except Exception as e:
        print("GET CART ERROR:", str(e))
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

    # 🔥 Enforce stock limit
    if cart_item.variant:
        available_stock = cart_item.variant.stock
    else:
        available_stock = cart_item.product.stock

    if quantity > available_stock:
        return Response({
            "error": f"Only {available_stock} items available in stock."
        }, status=400)

    cart_item.quantity = quantity
    cart_item.save()

    # 🔥 Correct price handling
    if cart_item.variant:
        price = cart_item.variant.slashed_price or cart_item.variant.mrp
    else:
        price = get_product_price(cart_item.product)

    return Response({
        "message": "Cart updated",
        "cart_item": {
            "id": cart_item.id,
            "quantity": cart_item.quantity,
            "total": str(cart_item.quantity * price)
        }
    })

@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def clear_cart(request):
    cart = Cart.objects.filter(user=request.user).first()

    if cart:
        CartItem.objects.filter(cart=cart).delete()

    return Response({"message": "Cart cleared"})


# ============================================================================
# ORDER APIs (PROTECTED)
# ============================================================================

@api_view(["POST"])
@permission_classes([IsAuthenticated])
@transaction.atomic
def create_order(request):
    try:
        cart = Cart.objects.filter(user=request.user).first()

        if not cart or not CartItem.objects.filter(cart=cart).exists():
            return Response({"error": "Cart is empty"}, status=400)

        address_id = request.data.get("address_id")

        if not address_id:
            return Response({"error": "Address required"}, status=400)

        from accounts.models import Address
        address = get_object_or_404(Address, id=address_id, user=request.user)

        cart_items = CartItem.objects.select_related(
            "product", "variant"
        ).filter(cart=cart)

        total_amount = 0

        # 🔥 STOCK VALIDATION + PRICE CALCULATION
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
                return Response({
                    "error": f"{product.title} has only {available_stock} left in stock."
                }, status=400)

            total_amount += price * item.quantity

        # ✅ Create Order
        order = Order.objects.create(
            user=request.user,
            total_amount=total_amount,
            shipping_address=f"{address.address_line_1}, {address.address_line_2}",
            city=address.city,
            postal_code=address.postal_code,
            phone=address.phone,
            status="pending"
        )

        # 🔥 Create Order Items + Reduce Stock
        for item in cart_items:

            product = item.product
            variant = item.variant

            if product.stock_type == "variants":
                price = variant.slashed_price or variant.mrp
            else:
                price = get_product_price(product)

            # ✅ Save variant in OrderItem
            OrderItem.objects.create(
                order=order,
                product=product,
                variant=variant,
                quantity=item.quantity,
                price=price,
                custom_text=item.custom_text,
                custom_image=item.custom_image
            )

            # 🔥 Reduce correct stock
            if product.stock_type == "variants":
                ProductVariant.objects.filter(id=variant.id).update(
                    stock=F("stock") - item.quantity
                )
            else:
                Product.objects.filter(id=product.id).update(
                    stock=F("stock") - item.quantity
                )

        cart_items.delete()

        return Response({
            "message": "Order created",
            "order": {
                "id": order.id,
                "order_number": str(order.order_number),
                "total": str(order.total_amount),
                "status": order.status,
                "created_at": order.created_at
            }
        }, status=201)

    except Exception as e:
        return Response({"error": str(e)}, status=400)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_my_orders(request):
    orders = Order.objects.filter(user=request.user).order_by("-created_at")

    data = [{
        "id": o.id,
        "order_number": str(o.order_number),
        "total": str(o.total_amount),
        "status": o.status,
        "created_at": o.created_at,
        "items_count": o.items.count()
    } for o in orders]

    return Response({"orders": data, "count": len(data)})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_order_detail(request, order_id):
    order = get_object_or_404(Order, id=order_id, user=request.user)

    items = [{
        "product": {
            "id": i.product.id,
            "title": i.product.title,
            "image": (
                request.build_absolute_uri(i.product.image.url)
                if i.product.image else None
            ),
            "category": {
                "name": i.product.category.name,
            } if i.product.category else None,
        },

        "variant": {
            "size_name": i.variant.size.name if i.variant and i.variant.size else None,
            "color_name": i.variant.color.name if i.variant and i.variant.color else None,
        } if i.variant else None,

        "quantity": i.quantity,
        "price": str(i.price),
        "total": str(i.price * i.quantity),

        # Customization fields
        "custom_text": i.custom_text,

        "custom_image": (
            request.build_absolute_uri(i.custom_image.url)
            if i.custom_image else None
        )

    } for i in order.items.select_related(
        "product",
        "product__category",
        "variant",
        "variant__size",
        "variant__color"
    )]

    return Response({
        "order": {
            "id": order.id,
            "order_number": str(order.order_number),
            "total": str(order.total_amount),
            "status": order.status,
            "created_at": order.created_at,
            "shipping_address": order.shipping_address,
            "city": order.city,
            "postal_code": order.postal_code,
            "phone": order.phone,
            "items": items
        }
    })