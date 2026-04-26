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
    path("coupons/available/", views.get_available_coupons, name="available_coupons"),
    path("media/<path:file_path>/", views.serve_order_media, name="order_media"),

    # =========================
    # ORDERS
    # =========================
    path(
        "delhivery/pincode-serviceability/",
        views.get_delhivery_pincode_serviceability,
        name="delhivery_pincode_serviceability",
    ),
    path(
        "delhivery/expected-tat/",
        views.get_delhivery_expected_tat,
        name="delhivery_expected_tat",
    ),
    path(
        "delhivery/create-shipment/",
        views.create_delhivery_shipment,
        name="create_delhivery_shipment",
    ),
    path(
        "delhivery/track/",
        views.track_delhivery_shipment,
        name="track_delhivery_shipment",
    ),
    path(
        "delhivery/shipping-label/",
        views.get_delhivery_shipping_label,
        name="delhivery_shipping_label",
    ),
    path("create/", views.create_order, name="create_order"),
    path("my-orders/", views.get_my_orders, name="my_orders"),
    path("<int:order_id>/", views.get_order_detail, name="order_detail"),
]
