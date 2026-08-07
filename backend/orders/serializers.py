# orders/serializers.py

from rest_framework import serializers

from products.models import Product
from products.models import ProductVariant
from utils.validation import validate_custom_image, validate_custom_text


class AddToCartSerializer(serializers.Serializer):
    """
    Validate add-to-cart input without changing the existing response contract.

    This keeps customization checks at serializer level while the view continues
    to handle cart merging and persistence exactly as before.
    """

    product_id = serializers.IntegerField(required=True)
    quantity = serializers.IntegerField(required=False, default=1, min_value=1)
    variant_id = serializers.IntegerField(required=False, allow_null=True)
    custom_text = serializers.CharField(
        required=False,
        allow_null=True,
        allow_blank=True,
        trim_whitespace=False,
    )
    custom_images = serializers.ListField(
        child=serializers.ImageField(),
        required=False,
        allow_empty=True,
    )

    default_error_messages = {
        "variant_not_supported": "Variants are not supported for this product.",
        "variant_mismatch": "Selected variant does not belong to this product.",
        "custom_image_not_allowed": "This product does not allow image customization.",
        "custom_image_limit": "Please upload exactly {limit} custom image(s) for this product.",
        "custom_text_not_allowed": "This product does not allow text customization.",
    }

    def validate_custom_text(self, value):
        if value is None or value == "":
            return None

        return validate_custom_text(value)

    def validate_custom_images(self, value):
        return [validate_custom_image(image) for image in value]

    def validate(self, attrs):
        product = Product.objects.filter(id=attrs["product_id"]).first()
        if not product:
            raise serializers.ValidationError({"product_id": "Invalid product."})
        if not product.is_active:
            raise serializers.ValidationError({"product_id": "This product is no longer available."})

        variant = None
        variant_id = attrs.get("variant_id")
        if variant_id:
            variant = ProductVariant.objects.filter(id=variant_id).first()
            if not variant:
                raise serializers.ValidationError({"variant_id": "Invalid variant."})

            if product.stock_type != "variants":
                self.fail("variant_not_supported")

            if variant.product_id != product.id:
                self.fail("variant_mismatch")

        custom_images = attrs.get("custom_images", [])
        custom_text = attrs.get("custom_text")

        if custom_images and not product.allow_custom_image:
            self.fail("custom_image_not_allowed")

        if custom_images and len(custom_images) != product.custom_image_limit:
            self.fail("custom_image_limit", limit=product.custom_image_limit)

        if custom_text and not product.allow_custom_text:
            self.fail("custom_text_not_allowed")

        attrs["product"] = product
        attrs["variant"] = variant
        attrs["custom_images"] = custom_images
        attrs["custom_text"] = custom_text
        return attrs
    
