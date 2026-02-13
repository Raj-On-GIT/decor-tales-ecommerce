from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import generics
from .models import Product, Category, SubCategory
from .serializers import ProductSerializer, CategorySerializer, SubCategorySerializer, CategoryProductSerializer
from django.db.models import Count, Q
import logging


logger = logging.getLogger(__name__)

class ProductListView(generics.ListAPIView):
    serializer_class = ProductSerializer

    def get_queryset(self):
        queryset = Product.objects.filter(is_active=True).select_related("category").prefetch_related("images", "variants")
        category_slug = self.request.query_params.get("category_slug")
        logger.info(f"Received category_slug: {category_slug}")
        
        if category_slug:
            queryset = queryset.filter(category__slug=category_slug)
            logger.info(f"Filtered queryset count: {queryset.count()}")
        
        return queryset

class CategoryListView(generics.ListAPIView):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["request"] = self.request
        return context

class ProductDetailView(generics.RetrieveAPIView):
    serializer_class = ProductSerializer
    queryset = Product.objects.filter(is_active=True) \
        .select_related("category") \
        .prefetch_related("images", "variants")

    lookup_field = "id"

# ================= CATEGORY DETAIL (Subcategory → Product Flow) =================

@api_view(["GET"])
def category_detail(request, slug):
    try:
        category = Category.objects.get(slug=slug)
    except Category.DoesNotExist:
        return Response({"error": "Category not found"}, status=404)

    # Get subcategories under this category
    subcategories = (
        SubCategory.objects
        .filter(category=category)
        .annotate(
            productCount=Count("products")
        )
        .filter(productCount__gt=0)
    )



    # If subcategories exist → return them
    if subcategories.exists():
        sub_serializer = SubCategorySerializer(
            subcategories,
            many=True,
            context={"request": request}
        )

        return Response({
            "category": category.name,
            "has_subcategories": True,
            "subcategories": sub_serializer.data,
            "products": []
        })

    # Else → return products directly
    products = Product.objects.filter(
        category=category,
        is_active=True
    )

    prod_serializer = CategoryProductSerializer(
        products,
        many=True,
        context={"request": request}
    )

    return Response({
        "category": category.name,
        "has_subcategories": False,
        "subcategories": [],
        "products": prod_serializer.data
    })

# ================= SUBCATEGORY DETAIL =================

@api_view(["GET"])
def subcategory_detail(request, category_slug, sub_slug):
    try:
        subcategory = SubCategory.objects.select_related(
            "category"
        ).get(
            slug=sub_slug,
            category__slug=category_slug
        )
    except SubCategory.DoesNotExist:
        return Response(
            {"error": "Subcategory not found"},
            status=404
        )

    products = Product.objects.filter(
        category=subcategory.category,
        sub_category=subcategory,
        is_active=True
    )

    serializer = CategoryProductSerializer(
        products,
        many=True,
        context={"request": request}
    )

    return Response({
        "category": subcategory.category.name,
        "subcategory": subcategory.name,
        "products": serializer.data
    })

