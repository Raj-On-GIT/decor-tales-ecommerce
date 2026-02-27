from django.urls import path
from . import views

urlpatterns = [
    # =========================
    # CART
    # =========================
    path("cart/", views.get_cart, name="get_cart"),
    path("cart/add/", views.add_to_cart, name="add_to_cart"),
    path("cart/remove/<int:item_id>/", views.remove_from_cart, name="remove_from_cart"),
    path("cart/update/<int:item_id>/", views.update_cart_item, name="update_cart_item"),
    path("cart/clear/", views.clear_cart, name="clear_cart"),

    # =========================
    # ORDERS
    # =========================
    path("create/", views.create_order, name="create_order"),
    path("my-orders/", views.get_my_orders, name="my_orders"),
    path("<int:order_id>/", views.get_order_detail, name="order_detail"),
]
