from rest_framework import serializers

from products.media_utils import build_media_url

from .models import ProductReview


class ProductReviewWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductReview
        fields = ["rating", "title", "comment"]
        extra_kwargs = {
            "rating": {"required": True, "allow_null": False},
            "title": {"required": False, "allow_blank": True, "max_length": 150},
            "comment": {"required": False, "allow_blank": True},
        }

    def validate(self, attrs):
        attrs = super().validate(attrs)

        has_title = bool((attrs.get("title") or "").strip())
        has_comment = bool((attrs.get("comment") or "").strip())

        if not has_title and not has_comment:
            raise serializers.ValidationError(
                {"comment": "Please share a few words or a title with your rating."}
            )

        attrs["title"] = (attrs.get("title") or "").strip()
        attrs["comment"] = (attrs.get("comment") or "").strip()
        return attrs


class ProductReviewSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()

    class Meta:
        model = ProductReview
        fields = [
            "id",
            "user_name",
            "rating",
            "title",
            "comment",
            "is_verified_purchase",
            "created_at",
            "updated_at",
        ]

    def get_user_name(self, obj):
        return obj.get_user_display_name()


class ProductReviewWithProductSerializer(ProductReviewSerializer):
    product_id = serializers.SerializerMethodField()
    product_title = serializers.SerializerMethodField()
    product_slug = serializers.SerializerMethodField()
    product_image = serializers.SerializerMethodField()

    class Meta(ProductReviewSerializer.Meta):
        fields = ProductReviewSerializer.Meta.fields + [
            "product_id",
            "product_title",
            "product_slug",
            "product_image",
        ]

    def get_product_id(self, obj):
        return obj.product_id

    def get_product_title(self, obj):
        return obj.product.title

    def get_product_slug(self, obj):
        return obj.product.slug

    def get_product_image(self, obj):
        request = self.context.get("request")
        url = build_media_url(obj.product.image)
        if not url:
            return None
        return request.build_absolute_uri(url) if request else url
