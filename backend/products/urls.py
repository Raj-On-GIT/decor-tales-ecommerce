from django.urls import path
from . import views

urlpatterns = [
    path("products/", views.ProductListView.as_view(), name="product-list"),
    path("products/<int:id>/", views.ProductDetailView.as_view(), name="product-detail"),
    path("categories/", views.CategoryListView.as_view(), name="category-list"),
    path("categories/<slug:slug>/", views.category_detail, name="category-detail"),
    path("categories/<slug:category_slug>/<slug:sub_slug>/", views.subcategory_detail, name="subcategory-detail"),
]
