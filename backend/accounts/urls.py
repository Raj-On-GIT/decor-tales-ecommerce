from django.urls import path
from . import views  # Adjust import based on your structure

# ============================================================================
# AUTHENTICATION URLS
# ============================================================================

"""
RECOMMENDED STRUCTURE
───────────────────────────────────────────────────────────────────────────

All authentication endpoints under /api/auth/ prefix:

/api/auth/
├── token/              (Phase 3 - JWT infrastructure)
│   ├── refresh/
│   └── verify/
├── signup/             (Phase 4 - NEW)
└── login/              (Phase 4 - NEW)

This structure:
  ✓ Groups related endpoints together
  ✓ Clear separation from business logic endpoints
  ✓ Easy to apply middleware/throttling to auth group
  ✓ Intuitive for frontend developers
"""

# ============================================================================
# OPTION 1: Add to Main urls.py (Recommended)
# ============================================================================

"""
In your main project urls.py:
"""

from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

# JWT endpoints (from Phase 3)
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
    TokenVerifyView,
)

# Auth endpoints (Phase 4)
from your_app.views import signup_view, login_view

urlpatterns = [
    # Admin
    path('admin/', admin.site.urls),
    
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # AUTHENTICATION ENDPOINTS
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    
    # Phase 3: JWT Token Management
    path('api/auth/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/auth/token/verify/', TokenVerifyView.as_view(), name='token_verify'),
    
    # Phase 4: User Registration & Authentication
    path('api/auth/signup/', signup_view, name='signup'),
    path('api/auth/login/', login_view, name='login'),
    
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # BUSINESS LOGIC ENDPOINTS
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    
    # Your existing API routes
    path('api/', include('your_app.urls')),  # Products, cart, orders, etc.
]

# Serve media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)


# ============================================================================
# OPTION 2: Separate Auth URLs File (Alternative)
# ============================================================================

"""
Create a new file: your_app/auth_urls.py
"""

# your_app/auth_urls.py
from django.urls import path
from . import views

urlpatterns = [
    path('signup/', views.signup_view, name='signup'),
    path('login/', views.login_view, name='login'),
]

"""
Then in main urls.py:
"""

urlpatterns = [
    # ... other patterns ...
    path('api/auth/', include('your_app.auth_urls')),  # Auth endpoints
    # ... rest of patterns ...
]


# ============================================================================
# OPTION 3: Class-Based Views (Alternative)
# ============================================================================


from your_app.views import SignupView, LoginView

urlpatterns = [
    # ... other patterns ...
    
    # Phase 4: User Registration & Authentication
    path('api/auth/signup/', SignupView.as_view(), name='signup'),
    path('api/auth/login/', LoginView.as_view(), name='login'),
    
    # ... rest of patterns ...
]

