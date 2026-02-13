from django.db import models
from django.utils.text import slugify
from django.core.validators import MinValueValidator
from decimal import Decimal, ROUND_HALF_UP


def round_price(value):
    if value is None:
        return value

    return Decimal(value).quantize(
        Decimal("1"),
        rounding=ROUND_HALF_UP
    )

class Category(models.Model):
    name = models.CharField(max_length=100)
    slug = models.SlugField(unique=True, blank=True)
    image = models.ImageField(upload_to="categories/", blank=True, null=True)

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    class Meta:
        verbose_name_plural = "Categories"

    def __str__(self):
        return self.name

class SubCategory(models.Model):
    category = models.ForeignKey(
        Category,
        related_name="subcategories",
        on_delete=models.CASCADE
    )

    name = models.CharField(max_length=100)

    slug = models.SlugField(unique=True, blank=True)

    image = models.ImageField(
        upload_to="subcategories/",
        blank=True,
        null=True,
        help_text="Image for subcategory tile display"
    )

    class Meta:
        unique_together = ("category", "name")
        ordering = ["name"]
        verbose_name_plural = "Sub Categories"

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(f"{self.category.name}-{self.name}")
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.category.name} → {self.name}"


class Size(models.Model):
    name = models.CharField(max_length=100, unique=True)
    
    class Meta:
        ordering = ['name']
    
    def __str__(self):
        return self.name

class Color(models.Model):
    name = models.CharField(max_length=100, unique=True)
    hex_code = models.CharField(max_length=7, blank=True, null=True, help_text="e.g., #FF0000")
    
    class Meta:
        ordering = ['name']
    
    def __str__(self):
        return self.name

class Product(models.Model):
    STOCK_TYPE_CHOICES = [
        ('main', 'Main Stock'),
        ('variants', 'Variant Stock'),
    ]
    
    title = models.CharField(max_length=255)
    slug = models.SlugField(unique=True, blank=True)
    description = models.TextField(blank=True)
    # price = models.DecimalField(max_digits=10, decimal_places=2)

    # "Replaced"
    mrp = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Maximum Retail Price (Required)"
    )

    slashed_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Optional original price to show discount"
    )

    discount_percent = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Discount percentage (auto-calculated)"
    )

    stock = models.PositiveIntegerField(default=0, help_text="Only used if stock_type is 'main'")
    stock_type = models.CharField(max_length=10, choices=STOCK_TYPE_CHOICES, default='main')
    category = models.ForeignKey(
        Category,
        related_name="products",
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    sub_category = models.ForeignKey(
        SubCategory,
        related_name="products",
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )

    image = models.ImageField(upload_to="products/", blank=True, null=True)
    allow_custom_image = models.BooleanField(default=False, help_text="Allow customers to upload custom images")

    custom_image_limit = models.PositiveIntegerField(
    default=1,
    validators=[MinValueValidator(1)],
    help_text="Number of images customer can upload (only if custom image is allowed)"
    )

    allow_custom_text = models.BooleanField(default=False, help_text="Allow customers to add custom text")
    is_active = models.BooleanField(default=True)

    def save(self, *args, **kwargs):
        # Auto slug
        if not self.slug:
            self.slug = slugify(self.title)

        # Custom image safety
        if not self.allow_custom_image:
            self.custom_image_limit = 1

        # ✅ Round prices
        self.mrp = round_price(self.mrp)
        self.slashed_price = round_price(self.slashed_price)

        # ✅ Auto discount calculation
        if self.mrp and self.slashed_price and self.slashed_price < self.mrp:
            self.discount_percent = round(
                ((self.mrp - self.slashed_price) / self.mrp) * 100
            )
        else:
            self.discount_percent = None

        super().save(*args, **kwargs)

    
    def get_total_stock(self):
        """Get total stock based on stock_type"""
        if self.stock_type == 'main':
            return self.stock
        else:
            return sum(variant.stock for variant in self.variants.all())

    def __str__(self):
        return self.title

class ProductVariant(models.Model):
    product = models.ForeignKey(
        Product,
        related_name="variants",
        on_delete=models.CASCADE
    )
    size = models.ForeignKey(
        Size,
        on_delete=models.PROTECT,
        blank=True,
        null=True,
        help_text="Select from available sizes"
    )
    color = models.ForeignKey(
        Color,
        on_delete=models.PROTECT,
        blank=True,
        null=True,
        help_text="Select from available colors"
    )
    # price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, help_text="Leave blank to use product price")
    # changed
    mrp = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True
    )

    slashed_price = models.DecimalField(
        max_digits=10, decimal_places=2,
        null=True, blank=True
    )

    discount_percent = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Discount percentage (auto-calculated)"
    )

    stock = models.PositiveIntegerField(default=0)
    sku = models.CharField(max_length=100, unique=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('product', 'size', 'color')

    def __str__(self):
        size_str = self.size.name if self.size else "N/A"
        color_str = self.color.name if self.color else "N/A"
        return f"{self.product.title} - {size_str} - {color_str}"
    
    def save(self, *args, **kwargs):

        # ✅ Round prices
        self.mrp = round_price(self.mrp)
        self.slashed_price = round_price(self.slashed_price)

        # ✅ Auto discount %
        if self.mrp and self.slashed_price and self.slashed_price < self.mrp:
            self.discount_percent = round(
                ((self.mrp - self.slashed_price) / self.mrp) * 100
            )
        else:
            self.discount_percent = None

        super().save(*args, **kwargs)


class ProductImage(models.Model):
    product = models.ForeignKey(
        Product,
        related_name="images",
        on_delete=models.CASCADE
    )
    image = models.ImageField(upload_to="products/gallery/")

