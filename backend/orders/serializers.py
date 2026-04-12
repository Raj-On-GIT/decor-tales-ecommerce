# orders/serializers.py - FIXED VERSION

from rest_framework import serializers
from .models import Order, OrderItem, Cart, CartItem
from products.models import Product
from products.models import ProductVariant
from utils.validation import validate_custom_image, validate_custom_text


# ============================================================================
# CART SERIALIZERS
# ============================================================================

class CartItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_price = serializers.DecimalField(source='product.price', max_digits=10, decimal_places=2, read_only=True)
    total = serializers.SerializerMethodField()
    
    class Meta:
        model = CartItem
        fields = ['id', 'product', 'product_name', 'product_price', 'quantity', 'total']
    
    def get_total(self, obj):
        return obj.product.price * obj.quantity


class CartSerializer(serializers.ModelSerializer):
    items = CartItemSerializer(many=True, read_only=True)
    total_amount = serializers.SerializerMethodField()
    
    class Meta:
        model = Cart
        fields = ['id', 'user', 'items', 'total_amount', 'created_at', 'updated_at']
        read_only_fields = ['user', 'created_at', 'updated_at']
    
    def get_total_amount(self, obj):
        return sum(item.product.price * item.quantity for item in obj.items.all())


# ============================================================================
# ORDER SERIALIZERS
# ============================================================================

class OrderItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_image = serializers.SerializerMethodField()
    total = serializers.SerializerMethodField()
    
    class Meta:
        model = OrderItem
        fields = ['id', 'product', 'product_name', 'product_image', 'quantity', 'price', 'total']
    
    def get_product_image(self, obj):
        if obj.product.image:
            return obj.product.image.url
        return None
    
    def get_total(self, obj):
        return obj.quantity * obj.price


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    
    class Meta:
        model = Order
        fields = [
            'id',
            'order_number',
            'user',
            'total_amount',
            'status',
            'shipping_address',
            'city',
            'postal_code',
            'phone',
            'items',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['user', 'order_number', 'created_at', 'updated_at']


class OrderDetailSerializer(serializers.ModelSerializer):
    """
    Detailed order serializer with all information
    """
    items = OrderItemSerializer(many=True, read_only=True)
    
    class Meta:
        model = Order
        fields = [
            'id',
            'order_number',
            'total_amount',
            'status',
            'shipping_address',
            'city',
            'postal_code',
            'phone',
            'items',
            'created_at',
            'updated_at',
        ]


class OrderCreateSerializer(serializers.Serializer):
    """
    Serializer for creating orders from cart
    """
    shipping_address = serializers.CharField(required=True)
    city = serializers.CharField(required=True, max_length=100)
    postal_code = serializers.CharField(required=True, max_length=20)
    phone = serializers.CharField(required=True, max_length=20)
    
    def validate_shipping_address(self, value):
        if len(value) < 10:
            raise serializers.ValidationError("Shipping address is too short")
        return value
    
    def validate_phone(self, value):
        # Remove any non-digit characters
        digits = ''.join(filter(str.isdigit, value))
        if len(digits) < 10:
            raise serializers.ValidationError("Phone number must be at least 10 digits")
        return value


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
        "custom_image_limit": "This product allows only {limit} custom image(s).",
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

        if custom_images and len(custom_images) > product.custom_image_limit:
            self.fail("custom_image_limit", limit=product.custom_image_limit)

        if custom_text and not product.allow_custom_text:
            self.fail("custom_text_not_allowed")

        attrs["product"] = product
        attrs["variant"] = variant
        attrs["custom_images"] = custom_images
        attrs["custom_text"] = custom_text
        return attrs
    
