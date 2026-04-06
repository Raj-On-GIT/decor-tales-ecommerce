from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django.middleware.csrf import get_token
from django.views.decorators.csrf import ensure_csrf_cookie
from django.core import signing
from django.core.signing import BadSignature, SignatureExpired
from .serializers import ProfileSerializer, ForgotPasswordSerializer, ResetPasswordSerializer, ChangePasswordSerializer
from rest_framework.parsers import MultiPartParser, FormParser
from .serializers import SignupSerializer, LoginSerializer, UserSerializer, AddressSerializer
from .models import Address
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from django.contrib.auth.models import User
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.tokens import RefreshToken
from django.conf import settings
import secrets


# ============================================================================
# SIGNUP VIEW
# ============================================================================


def _get_cookie_settings():
    samesite = settings.AUTH_COOKIE_SAMESITE

    # 🔥 HARD FIX
    if samesite:
        samesite = samesite.strip()

    if samesite == "None":
        samesite = "None"
    elif samesite == "Lax":
        samesite = "Lax"
    else:
        samesite = "None"  # fallback for safety

    settings_dict = {
        "httponly": True,
        "secure": settings.AUTH_COOKIE_SECURE,
        "samesite": samesite,
        "path": "/",
    }

    if settings.AUTH_COOKIE_DOMAIN:
        settings_dict["domain"] = settings.AUTH_COOKIE_DOMAIN

    return settings_dict


def set_auth_cookies(response, *, access_token, refresh_token):
    cookie_settings = _get_cookie_settings()
    access_max_age = int(settings.SIMPLE_JWT["ACCESS_TOKEN_LIFETIME"].total_seconds())
    refresh_max_age = int(settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"].total_seconds())

    response.set_cookie(
        "access_token",
        access_token,
        max_age=access_max_age,
        **cookie_settings,
    )
    response.set_cookie(
        "refresh_token",
        refresh_token,
        max_age=refresh_max_age,
        **cookie_settings,
    )


def clear_auth_cookies(response):
    cookie_settings = {
    "path": "/",
    "samesite": settings.AUTH_COOKIE_SAMESITE,
    }

    if settings.AUTH_COOKIE_DOMAIN:
        cookie_settings["domain"] = settings.AUTH_COOKIE_DOMAIN
        response.delete_cookie("access_token", **cookie_settings)
        response.delete_cookie("refresh_token", **cookie_settings)

@api_view(['POST'])
@permission_classes([AllowAny])  # Public endpoint
def signup_view(request):
       
    serializer = SignupSerializer(data=request.data)
    
    if serializer.is_valid():
        # Create user (password is hashed in serializer)
        user = serializer.save()
        
        # Return user data (no tokens)
        user_data = UserSerializer(user).data
        
        return Response(
            {
                "message": "User created successfully. Please login.",
                "user": user_data
            },
            status=status.HTTP_201_CREATED
        )
    
    # Return validation errors
    return Response(
        serializer.errors,
        status=status.HTTP_400_BAD_REQUEST
    )


# ============================================================================
# LOGIN VIEW
# ============================================================================

@api_view(['POST'])
@permission_classes([AllowAny])  # Public endpoint
def login_view(request):
        
    serializer = LoginSerializer(data=request.data)
    
    if serializer.is_valid():
        # Tokens are generated in serializer.validate()
        user = serializer.validated_data.get('user')
        
        response = Response(
            {"user": UserSerializer(user).data},
            status=status.HTTP_200_OK
        )
        set_auth_cookies(
            response,
            access_token=serializer.validated_data["access"],
            refresh_token=serializer.validated_data["refresh"],
        )
        return response
    
    # Return authentication errors
    return Response(
        serializer.errors,
        status=status.HTTP_400_BAD_REQUEST
    )



class SignupView(APIView):
    
    permission_classes = [AllowAny]
    
    def post(self, request):
        serializer = SignupSerializer(data=request.data)
        
        if serializer.is_valid():
            user = serializer.save()
            user_data = UserSerializer(user).data
            
            return Response(
                {
                    "message": "User created successfully. Please login.",
                    "user": user_data
                },
                status=status.HTTP_201_CREATED
            )
        
        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )


class LoginView(APIView):
    permission_classes = [AllowAny]
    
    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        
        if serializer.is_valid():
            user = serializer.validated_data.get('user')

            response = Response(
                {"user": UserSerializer(user).data},
                status=status.HTTP_200_OK
            )
            set_auth_cookies(
                response,
                access_token=serializer.validated_data["access"],
                refresh_token=serializer.validated_data["refresh"],
            )
            return response
        
        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_profile(request):
    serializer = ProfileSerializer(request.user)
    return Response(serializer.data)

@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def update_profile(request):
    data = {
        "first_name": request.data.get("first_name"),
        "last_name": request.data.get("last_name"),
    }
    profile_data = {}

    if "profile.phone" in request.data:
        profile_data["phone"] = request.data.get("profile.phone")

    avatar_removed = "profile.avatar" in request.data and not request.data.get("profile.avatar")
    if "profile.avatar" in request.FILES:
        profile_data["avatar"] = request.FILES["profile.avatar"]
    elif avatar_removed:
        profile_data["avatar"] = None

    if profile_data:
        data["profile"] = profile_data

    serializer = ProfileSerializer(
        request.user,
        data=data,
        partial=True
    )

    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)

    return Response(serializer.errors, status=400)

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_addresses(request):
    addresses = Address.objects.filter(user=request.user).order_by("-is_default", "-created_at")
    serializer = AddressSerializer(addresses, many=True)
    return Response(serializer.data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_address(request):
    serializer = AddressSerializer(data=request.data, context={"request": request})
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=201)
    return Response(serializer.errors, status=400)


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def update_address(request, address_id):
    try:
        address = Address.objects.get(id=address_id, user=request.user)
    except Address.DoesNotExist:
        return Response({"error": "Address not found"}, status=404)

    serializer = AddressSerializer(address, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=400)


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def delete_address(request, address_id):
    try:
        address = Address.objects.get(id=address_id, user=request.user)
    except Address.DoesNotExist:
        return Response({"error": "Address not found"}, status=404)

    address.delete()
    return Response({"message": "Address deleted"})

# ============================================================================
# FORGOT PASSWORD VIEW
# ============================================================================

@api_view(["POST"])
@permission_classes([AllowAny])
def forgot_password_view(request):
    serializer = ForgotPasswordSerializer(data=request.data)

    if serializer.is_valid():
        return Response(
            {"message": "Password reset link sent to your email."},
            status=200,
        )

    return Response(serializer.errors, status=400)


# ============================================================================
# RESET PASSWORD VIEW
# ============================================================================

@api_view(["POST"])
@permission_classes([AllowAny])
def reset_password_view(request):
    serializer = ResetPasswordSerializer(data=request.data)

    if serializer.is_valid():
        serializer.save()
        return Response(
            {"message": "Password has been reset successfully."},
            status=200,
        )

    return Response(serializer.errors, status=400)


# ============================================================================
# CHANGE PASSWORD VIEW
# ============================================================================

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def change_password_view(request):
    serializer = ChangePasswordSerializer(
        data=request.data,
        context={"request": request},
    )

    if serializer.is_valid():
        serializer.save()
        return Response(
            {"message": "Password changed successfully."},
            status=200,
        )

    return Response(serializer.errors, status=400)

# ============================================================================
# GOOGLE LOGIN VIEW
# ============================================================================

GOOGLE_NONCE_SALT = "accounts.google-auth-nonce"
GOOGLE_NONCE_MAX_AGE_SECONDS = 300


def issue_google_nonce():
    nonce = secrets.token_urlsafe(32)
    nonce_token = signing.dumps({"nonce": nonce}, salt=GOOGLE_NONCE_SALT)
    return nonce, nonce_token


def consume_google_nonce(nonce_token):
    payload = signing.loads(
        nonce_token,
        salt=GOOGLE_NONCE_SALT,
        max_age=GOOGLE_NONCE_MAX_AGE_SECONDS,
    )
    return payload.get("nonce")


@api_view(["GET"])
@permission_classes([AllowAny])
@ensure_csrf_cookie
def csrf_token_view(request):
    return Response({"csrfToken": get_token(request)}, status=200)


@api_view(["GET"])
@permission_classes([AllowAny])
def google_auth_nonce_view(request):
    nonce, nonce_token = issue_google_nonce()
    return Response({"nonce": nonce, "nonce_token": nonce_token}, status=200)

@api_view(['POST'])
@permission_classes([AllowAny])
def google_auth_view(request):
    credential = str(request.data.get("credential", "") or "").strip()
    nonce_token = str(request.data.get("nonce_token", "") or "").strip()

    if not credential or not nonce_token:
        return Response(
            {"error": "Google credential and nonce token are required."},
            status=400,
        )

    try:
        if not settings.GOOGLE_CLIENT_ID:
            return Response({"error": "Google login is not configured."}, status=500)

        try:
            expected_nonce = consume_google_nonce(nonce_token)
        except SignatureExpired:
            return Response({"error": "Google login session expired. Please try again."}, status=400)
        except BadSignature:
            return Response({"error": "Invalid Google login session."}, status=400)

        token_info = id_token.verify_oauth2_token(
            credential,
            google_requests.Request(),
            settings.GOOGLE_CLIENT_ID,
        )

        issuer = token_info.get("iss")
        if issuer not in {"accounts.google.com", "https://accounts.google.com"}:
            return Response({"error": "Invalid Google token issuer."}, status=400)

        token_nonce = token_info.get("nonce")
        if not token_nonce or token_nonce != expected_nonce:
            return Response({"error": "Invalid Google token nonce."}, status=400)

        if not token_info.get("email_verified"):
            return Response({"error": "Google email is not verified."}, status=400)

        email = (token_info.get("email") or "").strip().lower()
        first_name = token_info.get("given_name", "")
        last_name = token_info.get("family_name", "")

        if not email:
            return Response({"error": "Google account email is unavailable."}, status=400)

        # Create or get user
        user, _created = User.objects.get_or_create(
            username=email,
            defaults={
                "email": email,
                "first_name": first_name,
                "last_name": last_name
            }
        )

        refresh = RefreshToken.for_user(user)

        response = Response({"user": UserSerializer(user).data})
        set_auth_cookies(
            response,
            access_token=str(refresh.access_token),
            refresh_token=str(refresh),
        )
        return response

    except Exception:
        return Response({"error": "Google authentication failed."}, status=400)


@api_view(["POST"])
@permission_classes([AllowAny])
def refresh_token_view(request):
    refresh_token = (
        str(request.data.get("refresh", "") or "").strip()
        or str(request.COOKIES.get("refresh_token", "") or "").strip()
    )

    if not refresh_token:
        response = Response({"error": "Refresh token missing."}, status=401)
        clear_auth_cookies(response)
        return response

    serializer = TokenRefreshSerializer(data={"refresh": refresh_token})

    try:
        serializer.is_valid(raise_exception=True)
    except Exception:
        response = Response({"error": "Refresh token is invalid or expired."}, status=401)
        clear_auth_cookies(response)
        return response

    access_token = serializer.validated_data["access"]
    next_refresh_token = serializer.validated_data.get("refresh", refresh_token)

    response = Response({"message": "Session refreshed."}, status=200)
    set_auth_cookies(
        response,
        access_token=access_token,
        refresh_token=next_refresh_token,
    )
    return response


@api_view(["POST"])
@permission_classes([AllowAny])
def logout_view(request):
    refresh_token = str(request.COOKIES.get("refresh_token", "") or "").strip()

    if refresh_token:
        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
        except Exception:
            pass

    response = Response({"message": "Logged out."}, status=200)
    clear_auth_cookies(response)
    return response
