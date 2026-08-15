from django.core.cache import cache
from django.db.models import Count
from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from products.models import Product

from .models import ProductReview
from .serializers import (
    ProductReviewSerializer,
    ProductReviewWithProductSerializer,
    ProductReviewWriteSerializer,
)
from .services import (
    get_eligible_order_item,
    get_review_cache_key,
    product_review_state,
)
from .throttles import ReviewWriteThrottle

SUMMARY_CACHE_TTL_SECONDS = 300


def _parse_limit_offset(request, default_limit=10, max_limit=50):
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


def get_review_summary(product_id):
    cache_key = get_review_cache_key(product_id)
    summary = cache.get(cache_key)
    if summary is not None:
        return summary

    rows = (
        ProductReview.objects.filter(product_id=product_id)
        .values("rating")
        .annotate(count=Count("id"))
    )

    distribution = {rating: 0 for rating in range(1, 6)}
    total_count = 0
    weighted = 0
    for row in rows:
        rating = row["rating"]
        if rating not in distribution:
            continue
        count = row["count"]
        distribution[rating] = count
        total_count += count
        weighted += rating * count

    summary = {
        "average_rating": round(weighted / total_count, 1) if total_count else None,
        "total_count": total_count,
        "distribution": distribution,
    }
    cache.set(cache_key, summary, timeout=SUMMARY_CACHE_TTL_SECONDS)
    return summary


def invalidate_review_summary(product_id):
    cache.delete(get_review_cache_key(product_id))


class ProductReviewListView(APIView):
    """GET /api/products/<product_id>/reviews/ — public, paginated."""

    def get(self, request, product_id):
        product = get_object_or_404(Product, pk=product_id)

        queryset = ProductReview.objects.filter(product=product).select_related("user")
        total_count = queryset.count()
        limit, offset = _parse_limit_offset(request)
        reviews = queryset[offset : offset + limit]

        return Response(
            {
                "product_id": product.id,
                "summary": get_review_summary(product.id),
                "reviews": ProductReviewSerializer(reviews, many=True).data,
                "count": total_count,
                "limit": limit,
                "offset": offset,
                "has_more": offset + len(reviews) < total_count,
            }
        )


class ProductReviewEligibilityView(APIView):
    """GET /api/products/<product_id>/review-eligibility/ — authenticated."""

    permission_classes = [IsAuthenticated]

    def get(self, request, product_id):
        product = get_object_or_404(Product, pk=product_id)
        return Response(
            {
                "product_id": product.id,
                **product_review_state(request.user, product),
            }
        )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@throttle_classes([ReviewWriteThrottle])
def create_product_review(request, product_id):
    product = get_object_or_404(Product, pk=product_id)

    if ProductReview.objects.filter(user=request.user, product=product).exists():
        return Response(
            {"error": "You have already reviewed this product."},
            status=400,
        )

    eligible_item = get_eligible_order_item(request.user, product)
    if eligible_item is None:
        return Response(
            {"error": "You can review this product only after it has been delivered."},
            status=403,
        )

    serializer = ProductReviewWriteSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=400)

    review = serializer.save(
        user=request.user,
        product=product,
        order=eligible_item.order,
        order_item=eligible_item,
        is_verified_purchase=True,
    )
    invalidate_review_summary(product.id)

    return Response(
        {
            "message": "Review submitted. Thank you!",
            "review": ProductReviewSerializer(review).data,
        },
        status=201,
    )


@api_view(["PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def product_review_detail(request, review_id):
    review = get_object_or_404(ProductReview, pk=review_id)

    is_owner = review.user_id == request.user.id

    if request.method == "DELETE":
        if not (is_owner or request.user.is_staff):
            return Response(
                {"error": "You do not have permission to delete this review."},
                status=403,
            )
        product_id = review.product_id
        review.delete()
        invalidate_review_summary(product_id)
        return Response({"message": "Review deleted."})

    if not is_owner:
        return Response(
            {"error": "You do not have permission to edit this review."},
            status=403,
        )

    serializer = ProductReviewWriteSerializer(
        review,
        data=request.data,
        partial=True,
    )
    if not serializer.is_valid():
        return Response(serializer.errors, status=400)

    serializer.save()
    invalidate_review_summary(review.product_id)
    review.refresh_from_db()

    return Response(
        {
            "message": "Review updated.",
            "review": ProductReviewSerializer(review).data,
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def my_reviews(request):
    queryset = (
        ProductReview.objects.filter(user=request.user)
        .select_related("user", "product")
    )
    total_count = queryset.count()
    limit, offset = _parse_limit_offset(request)
    reviews = queryset[offset : offset + limit]

    return Response(
        {
            "reviews": ProductReviewWithProductSerializer(
                reviews,
                many=True,
                context={"request": request},
            ).data,
            "count": total_count,
            "limit": limit,
            "offset": offset,
            "has_more": offset + len(reviews) < total_count,
        }
    )
