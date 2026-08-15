from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from products.models import Product
from products.serializers import ProductSerializer

from .models import WishlistItem


def _parse_limit_offset(request, default_limit=20, max_limit=100):
    try:
        limit = int(request.GET.get("limit", default_limit))
    except (TypeError, ValueError):
        limit = default_limit
    limit = max(1, min(limit, max_limit))

    try:
        offset = max(0, int(request.GET.get("offset", 0)))
    except (TypeError, ValueError):
        offset = 0

    return limit, offset


def _serialize_wishlist_item(request, item):
    return {
        "id": item.id,
        "product": ProductSerializer(item.product, context={"request": request}).data,
        "created_at": item.created_at,
    }


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_wishlist(request):
    """GET /api/wishlist/ — current user's wishlist, paginated."""
    queryset = (
        WishlistItem.objects.filter(user=request.user)
        .select_related("product__category", "product__sub_category")
        .prefetch_related(
            "product__variants__size",
            "product__variants__color",
            "product__images",
        )
    )
    total_count = queryset.count()
    limit, offset = _parse_limit_offset(request)
    items = queryset[offset : offset + limit]

    return Response(
        {
            "items": [_serialize_wishlist_item(request, item) for item in items],
            "count": total_count,
            "limit": limit,
            "offset": offset,
            "has_more": offset + len(items) < total_count,
        }
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def toggle_wishlist(request):
    """POST /api/wishlist/toggle/ — idempotent add/remove for a product."""
    product_id = request.data.get("product_id")

    if product_id is None:
        return Response({"error": "product_id is required."}, status=400)

    try:
        product_id = int(product_id)
    except (TypeError, ValueError):
        return Response({"error": "product_id must be a valid integer."}, status=400)

    product = get_object_or_404(Product, pk=product_id)

    item = WishlistItem.objects.filter(user=request.user, product=product).first()
    if item:
        item.delete()
        return Response(
            {
                "in_wishlist": False,
                "wishlist_item_id": None,
                "product_id": product.id,
            }
        )

    item = WishlistItem.objects.create(user=request.user, product=product)
    return Response(
        {
            "in_wishlist": True,
            "wishlist_item_id": item.id,
            "product_id": product.id,
        },
        status=201,
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def add_to_wishlist(request):
    """POST /api/wishlist/add/ — idempotent add (used for login merge)."""
    product_id = request.data.get("product_id")

    if product_id is None:
        return Response({"error": "product_id is required."}, status=400)

    try:
        product_id = int(product_id)
    except (TypeError, ValueError):
        return Response({"error": "product_id must be a valid integer."}, status=400)

    product = get_object_or_404(Product, pk=product_id)

    item, created = WishlistItem.objects.get_or_create(
        user=request.user,
        product=product,
    )
    return Response(
        {
            "in_wishlist": True,
            "wishlist_item_id": item.id,
            "product_id": product.id,
        },
        status=201 if created else 200,
    )


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def remove_from_wishlist(request, item_id):
    """DELETE /api/wishlist/remove/<item_id>/ — owner scoped removal."""
    item = get_object_or_404(WishlistItem, pk=item_id, user=request.user)
    item.delete()
    return Response({"message": "Removed from wishlist."})
