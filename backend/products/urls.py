from django.urls import path
from . import views
from .views import TrendingProductListView, record_cart_add

urlpatterns = [
    path("products/", views.ProductListView.as_view(), name="product-list"),
    # ✅ Static paths MUST come before <int:id> patterns
    path("products/trending/", TrendingProductListView.as_view(), name="product-trending"),
    path("products/<int:id>/", views.ProductDetailView.as_view(), name="product-detail"),
    path("products/<int:id>/cart-add/", record_cart_add, name="product-cart-add"),
    path("categories/", views.CategoryListView.as_view(), name="category-list"),
    path("categories/<slug:slug>/", views.category_detail, name="category-detail"),
    path("categories/<slug:category_slug>/<slug:sub_slug>/", views.subcategory_detail, name="subcategory-detail"),
]