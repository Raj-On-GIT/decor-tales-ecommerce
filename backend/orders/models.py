import secrets
from django.db import models
from products.models import Product, ProductVariant
from django.contrib.auth.models import User

def generate_order_token():
    suffix = secrets.token_hex(3).upper()
    return f"PFW-{suffix}"

class Cart(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='cart')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"Cart for {self.user.username}"

class CartItem(models.Model):

    cart = models.ForeignKey(Cart, on_delete=models.CASCADE, related_name='items')

    product = models.ForeignKey(Product, on_delete=models.CASCADE)

    variant = models.ForeignKey(
        ProductVariant,
        on_delete=models.CASCADE,
        null=True,
        blank=True
    )

    quantity = models.IntegerField(default=1)

    custom_text = models.TextField(blank=True, null=True)

    custom_image = models.ImageField(
        upload_to="custom_orders/",
        blank=True,
        null=True
    )

    class Meta:
        ordering = ["-id"]


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
        ('processing', 'Processing'),
        ('shipped', 'Shipped'),
        ('delivered', 'Delivered'),
        ('cancelled', 'Cancelled'),
    ]
    
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='orders')
    order_number = models.CharField(max_length=50, unique=True, default=generate_order_token)
    total_amount = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    
    # Shipping details
    shipping_address = models.TextField()
    city = models.CharField(max_length=100)
    postal_code = models.CharField(max_length=20)
    phone = models.CharField(max_length=20)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"Order {self.order_number}"

class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    quantity = models.IntegerField()
    price = models.DecimalField(max_digits=10, decimal_places=2)
    variant = models.ForeignKey(
        ProductVariant,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    custom_text = models.TextField(blank=True, null=True)

    custom_image = models.ImageField(
        upload_to="order_customizations/",
        blank=True,
        null=True
    )

    def __str__(self):
        return f"{self.quantity}x {self.product.title}"


class OrderItemImage(models.Model):
    order_item = models.ForeignKey(
        OrderItem,
        on_delete=models.CASCADE,
        related_name="custom_images",
    )
    image = models.ImageField(upload_to="order_customizations/")

    class Meta:
        ordering = ["id"]
