from rest_framework import serializers
from .models import Banner, Product, Category, SubCategory, ProductVariant, ProductImage
from .media_utils import build_media_url
from django.db.models import Count, Q


def build_safe_media_url(request, file_field):
    if not file_field:
        return None

    url = build_media_url(file_field)
    if not url:
        return None

    if request:
        return request.build_absolute_uri(url)

    return url


class BannerSerializer(serializers.ModelSerializer):
    image = serializers.SerializerMethodField()

    class Meta:
        model = Banner
        fields = [
            "id",
            "type",
            "title",
            "subtitle",
            "description",
            "image",
            "cta_text",
            "cta_link",
            "background_color",
            "text_color",
            "priority",
            "is_active",
            "start_date",
            "end_date",
            "metadata",
            "created_at",
            "updated_at",
        ]

    def get_image(self, obj):
        return build_safe_media_url(self.context.get("request"), obj.image)

class ProductVariantSerializer(serializers.ModelSerializer):
    size_name = serializers.SerializerMethodField()
    color_name = serializers.SerializerMethodField()
    color_hex = serializers.SerializerMethodField()

    class Meta:
        model = ProductVariant
        fields = ['id', 'size', 'size_name', 'color', 'color_name', 'color_hex', 'mrp', 'slashed_price', 'discount_percent', 'stock', 'sku']

    def get_size_name(self, obj):
        return obj.size.name if obj.size else None

    def get_color_name(self, obj):
        return obj.color.name if obj.color else None

    def get_color_hex(self, obj):
        return obj.color.hex_code if obj.color else None

class ProductImageSerializer(serializers.ModelSerializer):
    image = serializers.SerializerMethodField()

    class Meta:
        model = ProductImage
        fields = ['id', 'image']

    def get_image(self, obj):
        return build_safe_media_url(self.context.get("request"), obj.image)

class ProductSerializer(serializers.ModelSerializer):
    image = serializers.SerializerMethodField()
    images = ProductImageSerializer(many=True, read_only=True)
    variants = ProductVariantSerializer(many=True, read_only=True)
    category = serializers.SerializerMethodField()
    sub_category = serializers.SerializerMethodField()
    total_stock = serializers.SerializerMethodField()
    availability_status = serializers.SerializerMethodField()
    is_available_for_purchase = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = ['id', 'title', 'slug', 'description', 'mrp', 'slashed_price', 'discount_percent', 'stock', 'stock_type', 'total_stock', 'created_at', 'category', 'sub_category', "allow_custom_image", "custom_image_limit", "allow_custom_text", "is_active", "availability_status", "is_available_for_purchase", 'image', 'images', 'variants']
    
    def get_total_stock(self, obj):
        return obj.get_total_stock()

    def get_image(self, obj):
        return build_safe_media_url(self.context.get("request"), obj.image)

    def get_category(self, obj):
        if not obj.category:
            return None
        return {"name": obj.category.name, "slug": obj.category.slug}

    def get_sub_category(self, obj):
        if not obj.sub_category:
            return None
        return {"name": obj.sub_category.name, "slug": obj.sub_category.slug}

    def get_availability_status(self, obj):
        return "available" if obj.is_active else "unavailable"

    def get_is_available_for_purchase(self, obj):
        return bool(obj.is_active)
    
    def validate(self, data):
        """
        Commit only selected stock type values.

        - Main stock → stock must be > 0
        - Variant stock → main stock is always forced to 0 (no error)
        """

        stock_type = data.get(
            "stock_type",
            self.instance.stock_type if self.instance else "main"
        )

        stock = data.get(
            "stock",
            self.instance.stock if self.instance else 0
        )

        # ✅ MAIN STOCK: validate only main stock
        if stock_type == "main":
            if not stock or stock <= 0:
                raise serializers.ValidationError({
                    "stock": "Main stock must be greater than 0 when using Main Stock."
                })

        # ✅ VARIANT STOCK: ignore main stock, force it to zero
        if stock_type == "variants":
            data["stock"] = 0   # ✅ auto-fix instead of error
            data["mrp"] = None
            data["slashed_price"] = None
            data["discount_percent"] = None

        return data


class CategorySerializer(serializers.ModelSerializer):
    image = serializers.SerializerMethodField()

    productCount = serializers.SerializerMethodField()
    subcategoryCount = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = [
            'id',
            'name',
            'slug',
            'image',
            'productCount',
            'subcategoryCount',
        ]

    def get_productCount(self, obj):
        return obj.products.filter(is_active=True).count()

    def get_subcategoryCount(self, obj):
        return obj.subcategories.annotate(
            productCount=Count(
                "products",
                filter=Q(products__is_active=True)
            )
        ).filter(productCount__gt=0).count()

    def get_image(self, obj):
        return build_safe_media_url(self.context.get("request"), obj.image)


class SubCategorySerializer(serializers.ModelSerializer):
    image = serializers.SerializerMethodField()

    productCount = serializers.IntegerField(read_only=True)
    category = serializers.SerializerMethodField()

    class Meta:
        model = SubCategory
        fields = [
            "id",
            "name",
            "slug",
            "image",
            "productCount",
            "category"
        ]
    
    def get_category(self, obj):  # ← Add this method
        if not obj.category:
            return None
        return {
            "name": obj.category.name,
            "slug": obj.category.slug
        }

    def get_image(self, obj):
        return build_safe_media_url(self.context.get("request"), obj.image)

class CategoryProductSerializer(ProductSerializer):
    class Meta(ProductSerializer.Meta):
        fields = ProductSerializer.Meta.fields
