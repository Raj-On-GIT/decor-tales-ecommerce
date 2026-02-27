from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from django.contrib.auth.models import User
from rest_framework.views import APIView


from .serializers import SignupSerializer, LoginSerializer, UserSerializer


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

