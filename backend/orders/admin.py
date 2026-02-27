from django.contrib import admin
from .models import Order, OrderItem, Cart, CartItem


admin.site.register(Cart)
admin.site.register(CartItem)
admin.site.register(Order)
admin.site.register(OrderItem)
