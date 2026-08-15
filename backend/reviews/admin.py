from django.contrib import admin

from .models import ProductReview


@admin.register(ProductReview)
class ProductReviewAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "user",
        "product",
        "rating",
        "is_verified_purchase",
        "has_text",
        "created_at",
    )
    list_filter = ("rating", "is_verified_purchase", "created_at")
    search_fields = (
        "user__username",
        "user__email",
        "user__first_name",
        "user__last_name",
        "product__title",
        "title",
        "comment",
    )
    readonly_fields = ("created_at", "updated_at", "id")
    fieldsets = (
        (
            None,
            {
                "fields": (
                    "user",
                    "product",
                    "order",
                    "order_item",
                    "rating",
                    "title",
                    "comment",
                    "is_verified_purchase",
                )
            },
        ),
        (
            "Audit",
            {
                "fields": ("created_at", "updated_at"),
            },
        ),
    )

    @admin.display(boolean=True, description="Has text")
    def has_text(self, obj):
        return bool((obj.title or "").strip() or (obj.comment or "").strip())
