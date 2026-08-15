from django.urls import path

from . import views

urlpatterns = [
    path(
        "products/<int:product_id>/reviews/",
        views.ProductReviewListView.as_view(),
        name="product-reviews",
    ),
    path(
        "products/<int:product_id>/review-eligibility/",
        views.ProductReviewEligibilityView.as_view(),
        name="product-review-eligibility",
    ),
    path(
        "products/<int:product_id>/reviews/create/",
        views.create_product_review,
        name="product-review-create",
    ),
    path(
        "reviews/my-reviews/",
        views.my_reviews,
        name="my-reviews",
    ),
    path(
        "reviews/<int:review_id>/",
        views.product_review_detail,
        name="review-detail",
    ),
]
