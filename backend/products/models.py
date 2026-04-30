from django.db import models
from django.utils.text import slugify
from django.core.validators import MinValueValidator
from django.utils import timezone
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


class BannerQuerySet(models.QuerySet):
    def active(self):
        now = timezone.now()
        return self.filter(
            is_active=True,
            start_date__lte=now,
        ).filter(
            models.Q(end_date__isnull=True) | models.Q(end_date__gte=now)
        )


class Banner(models.Model):
    TYPE_IMAGE = "image"
    TYPE_TEXT = "text"
    TYPE_MIXED = "mixed"
    TYPE_CHOICES = [
        (TYPE_IMAGE, "Image"),
        (TYPE_TEXT, "Text"),
        (TYPE_MIXED, "Mixed"),
    ]

    type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    title = models.CharField(max_length=255)
    subtitle = models.CharField(max_length=255, blank=True)
    description = models.TextField(blank=True, help_text="Supports HTML content.")
    image = models.ImageField(upload_to="banners/", blank=True, null=True)
    cta_text = models.CharField(max_length=120, blank=True)
    cta_link = models.URLField(blank=True)
    background_color = models.CharField(max_length=20, default="#111827")
    text_color = models.CharField(max_length=20, default="#FFFFFF")
    priority = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    start_date = models.DateTimeField()
    end_date = models.DateTimeField(blank=True, null=True)
    metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text="Optional payload for countdowns, coupon codes, personalization, and future banner features.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = BannerQuerySet.as_manager()

    class Meta:
        ordering = ["priority", "-created_at"]

    def clean(self):
        from django.core.exceptions import ValidationError

        if self.end_date and self.end_date < self.start_date:
            raise ValidationError({"end_date": "End date must be after start date."})

    def __str__(self):
        return f"{self.title} ({self.type})"

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

    created_at = models.DateTimeField(
        auto_now_add=True
    )
    
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

    def get_delete_blockers(self):
        blockers = []

        if self.orderitem_set.exists():
            blockers.append("order history")

        if self.cartitem_set.exists():
            blockers.append("shopping carts")

        if self.stockreservation_set.exists():
            blockers.append("stock reservations")

        return blockers

    def can_hard_delete(self):
        return not self.get_delete_blockers()

    def archive(self):
        if self.is_active:
            self.is_active = False
            self.save(update_fields=["is_active"])

    def delete(self, using=None, keep_parents=False):
        if not self.can_hard_delete():
            self.archive()
            return
        return super().delete(using=using, keep_parents=keep_parents)

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

        # Auto generate SKU if empty
        if not self.sku:
            size_code = self.size.name[:2].upper() if self.size else "NA"
            color_code = self.color.name[:3].upper() if self.color else "CLR"

            # If product already saved use its id
            product_id = self.product.id if self.product else "PRD"

            self.sku = f"DT-{product_id}-{size_code}-{color_code}"

        # Round prices
        self.mrp = round_price(self.mrp)
        self.slashed_price = round_price(self.slashed_price)

        # Auto discount %
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



class ProductActivity(models.Model):
    EVENT_VIEW     = "view"
    EVENT_CART_ADD = "cart_add"
    EVENT_CHOICES  = [
        (EVENT_VIEW,     "View"),
        (EVENT_CART_ADD, "Cart Add"),
    ]

    product    = models.ForeignKey(
        Product,
        related_name="activities",
        on_delete=models.CASCADE,
    )
    event_type = models.CharField(max_length=20, choices=EVENT_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        # Speeds up the 30-day trending query significantly
        indexes = [
            models.Index(fields=["product", "event_type", "created_at"]),
        ]

    def __str__(self):
        return f"{self.product.title} — {self.event_type} @ {self.created_at:%Y-%m-%d %H:%M}"
