from django.db.models import Q

from orders.models import OrderItem

from .models import ProductReview

REVIEW_CACHE_PREFIX = "reviews:summary:"


def get_review_cache_key(product_id):
    return f"{REVIEW_CACHE_PREFIX}{product_id}"


def get_eligible_order_item(user, product):
    """
    Return the most recent delivered + paid OrderItem for this user and product.

    Only a verified purchase (paid and delivered) grants review eligibility.
    The OrderItem snapshot fields let a purchase match even if the product
    row was later replaced with a new slug/title.
    """
    if user is None or user.is_anonymous or product is None:
        return None

    return (
        OrderItem.objects.filter(
            order__user=user,
            order__status="delivered",
            order__payment_processed=True,
        )
        .filter(Q(product_id=product.id) | Q(product_slug=product.slug))
        .select_related("order")
        .order_by("-order__created_at", "-order_id")
        .first()
    )


def get_existing_review(user, product):
    if user is None or user.is_anonymous or product is None:
        return None
    return ProductReview.objects.filter(user=user, product=product).first()


def product_review_state(user, product):
    """Eligibility + current review state for a single product."""
    existing = get_existing_review(user, product)
    has_reviewed = existing is not None
    eligible_item = None if has_reviewed else get_eligible_order_item(user, product)

    return {
        "can_review": eligible_item is not None and not has_reviewed,
        "has_reviewed": has_reviewed,
        "review_id": existing.id if existing else None,
        "order_item_id": eligible_item.id if eligible_item else None,
        "order_id": eligible_item.order_id if eligible_item else None,
    }


def get_review_states_for_user(user, product_ids):
    """
    Batch review state for multiple products in a single query set.

    Returns {product_id: {"can_review", "has_reviewed", "review_id"}}.
    """
    product_ids = [pid for pid in (product_ids or []) if pid]
    if user is None or user.is_anonymous or not product_ids:
        return {pid: {"can_review": False, "has_reviewed": False, "review_id": None} for pid in product_ids}

    reviewed_map = dict(
        ProductReview.objects.filter(
            user=user,
            product_id__in=product_ids,
        ).values_list("product_id", "id")
    )

    eligible_ids = set(
        OrderItem.objects.filter(
            order__user=user,
            order__status="delivered",
            order__payment_processed=True,
            product_id__in=product_ids,
        )
        .values_list("product_id", flat=True)
        .distinct()
    )

    states = {}
    for product_id in product_ids:
        review_id = reviewed_map.get(product_id)
        states[product_id] = {
            "can_review": review_id is None and product_id in eligible_ids,
            "has_reviewed": review_id is not None,
            "review_id": review_id,
        }
    return states
