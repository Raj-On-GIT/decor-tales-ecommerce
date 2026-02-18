from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken

# ============================================================================
# SIGNUP SERIALIZER
# ============================================================================

class SignupSerializer(serializers.ModelSerializer):
        
    email = serializers.EmailField(
        required=True,
        help_text="User's email address (must be unique)"
    )
    
    password = serializers.CharField(
        write_only=True,
        required=True,
        style={'input_type': 'password'},
        help_text="User's password (min 8 characters)"
    )
    
    password2 = serializers.CharField(
        write_only=True,
        required=True,
        style={'input_type': 'password'},
        help_text="Password confirmation (must match password)",
        label="Confirm Password"
    )

    class Meta:
        model = User
        fields = ('username', 'email', 'password', 'password2', 'first_name', 'last_name')
        extra_kwargs = {
            'first_name': {'required': False},
            'last_name': {'required': False},
        }

    def validate_username(self, value):
        
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError(
                "A user with this username already exists."
            )
        return value

    def validate_email(self, value):
        
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError(
                "A user with this email already exists."
            )
        return value.lower()  # Normalize email to lowercase

    def validate_password(self, value):
        
        try:
            validate_password(value)
        except ValidationError as e:
            raise serializers.ValidationError(list(e.messages))
        return value

    def validate(self, attrs):
    
        if attrs['password'] != attrs['password2']:
            raise serializers.ValidationError({
                "password2": "Password fields didn't match."
            })
        return attrs

    def create(self, validated_data):
        # Remove password2 from data
        validated_data.pop('password2')
        
        # Extract password
        password = validated_data.pop('password')
        
        # Create user with hashed password
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=password,  # create_user() hashes this automatically
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', '')
        )
        
        return user


# ============================================================================
# LOGIN SERIALIZER
# ============================================================================

class LoginSerializer(serializers.Serializer):
    
    username = serializers.CharField(
        required=True,
        help_text="Username or email address"
    )
    
    password = serializers.CharField(
        write_only=True,
        required=True,
        style={'input_type': 'password'},
        help_text="User's password"
    )
    
    # These fields are returned in response
    access = serializers.CharField(read_only=True)
    refresh = serializers.CharField(read_only=True)

    def validate(self, attrs):

        username_or_email = attrs.get('username')
        password = attrs.get('password')

        # Try to find user by username or email
        user = None
        
        # Check if input looks like an email
        if '@' in username_or_email:
            try:
                user = User.objects.get(email__iexact=username_or_email)
            except User.DoesNotExist:
                pass
        
        # If not found by email, try username
        if user is None:
            try:
                user = User.objects.get(username=username_or_email)
            except User.DoesNotExist:
                pass
        
        # Generic error if user not found or password incorrect
        if user is None or not user.check_password(password):
            raise serializers.ValidationError(
                "Invalid credentials. Please check your username and password.",
                code='authentication_failed'
            )
        
        # Check if user account is active
        if not user.is_active:
            raise serializers.ValidationError(
                "This account has been deactivated. Please contact support.",
                code='account_inactive'
            )
        
        # Generate JWT tokens using simplejwt
        refresh = RefreshToken.for_user(user)
        
        # Add tokens to validated data
        attrs['access'] = str(refresh.access_token)
        attrs['refresh'] = str(refresh)
        attrs['user'] = user  # Store user for potential use in view
        
        return attrs


class UserSerializer(serializers.ModelSerializer):
    
    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'first_name', 'last_name', 'date_joined')
        read_only_fields = fields
