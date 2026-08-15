from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from orders.models import Order, OrderItem
from products.models import Product


class ProductReview(models.Model):
    user = models.ForeignKey(
        "auth.User",
        on_delete=models.CASCADE,
        related_name="reviews",
    )
    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name="reviews",
    )
    order = models.ForeignKey(
        Order,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviews",
    )
    order_item = models.ForeignKey(
        OrderItem,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviews",
    )
    rating = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)]
    )
    title = models.CharField(max_length=150, blank=True)
    comment = models.TextField(blank=True)
    is_verified_purchase = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "product"],
                name="reviews_user_product_uniq",
            ),
        ]
        indexes = [
            models.Index(
                fields=["product", "created_at"],
                name="reviews_prod_created_idx",
            ),
        ]

    def __str__(self):
        return f"{self.user.username} — {self.product_id} — {self.rating}★"

    def get_user_display_name(self):
        full_name = (self.user.get_full_name() or "").strip()
        if full_name:
            return full_name

        username = (self.user.username or "").strip()
        return username or "Customer"
