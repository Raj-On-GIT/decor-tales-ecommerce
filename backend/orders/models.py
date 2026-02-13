import secrets
from django.db import models
from products.models import Product

def generate_order_token():
    suffix = secrets.token_hex(3).upper()
    return f"PFW-{suffix}"

class Order(models.Model):
    customer_name = models.CharField(max_length=100)
    customer_phone = models.CharField(max_length=15)
    shipping_address = models.TextField()
    total_amount = models.DecimalField(max_digits=10, decimal_places=2)

    custom_file = models.FileField(
        upload_to="orders/files/",
        blank=True,
        null=True,
        help_text="Custom file uploaded by customer"
    )

    token = models.CharField(
        max_length=20,
        default=generate_order_token,
        unique=True,
        editable=False
    )

    status = models.CharField(max_length=20, default="PENDING")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.token

class OrderItem(models.Model):
    order = models.ForeignKey(
        Order,
        related_name="items",
        on_delete=models.CASCADE
    )

    product = models.ForeignKey(
        Product,
        on_delete=models.SET_NULL,
        null=True
    )

    variant = models.ForeignKey(
        'products.ProductVariant',
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )

    quantity = models.PositiveIntegerField(default=1)

    price_at_purchase = models.DecimalField(
        max_digits=10,
        decimal_places=2
    )

    def __str__(self):
        return f"{self.product.title} x {self.quantity}"
