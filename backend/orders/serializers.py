# orders/serializers.py - FIXED VERSION

from rest_framework import serializers
from .models import Order, OrderItem, Cart, CartItem
from products.models import Product


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
    