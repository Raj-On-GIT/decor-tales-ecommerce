from django.urls import path

from . import views

urlpatterns = [
    path("", views.get_wishlist, name="wishlist-list"),
    path("toggle/", views.toggle_wishlist, name="wishlist-toggle"),
    path("add/", views.add_to_wishlist, name="wishlist-add"),
    path("remove/<int:item_id>/", views.remove_from_wishlist, name="wishlist-remove"),
]
