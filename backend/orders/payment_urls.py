from django.urls import path

from . import payment_views

urlpatterns = [
    path("create-order/", payment_views.create_payment_order, name="create_payment_order"),
    path("verify/", payment_views.verify_payment, name="verify_payment"),
    path("failed/", payment_views.mark_payment_failed, name="mark_payment_failed"),
]
