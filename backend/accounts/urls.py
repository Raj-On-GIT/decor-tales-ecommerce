from django.urls import path
from .views import get_profile, update_profile, get_addresses, create_address, update_address, delete_address,change_password_view

urlpatterns = [
    path("profile/", get_profile),
    path("profile/update/", update_profile),
    path("addresses/", get_addresses),
    path("addresses/create/", create_address),
    path("addresses/<int:address_id>/update/", update_address),
    path("addresses/<int:address_id>/delete/", delete_address),
    path("change-password/", change_password_view),
]