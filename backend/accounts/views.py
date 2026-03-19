from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from .serializers import ProfileSerializer, ForgotPasswordSerializer, ResetPasswordSerializer, ChangePasswordSerializer
from rest_framework.parsers import MultiPartParser, FormParser
from .serializers import SignupSerializer, LoginSerializer, UserSerializer, AddressSerializer
from .models import Address
from google.oauth2 import id_token
from google.auth.transport import requests
from django.contrib.auth.models import User
from rest_framework_simplejwt.tokens import RefreshToken
from django.conf import settings


# ============================================================================
# SIGNUP VIEW
# ============================================================================

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
        
        # Prepare response
        response_data = {
            'access': serializer.validated_data['access'],
            'refresh': serializer.validated_data['refresh'],
            'user': UserSerializer(user).data
        }
        
        return Response(
            response_data,
            status=status.HTTP_200_OK
        )
    
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
            
            response_data = {
                'access': serializer.validated_data['access'],
                'refresh': serializer.validated_data['refresh'],
                'user': UserSerializer(user).data
            }
            
            return Response(
                response_data,
                status=status.HTTP_200_OK
            )
        
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

import requests

@api_view(['POST'])
@permission_classes([AllowAny])
def google_auth_view(request):
    print("REQUEST DATA:", request.data)

    access_token = request.data.get("access_token")

    if not access_token:
        return Response({"error": "Access token missing"}, status=400)

    try:
        # Verify token with Google
        google_response = requests.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {access_token}"}
        )

        if google_response.status_code != 200:
            return Response({"error": "Invalid Google token"}, status=400)

        user_info = google_response.json()

        email = user_info.get("email")
        first_name = user_info.get("given_name", "")
        last_name = user_info.get("family_name", "")

        # Create or get user
        user, created = User.objects.get_or_create(
            username=email,
            defaults={
                "email": email,
                "first_name": first_name,
                "last_name": last_name
            }
        )

        refresh = RefreshToken.for_user(user)

        return Response({
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "user": UserSerializer(user).data
        })

    except Exception as e:
        print("GOOGLE AUTH ERROR:", str(e))
        return Response({"error": str(e)}, status=400)
