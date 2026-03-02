from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken
from .models import UserProfile, Address
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import smart_bytes, smart_str
from django.core.mail import send_mail
from django.conf import settings
import os

# ============================================================================
# SIGNUP SERIALIZER
# ============================================================================

class SignupSerializer(serializers.ModelSerializer):
        
    email = serializers.EmailField(
        required=True,
        help_text="User's email address"
    )
    
    phone = serializers.CharField(
        required=True,
        max_length=20,
        help_text="User's phone number"
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
        fields = ('email', 'password', 'password2', 'first_name', 'last_name', 'phone')

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value.lower()
    
    def validate_password(self, value):
        try:
            validate_password(value)
        except ValidationError as e:
            raise serializers.ValidationError(list(e.messages))
        return value

    def validate(self, attrs):
        if attrs["password"] != attrs["password2"]:
            raise serializers.ValidationError({"password2": "Passwords do not match."})
        return attrs

    def create(self, validated_data):
        validated_data.pop("password2")
        password = validated_data.pop("password")
        phone = validated_data.pop("phone")
        email = validated_data["email"]
        
        base_username = email.split("@")[0]
        username = base_username
        counter = 1

        while User.objects.filter(username=username).exists():
            username = f"{base_username}{counter}"
            counter += 1

        user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
            first_name=validated_data.get("first_name", ""),
            last_name=validated_data.get("last_name", ""),
        )

        # 🔥 Save phone in profile
        user.profile.phone = phone
        user.profile.save()

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

class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = ("phone", "avatar")

class ProfileSerializer(serializers.ModelSerializer):
    profile = UserProfileSerializer()

    class Meta:
        model = User
        fields = ("id", "email", "first_name", "last_name", "profile")

    def update(self, instance, validated_data):
        profile_data = validated_data.pop("profile", {})

        # -----------------------------
        # Update User fields
        # -----------------------------
        instance.first_name = validated_data.get("first_name", instance.first_name)
        instance.last_name = validated_data.get("last_name", instance.last_name)
        instance.save()

        # -----------------------------
        # Update Profile fields
        # -----------------------------
        profile = instance.profile

        # 🔥 Detect if avatar key was sent at all
        if "avatar" in profile_data:
            new_avatar = profile_data.get("avatar")

            # CASE 1: Avatar removed
            if not new_avatar:
                if profile.avatar:
                    if os.path.isfile(profile.avatar.path):
                        os.remove(profile.avatar.path)
                    profile.avatar = None

            # CASE 2: Avatar replaced
            else:
                if profile.avatar and os.path.isfile(profile.avatar.path):
                    os.remove(profile.avatar.path)
                profile.avatar = new_avatar

        # Update phone
        profile.phone = profile_data.get("phone", profile.phone)

        profile.save()

        return instance
    
class AddressSerializer(serializers.ModelSerializer):
    class Meta:
        model = Address
        fields = (
            "id",
            "full_name",
            "phone",
            "address_line_1",
            "address_line_2",
            "city",
            "state",
            "postal_code",
            "country",
            "is_default",
            "created_at",
        )
        read_only_fields = ("country", "created_at")

    def create(self, validated_data):
        user = self.context["request"].user
        return Address.objects.create(user=user, **validated_data)
    
# ============================================================================
# FORGOT PASSWORD SERIALIZER
# ============================================================================

class ForgotPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate(self, attrs):
        email = attrs.get("email")

        try:
            user = User.objects.get(email__iexact=email)

            token_generator = PasswordResetTokenGenerator()
            uid = urlsafe_base64_encode(smart_bytes(user.id))
            token = token_generator.make_token(user)

            reset_url = f"{settings.FRONTEND_URL}/reset-password/{uid}/{token}"

            send_mail(
                subject="Password Reset Request",
                message=f"Click the link below to reset your password:\n\n{reset_url}",
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[user.email],
                fail_silently=False,
            )

        except User.DoesNotExist:
            # Silently ignore
            pass

        return attrs


# ============================================================================
# RESET PASSWORD SERIALIZER
# ============================================================================

class ResetPasswordSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        try:
            user_id = smart_str(urlsafe_base64_decode(attrs["uid"]))
            user = User.objects.get(id=user_id)
        except (User.DoesNotExist, ValueError, TypeError):
            raise serializers.ValidationError("Invalid reset link.")

        token_generator = PasswordResetTokenGenerator()

        if not token_generator.check_token(user, attrs["token"]):
            raise serializers.ValidationError("Reset link is invalid or expired.")

        # Validate new password
        try:
            validate_password(attrs["password"], user)
        except ValidationError as e:
            raise serializers.ValidationError({
                "password": list(e.messages)
            })

        attrs["user"] = user
        return attrs

    def save(self):
        user = self.validated_data["user"]
        user.set_password(self.validated_data["password"])
        user.save()
        return user


# ============================================================================
# CHANGE PASSWORD SERIALIZER (LOGGED IN USER)
# ============================================================================

class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        user = self.context["request"].user

        if not user.check_password(attrs["old_password"]):
            raise serializers.ValidationError(
                {"old_password": "Old password is incorrect."}
            )

        try:
            validate_password(attrs["new_password"], user)
        except ValidationError as e:
            raise serializers.ValidationError({
                "new_password": list(e.messages)
            })

        return attrs

    def save(self):
        user = self.context["request"].user
        user.set_password(self.validated_data["new_password"])
        user.save()
        return user