from rest_framework import serializers
from .models import Product, Category, SubCategory, ProductVariant, ProductImage
from django.db.models import Count, Q

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
    class Meta:
        model = ProductImage
        fields = ['id', 'image']

class ProductSerializer(serializers.ModelSerializer):
    images = ProductImageSerializer(many=True, read_only=True)
    variants = ProductVariantSerializer(many=True, read_only=True)
    category = serializers.StringRelatedField()
    total_stock = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = ['id', 'title', 'slug', 'description', 'mrp', 'slashed_price', 'discount_percent', 'stock', 'stock_type', 'total_stock', 'created_at', 'category', "allow_custom_image", "custom_image_limit", "allow_custom_text", 'image', 'images', 'variants']
    
    def get_total_stock(self, obj):
        return obj.get_total_stock()
    
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


    def to_representation(self, instance):
        data = super().to_representation(instance)

        request = self.context.get("request")
        if instance.image and request:
            data["image"] = request.build_absolute_uri(
                instance.image.url
            )

        return data


class SubCategorySerializer(serializers.ModelSerializer):

    productCount = serializers.IntegerField(read_only=True)

    class Meta:
        model = SubCategory
        fields = [
            "id",
            "name",
            "slug",
            "image",
            "productCount",
        ]

class CategoryProductSerializer(ProductSerializer):
    class Meta(ProductSerializer.Meta):
        fields = ProductSerializer.Meta.fields


