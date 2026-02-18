"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
    TokenVerifyView,
)

urlpatterns = [
    path("admin/", admin.site.urls),
    
    path('api/auth/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    # POST /api/auth/token/
    # Request: {"username": "user", "password": "pass"}
    # Response: {"access": "<token>", "refresh": "<token>"}
    # Purpose: Obtain access and refresh tokens using credentials
    
    path('api/auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    # POST /api/auth/token/refresh/
    # Request: {"refresh": "<refresh_token>"}
    # Response: {"access": "<new_access_token>", "refresh": "<new_refresh_token>"}
    # Purpose: Get new access token using valid refresh token
    # Note: If ROTATE_REFRESH_TOKENS=True, also returns new refresh token
    
    path('api/auth/token/verify/', TokenVerifyView.as_view(), name='token_verify'),
    # POST /api/auth/token/verify/
    # Request: {"token": "<access_or_refresh_token>"}
    # Response: {} (empty) if valid, 401 if invalid
    # Purpose: Check if a token is valid without making an actual API call
    # Useful for frontend token validation before requests

    path("api/", include("products.urls")),
    path("api/orders/", include("orders.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
