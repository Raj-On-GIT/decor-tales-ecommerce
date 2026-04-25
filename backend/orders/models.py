import secrets
from decimal import Decimal
from django.db import models
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.utils import timezone
from products.models import Category, Product, ProductVariant, SubCategory

def generate_order_token():
    suffix = secrets.token_hex(3).upper()
    return f"PFW-{suffix}"

class Cart(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='cart')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"Cart for {self.user.username}"


class Coupon(models.Model):
    TYPE_PERCENT = "percent"
    TYPE_FIXED = "fixed"
    DISCOUNT_TYPE_CHOICES = [
        (TYPE_PERCENT, "Percentage"),
        (TYPE_FIXED, "Fixed amount"),
    ]

    code = models.CharField(max_length=50, unique=True)
    title = models.CharField(max_length=120)
    description = models.TextField(blank=True)
    discount_type = models.CharField(max_length=20, choices=DISCOUNT_TYPE_CHOICES)
    discount_value = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
    )
    min_order_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal("0.00"),
    )
    max_discount_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        blank=True,
        null=True,
        validators=[MinValueValidator(Decimal("0.01"))],
    )
    usage_limit = models.PositiveIntegerField(blank=True, null=True)
    usage_limit_per_user = models.PositiveIntegerField(blank=True, null=True)
    first_order_only = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    start_date = models.DateTimeField(default=timezone.now)
    end_date = models.DateTimeField(blank=True, null=True)
    categories = models.ManyToManyField(Category, blank=True, related_name="coupons")
    subcategories = models.ManyToManyField(SubCategory, blank=True, related_name="coupons")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["code"]

    def clean(self):
        if self.end_date and self.end_date < self.start_date:
            raise ValidationError({"end_date": "End date must be after start date."})

        if self.discount_type == self.TYPE_PERCENT and self.discount_value > Decimal("100"):
            raise ValidationError(
                {"discount_value": "Percentage discounts cannot exceed 100."}
            )

    def save(self, *args, **kwargs):
        self.code = (self.code or "").strip().upper()
        super().save(*args, **kwargs)

    def __str__(self):
        return self.code


class CouponUsage(models.Model):
    coupon = models.ForeignKey(Coupon, on_delete=models.CASCADE, related_name="usages")
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="coupon_usages")
    order = models.ForeignKey("Order", on_delete=models.CASCADE, related_name="coupon_usages")
    discount_amount = models.DecimalField(max_digits=10, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        unique_together = ("coupon", "order")

class CartItem(models.Model):

    cart = models.ForeignKey(Cart, on_delete=models.CASCADE, related_name='items')

    product = models.ForeignKey(Product, on_delete=models.CASCADE)

    variant = models.ForeignKey(
        ProductVariant,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )

    variant_size_name = models.CharField(max_length=100, blank=True)
    variant_color_name = models.CharField(max_length=100, blank=True)
    variant_sku = models.CharField(max_length=100, blank=True)

    quantity = models.IntegerField(default=1)

    custom_text = models.TextField(blank=True, null=True)

    custom_image = models.ImageField(
        upload_to="custom_orders/",
        blank=True,
        null=True
    )

    class Meta:
        ordering = ["-id"]

    def capture_variant_snapshot(self, variant=None):
        variant = variant if variant is not None else self.variant
        self.variant_size_name = variant.size.name if variant and variant.size else ""
        self.variant_color_name = variant.color.name if variant and variant.color else ""
        self.variant_sku = variant.sku if variant else ""


class CartItemImage(models.Model):
    cart_item = models.ForeignKey(
        CartItem,
        on_delete=models.CASCADE,
        related_name="custom_images",
    )
    image = models.ImageField(upload_to="custom_orders/")

    class Meta:
        ordering = ["id"]

        
class Order(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('paid', 'Paid'),
        ('failed', 'Failed'),
        ('processing', 'Processing'),
        ('shipped', 'Shipped'),
        ('delivered', 'Delivered'),
        ('cancelled', 'Cancelled'),
    ]
    
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='orders')
    order_number = models.CharField(max_length=50, unique=True, default=generate_order_token)
    subtotal_amount = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    discount_amount = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    total_amount = models.DecimalField(max_digits=10, decimal_places=2)
    coupon_code = models.CharField(max_length=50, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    razorpay_order_id = models.CharField(max_length=120, blank=True, null=True, unique=True)
    razorpay_payment_id = models.CharField(max_length=120, blank=True)
    razorpay_signature = models.CharField(max_length=255, blank=True)
    payment_provider = models.CharField(max_length=30, default="razorpay")
    payment_verified_at = models.DateTimeField(blank=True, null=True)
    payment_processed = models.BooleanField(default=False)
    refund_processed = models.BooleanField(default=False)
    
    # Shipping details
    shipping_email = models.EmailField(blank=True)
    shipping_full_name = models.CharField(max_length=150, blank=True)
    shipping_address = models.TextField()
    city = models.CharField(max_length=100)
    shipping_state = models.CharField(max_length=100, blank=True)
    shipping_country = models.CharField(max_length=100, blank=True, default="India")
    postal_code = models.CharField(max_length=20)
    phone = models.CharField(max_length=20)

    delhivery_waybill = models.CharField(max_length=120, blank=True)
    delhivery_reference = models.CharField(max_length=120, blank=True)
    delhivery_client_name = models.CharField(max_length=255, blank=True)
    delhivery_shipment_status = models.CharField(max_length=50, blank=True)
    delhivery_payment_mode = models.CharField(max_length=50, blank=True)
    delhivery_raw_response = models.JSONField(blank=True, null=True)
    delhivery_created_at = models.DateTimeField(blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"Order {self.order_number}"

class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(
        Product,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    quantity = models.IntegerField()
    price = models.DecimalField(max_digits=10, decimal_places=2)
    variant = models.ForeignKey(
        ProductVariant,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    product_title = models.CharField(max_length=255, blank=True)
    product_slug = models.SlugField(blank=True)
    product_image = models.CharField(max_length=500, blank=True)
    product_category_name = models.CharField(max_length=100, blank=True)
    product_category_slug = models.SlugField(blank=True)
    product_sub_category_name = models.CharField(max_length=100, blank=True)
    product_sub_category_slug = models.SlugField(blank=True)
    variant_size_name = models.CharField(max_length=100, blank=True)
    variant_color_name = models.CharField(max_length=100, blank=True)
    variant_sku = models.CharField(max_length=100, blank=True)
    custom_text = models.TextField(blank=True, null=True)

    custom_image = models.ImageField(
        upload_to="order_customizations/",
        blank=True,
        null=True
    )

    def __str__(self):
        return f"{self.quantity}x {self.product_title or getattr(self.product, 'title', 'Product')}"

    def capture_product_snapshot(self, product=None, variant=None):
        product = product or self.product
        variant = variant if variant is not None else self.variant

        if not product:
            return

        self.product_title = product.title or ""
        self.product_slug = product.slug or ""
        self.product_image = getattr(product.image, "name", "") or ""
        self.product_category_name = product.category.name if product.category else ""
        self.product_category_slug = product.category.slug if product.category else ""
        self.product_sub_category_name = (
            product.sub_category.name if product.sub_category else ""
        )
        self.product_sub_category_slug = (
            product.sub_category.slug if product.sub_category else ""
        )
        self.variant_size_name = variant.size.name if variant and variant.size else ""
        self.variant_color_name = variant.color.name if variant and variant.color else ""
        self.variant_sku = variant.sku if variant else ""

    def save(self, *args, **kwargs):
        if self.product and not self.product_title:
            self.capture_product_snapshot()
        super().save(*args, **kwargs)


class OrderItemImage(models.Model):
    order_item = models.ForeignKey(
        OrderItem,
        on_delete=models.CASCADE,
        related_name="custom_images",
    )
    image = models.ImageField(upload_to="order_customizations/")

    class Meta:
        ordering = ["id"]


class StockReservation(models.Model):
    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name="stock_reservations",
    )
    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
    )
    variant = models.ForeignKey(
        ProductVariant,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
    )
    quantity = models.PositiveIntegerField()
    reserved_until = models.DateTimeField()
    consumed_at = models.DateTimeField(blank=True, null=True)
    released_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        target = self.variant or self.product
        return f"Reservation for {target} x {self.quantity}"
