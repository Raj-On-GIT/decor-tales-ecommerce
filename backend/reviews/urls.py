from django.urls import path

from . import views

urlpatterns = [
    path(
        "my-reviews/",
        views.my_reviews,
        name="my-reviews",
    ),
    path(
        "<int:review_id>/",
        views.product_review_detail,
        name="review-detail",
    ),
]
