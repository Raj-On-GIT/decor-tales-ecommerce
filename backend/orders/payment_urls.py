from django.urls import path

from . import payment_views

urlpatterns = [
    path("create-order/", payment_views.create_payment_order, name="create_payment_order"),
    path("verify/", payment_views.verify_payment, name="verify_payment"),
    path("failed/", payment_views.mark_payment_failed, name="mark_payment_failed"),
    path("webhook/", payment_views.razorpay_webhook, name="razorpay_webhook"),
    path("reconcile/", payment_views.reconcile_payments, name="reconcile_payments"),
]
