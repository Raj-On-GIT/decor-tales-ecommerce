from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404

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

        # Determine stock
        available_stock = variant.stock if variant else product.stock

        # ONLY ONE get_or_create
        cart_item, created = CartItem.objects.get_or_create(
            cart=cart,
            product=product,
            variant=variant,
        )
        
        if created:
            new_quantity = quantity
        else:
            new_quantity = cart_item.quantity + quantity

        if new_quantity > available_stock:
            new_quantity = available_stock

        cart_item.quantity = new_quantity
        cart_item.save()

        price = (
            variant.slashed_price or variant.mrp
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
                        item.product.image.url
                        if item.product.image
                        else None
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
def create_order(request):
    try:
        cart = Cart.objects.filter(user=request.user).first()

        if not cart or not CartItem.objects.filter(cart=cart).exists():
            return Response({"error": "Cart is empty"}, status=400)

        shipping_address = request.data.get("shipping_address")
        city = request.data.get("city")
        postal_code = request.data.get("postal_code")
        phone = request.data.get("phone")

        if not all([shipping_address, city, postal_code, phone]):
            return Response({"error": "Missing shipping details"}, status=400)

        cart_items = CartItem.objects.filter(cart=cart).select_related("product")

        total_amount = sum(
            get_product_price(item.product) * item.quantity
            for item in cart_items
        )

        order = Order.objects.create(
            user=request.user,
            total_amount=total_amount,
            shipping_address=shipping_address,
            city=city,
            postal_code=postal_code,
            phone=phone,
            status="pending"
        )

        for cart_item in cart_items:
            OrderItem.objects.create(
                order=order,
                product=cart_item.product,
                quantity=cart_item.quantity,
                price=get_product_price(cart_item.product)
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
            "image": i.product.image.url if i.product.image else None,
        },
        "quantity": i.quantity,
        "price": str(i.price),
        "total": str(i.price * i.quantity)
    } for i in order.items.all()]

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

