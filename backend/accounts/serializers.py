from django.conf import settings
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.core.exceptions import ValidationError
from django.utils.encoding import smart_bytes, smart_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Address, UserProfile
from .services import send_password_reset_email


class SignupSerializer(serializers.Serializer):
    email = serializers.EmailField(
        required=True,
        help_text="User's email address",
    )
    phone = serializers.CharField(
        required=True,
        max_length=20,
        help_text="User's phone number",
    )
    password = serializers.CharField(
        write_only=True,
        required=True,
        style={"input_type": "password"},
        help_text="User's password (min 8 characters)",
    )
    password2 = serializers.CharField(
        write_only=True,
        required=True,
        style={"input_type": "password"},
        help_text="Password confirmation (must match password)",
        label="Confirm Password",
    )
    first_name = serializers.CharField(required=False, allow_blank=True)
    last_name = serializers.CharField(required=False, allow_blank=True)

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value.lower()

    def validate_phone(self, value):
        digits = "".join(filter(str.isdigit, value or ""))

        if len(digits) != 10:
            raise serializers.ValidationError("Phone number must be exactly 10 digits.")

        return digits

    def validate_password(self, value):
        try:
            validate_password(value)
        except ValidationError as exc:
            raise serializers.ValidationError(list(exc.messages))
        return value

    def validate(self, attrs):
        if attrs["password"] != attrs["password2"]:
            raise serializers.ValidationError({"password2": "Passwords do not match."})

        attrs["first_name"] = (attrs.get("first_name") or "").strip()
        attrs["last_name"] = (attrs.get("last_name") or "").strip()
        return attrs


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField(
        required=True,
        help_text="Username or email address",
    )
    password = serializers.CharField(
        write_only=True,
        required=True,
        style={"input_type": "password"},
        help_text="User's password",
    )

    access = serializers.CharField(read_only=True)
    refresh = serializers.CharField(read_only=True)

    def validate(self, attrs):
        username_or_email = attrs.get("username")
        password = attrs.get("password")

        user = None

        if "@" in username_or_email:
            try:
                user = User.objects.get(email__iexact=username_or_email)
            except User.DoesNotExist:
                pass

        if user is None:
            try:
                user = User.objects.get(username=username_or_email)
            except User.DoesNotExist:
                pass

        if user is None or not user.check_password(password):
            raise serializers.ValidationError(
                "Invalid credentials. Please check your username and password.",
                code="authentication_failed",
            )

        if not user.is_active:
            raise serializers.ValidationError(
                "This account has been deactivated. Please contact support.",
                code="account_inactive",
            )

        refresh = RefreshToken.for_user(user)

        attrs["access"] = str(refresh.access_token)
        attrs["refresh"] = str(refresh)
        attrs["user"] = user

        return attrs


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("id", "username", "email", "first_name", "last_name", "date_joined")
        read_only_fields = fields


class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = ("phone",)
        extra_kwargs = {
            "phone": {"required": False, "allow_blank": True},
        }

    def validate_phone(self, value):
        digits = "".join(filter(str.isdigit, value or ""))

        if digits and len(digits) != 10:
            raise serializers.ValidationError("Phone number must be exactly 10 digits.")

        return digits


class ProfileSerializer(serializers.ModelSerializer):
    profile = UserProfileSerializer()

    class Meta:
        model = User
        fields = ("id", "email", "first_name", "last_name", "profile")

    def validate_first_name(self, value):
        value = value.strip()

        if value and not all(char.isalpha() or char in " .'-" for char in value):
            raise serializers.ValidationError("First name can only contain letters, spaces, apostrophes, periods, and hyphens.")

        return value

    def validate_last_name(self, value):
        value = value.strip()

        if value and not all(char.isalpha() or char in " .'-" for char in value):
            raise serializers.ValidationError("Last name can only contain letters, spaces, apostrophes, periods, and hyphens.")

        return value

    def update(self, instance, validated_data):
        profile_data = validated_data.pop("profile", {})

        instance.first_name = validated_data.get("first_name", instance.first_name)
        instance.last_name = validated_data.get("last_name", instance.last_name)
        instance.save()

        profile = instance.profile

        if "phone" in profile_data:
            profile.phone = profile_data.get("phone") or ""

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

    def validate_full_name(self, value):
        value = value.strip()
        allowed_chars = set("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ .'-")

        if len(value) < 3:
            raise serializers.ValidationError("Full name must be at least 3 characters.")

        if not all(char in allowed_chars for char in value):
            raise serializers.ValidationError("Full name can only contain letters, spaces, apostrophes, periods, and hyphens.")

        return value

    def validate_phone(self, value):
        digits = "".join(filter(str.isdigit, value))

        if len(digits) != 10:
            raise serializers.ValidationError("Phone number must be exactly 10 digits.")

        return digits

    def validate_postal_code(self, value):
        postal_code = value.strip()

        if not postal_code.isdigit() or len(postal_code) != 6:
            raise serializers.ValidationError("Postal code must be exactly 6 digits.")

        return postal_code

    def validate_address_line_1(self, value):
        value = value.strip()

        if len(value) < 5:
            raise serializers.ValidationError("Address line 1 must be at least 5 characters.")

        return value

    def validate_address_line_2(self, value):
        return value.strip()

    def validate_city(self, value):
        value = value.strip()

        if len(value) < 2:
            raise serializers.ValidationError("City must be at least 2 characters.")

        if not all(char.isalpha() or char.isspace() or char in "-." for char in value):
            raise serializers.ValidationError("City can only contain letters, spaces, hyphens, and periods.")

        return value

    def validate_state(self, value):
        value = value.strip()

        if len(value) < 2:
            raise serializers.ValidationError("State must be at least 2 characters.")

        if not all(char.isalpha() or char.isspace() or char in "-." for char in value):
            raise serializers.ValidationError("State can only contain letters, spaces, hyphens, and periods.")

        return value

    def create(self, validated_data):
        user = self.context["request"].user
        return Address.objects.create(user=user, **validated_data)


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

            send_password_reset_email(
                to_email=user.email,
                reset_url=reset_url,
            )

        except User.DoesNotExist:
            pass

        return attrs


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

        try:
            validate_password(attrs["password"], user)
        except ValidationError as exc:
            raise serializers.ValidationError({
                "password": list(exc.messages)
            })

        attrs["user"] = user
        return attrs

    def save(self):
        user = self.validated_data["user"]
        user.set_password(self.validated_data["password"])
        user.save()
        return user


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
        except ValidationError as exc:
            raise serializers.ValidationError({
                "new_password": list(exc.messages)
            })

        return attrs

    def save(self):
        user = self.context["request"].user
        user.set_password(self.validated_data["new_password"])
        user.save()
        return user
