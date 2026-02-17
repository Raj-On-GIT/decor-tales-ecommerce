from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import generics
from rest_framework.views import APIView
from .models import Product, Category, SubCategory, ProductActivity
from .serializers import ProductSerializer, CategorySerializer, SubCategorySerializer, CategoryProductSerializer
from django.db.models import Count, Q, Sum, Case, When, IntegerField, Value
from django.utils import timezone
from datetime import timedelta
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

    def retrieve(self, request, *args, **kwargs):
        response = super().retrieve(request, *args, **kwargs)
        # Record view event asynchronously-safe (simple inline write)
        try:
            ProductActivity.objects.create(
                product_id=kwargs["id"],
                event_type=ProductActivity.EVENT_VIEW,
            )
        except Exception:
            pass  # Never let tracking break the product page
        return response


class TrendingProductListView(generics.ListAPIView):
    """
    Returns up to 8 products ranked by a weighted activity score
    calculated over the last 30 days only:
        score = (cart_add_count × 3) + (view_count × 1)
    """
    serializer_class = ProductSerializer

    def get_queryset(self):
        since = timezone.now() - timedelta(days=30)

        return (
            Product.objects
            .filter(is_active=True)
            .select_related("category")
            .prefetch_related("images", "variants")
            .annotate(
                trend_score=Sum(
                    Case(
                        When(
                            activities__event_type=ProductActivity.EVENT_CART_ADD,
                            activities__created_at__gte=since,
                            then=Value(3),
                        ),
                        When(
                            activities__event_type=ProductActivity.EVENT_VIEW,
                            activities__created_at__gte=since,
                            then=Value(1),
                        ),
                        default=Value(0),
                        output_field=IntegerField(),
                    )
                )
            )
            .filter(trend_score__gt=0)
            .order_by("-trend_score")[:20]
        )

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
            productCount=Count("products", filter=Q(products__is_active=True))
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



# ================= CART ADD ACTIVITY =================

@api_view(["POST"])
def record_cart_add(request, id):
    """
    Called fire-and-forget from the frontend whenever a product
    is added to the cart for the first time in that session.
    """
    try:
        product = Product.objects.get(pk=id, is_active=True)
        ProductActivity.objects.create(
            product=product,
            event_type=ProductActivity.EVENT_CART_ADD,
        )
    except Product.DoesNotExist:
        pass
    return Response({"ok": True})


class SearchView(APIView):
    """
    Search across products, categories, and subcategories
    GET /api/search/?q=query
    """
    def get(self, request):
        query = request.GET.get('q', '').strip()
        
        if not query or len(query) < 2:
            return Response({
                'products': [],
                'categories': [],
                'subcategories': []
            })
        
        # Search products by title, description, category, subcategory
        products = Product.objects.filter(
            Q(title__icontains=query) |
            Q(description__icontains=query) |
            Q(category__name__icontains=query) |
            Q(sub_category__name__icontains=query),
            is_active=True
        ).select_related('category', 'sub_category').distinct()[:10]
        
        # Search categories
        categories = Category.objects.filter(
            name__icontains=query
        )[:5]
        
        # Search subcategories
        subcategories = SubCategory.objects.filter(
            name__icontains=query
        ).select_related('category')[:5]
        
        return Response({
            'products': ProductSerializer(products, many=True, context={'request': request}).data,
            'categories': CategorySerializer(categories, many=True, context={'request': request}).data,
            'subcategories': SubCategorySerializer(subcategories, many=True, context={'request': request}).data,
            'query': query
        })