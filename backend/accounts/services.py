import secrets
import logging
from datetime import timedelta

import requests
from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password
from django.contrib.auth.models import User
from django.core import signing
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework import serializers

from .email_utils import normalize_email_address
from .models import SignupOTPChallenge, UserAuthIdentity


SIGNUP_OTP_TOKEN_SALT = "accounts.signup-otp"
logger = logging.getLogger(__name__)


class SignupOTPError(serializers.ValidationError):
    status_code = 400

    def __init__(self, message, *, code=None, status_code=400):
        super().__init__({"error": message}, code=code)
        self.status_code = status_code


def _generate_signup_username(email):
    base_username = email.split("@", 1)[0]
    username = base_username
    counter = 1

    while User.objects.filter(username=username).exists():
        username = f"{base_username}{counter}"
        counter += 1

    return username


def _audit_identity_event(event, **fields):
    serialized_fields = " ".join(f"{key}={value}" for key, value in fields.items())
    logger.info("auth_identity_%s %s", event, serialized_fields)


def _generate_numeric_otp():
    return f"{secrets.randbelow(900000) + 100000:06d}"


def _send_resend_email(*, to_email, subject, html):
    if not settings.RESEND_API_KEY:
        raise RuntimeError("RESEND_API_KEY is not configured.")

    response = requests.post(
        settings.RESEND_API_URL,
        headers={
            "Authorization": f"Bearer {settings.RESEND_API_KEY}",
            "Content-Type": "application/json",
        },
        json={
            "from": settings.RESEND_FROM_EMAIL,
            "to": [to_email],
            "subject": subject,
            "html": html,
        },
        timeout=15,
    )
    response.raise_for_status()
    return response.json()


def send_signup_otp_email(*, to_email, otp_code):
    return _send_resend_email(
        to_email=to_email,
        subject="Your DecorTales signup verification code",
        html=(
            "<p>Use the verification code below to complete your DecorTales signup.</p>"
            f"<p style='font-size:24px;font-weight:700;letter-spacing:4px;'>{otp_code}</p>"
            f"<p>This code expires in {settings.SIGNUP_OTP_EXPIRY_SECONDS // 60} minutes.</p>"
            "<p>If you did not request this, you can ignore this email.</p>"
        ),
    )


def send_password_reset_email(*, to_email, reset_url):
    return _send_resend_email(
        to_email=to_email,
        subject="Reset your DecorTales password",
        html=(
            "<p>We received a request to reset your DecorTales password.</p>"
            f"<p><a href='{reset_url}'>Reset your password</a></p>"
            "<p>If you did not request this, you can ignore this email.</p>"
        ),
    )


def issue_signup_token(email):
    return signing.dumps({"email": email}, salt=SIGNUP_OTP_TOKEN_SALT)


def read_signup_token(token):
    try:
        payload = signing.loads(token, salt=SIGNUP_OTP_TOKEN_SALT)
    except signing.BadSignature as exc:
        raise SignupOTPError("Invalid signup session. Please start again.") from exc

    email = normalize_email_address(payload.get("email"))
    if not email:
        raise SignupOTPError("Invalid signup session. Please start again.")
    return email


def issue_signup_otp(validated_data):
    email = normalize_email_address(validated_data["email"])
    now = timezone.now()
    challenge, _created = SignupOTPChallenge.objects.get_or_create(
        email=email,
        defaults={
            "first_name": validated_data.get("first_name", ""),
            "last_name": validated_data.get("last_name", ""),
            "phone": validated_data["phone"],
            "password_hash": make_password(validated_data["password"]),
            "otp_hash": make_password(_generate_numeric_otp()),
            "expires_at": now,
        },
    )

    if challenge.last_sent_at:
        since_last_send = (now - challenge.last_sent_at).total_seconds()
        if since_last_send < settings.SIGNUP_OTP_RESEND_COOLDOWN_SECONDS:
            wait_seconds = int(settings.SIGNUP_OTP_RESEND_COOLDOWN_SECONDS - since_last_send)
            raise SignupOTPError(
                f"Please wait {max(wait_seconds, 1)} seconds before requesting another code.",
                status_code=429,
            )

    if challenge.send_count >= settings.SIGNUP_OTP_MAX_SENDS and not challenge.is_expired():
        raise SignupOTPError(
            "Verification code request limit reached. Please try again later.",
            status_code=429,
        )

    otp_code = _generate_numeric_otp()
    challenge.first_name = validated_data.get("first_name", "")
    challenge.last_name = validated_data.get("last_name", "")
    challenge.phone = validated_data["phone"]
    challenge.password_hash = make_password(validated_data["password"])
    challenge.otp_hash = make_password(otp_code)
    challenge.send_count = 1 if challenge.is_expired() or challenge.is_consumed() else challenge.send_count + 1
    challenge.verify_attempt_count = 0
    challenge.last_sent_at = now
    challenge.expires_at = now + timedelta(seconds=settings.SIGNUP_OTP_EXPIRY_SECONDS)
    challenge.consumed_at = None
    challenge.save()

    send_signup_otp_email(to_email=email, otp_code=otp_code)

    return {
        "signup_token": issue_signup_token(email),
        "email": email,
        "expires_in": settings.SIGNUP_OTP_EXPIRY_SECONDS,
        "resend_cooldown": settings.SIGNUP_OTP_RESEND_COOLDOWN_SECONDS,
    }


@transaction.atomic
def verify_signup_otp(*, signup_token, otp_code):
    email = read_signup_token(signup_token)

    try:
        challenge = SignupOTPChallenge.objects.select_for_update().get(email=email)
    except SignupOTPChallenge.DoesNotExist as exc:
        raise SignupOTPError("Signup session expired. Please start again.") from exc

    if challenge.is_consumed() or challenge.is_expired():
        raise SignupOTPError("Verification code expired. Please request a new one.")

    if challenge.verify_attempt_count >= settings.SIGNUP_OTP_MAX_VERIFY_ATTEMPTS:
        raise SignupOTPError("Too many invalid attempts. Please request a new code.")

    if not check_password(otp_code, challenge.otp_hash):
        challenge.verify_attempt_count += 1
        challenge.save(update_fields=["verify_attempt_count", "updated_at"])
        raise SignupOTPError("Invalid verification code.")

    if User.objects.filter(email__iexact=email).exists():
        challenge.consumed_at = timezone.now()
        challenge.save(update_fields=["consumed_at", "updated_at"])
        raise SignupOTPError("An account with this email already exists.")

    try:
        user = User.objects.create(
            username=_generate_signup_username(email),
            email=email,
            password=challenge.password_hash,
            first_name=challenge.first_name,
            last_name=challenge.last_name,
        )
    except IntegrityError as exc:
        raise SignupOTPError("An account with this email already exists.") from exc
    user.profile.phone = challenge.phone
    user.profile.save()

    challenge.consumed_at = timezone.now()
    challenge.save(update_fields=["consumed_at", "updated_at"])
    _audit_identity_event("signup_verified", user_id=user.id, email=email)

    return user


def find_user_by_normalized_email(email):
    normalized_email = normalize_email_address(email)
    if not normalized_email:
        return None

    users = list(User.objects.filter(email__iexact=normalized_email).order_by("id")[:2])
    if len(users) > 1:
        raise SignupOTPError(
            "Multiple accounts are associated with this email. Please contact support.",
            status_code=409,
        )
    return users[0] if users else None


@transaction.atomic
def resolve_google_user(*, email, email_verified, provider_user_id, metadata=None):
    normalized_email = normalize_email_address(email)
    if not email_verified:
        raise SignupOTPError("Google email is not verified.")

    metadata = metadata or {}
    now = timezone.now()

    try:
        identity = (
            UserAuthIdentity.objects.select_for_update()
            .select_related("user")
            .get(
                provider=UserAuthIdentity.PROVIDER_GOOGLE,
                provider_user_id=provider_user_id,
            )
        )
    except UserAuthIdentity.DoesNotExist:
        identity = None

    if identity is not None:
        updates = []
        if identity.email_normalized != normalized_email:
            identity.email_normalized = normalized_email
            updates.append("email_normalized")
        identity.email_verified_at = identity.email_verified_at or now
        identity.last_login_at = now
        identity.metadata = {
            **identity.metadata,
            **metadata,
        }
        updates.extend(["email_verified_at", "last_login_at", "metadata", "updated_at"])
        identity.save(update_fields=updates)
        _audit_identity_event(
            "provider_login",
            provider=identity.provider,
            provider_user_id=provider_user_id,
            user_id=identity.user_id,
            email=normalized_email,
        )
        return identity.user, False, False

    user = find_user_by_normalized_email(normalized_email)
    created = False
    linked_existing = user is not None

    if user is None:
        try:
            user = User.objects.create(
                username=_generate_signup_username(normalized_email),
                email=normalized_email,
                first_name=metadata.get("given_name", ""),
                last_name=metadata.get("family_name", ""),
            )
            user.set_unusable_password()
            user.save(update_fields=["password"])
        except IntegrityError:
            user = find_user_by_normalized_email(normalized_email)
            if user is None:
                raise
        else:
            created = True
            _audit_identity_event("user_created", user_id=user.id, email=normalized_email, source="google")

    try:
        UserAuthIdentity.objects.create(
            user=user,
            provider=UserAuthIdentity.PROVIDER_GOOGLE,
            provider_user_id=provider_user_id,
            email_normalized=normalized_email,
            email_verified_at=now,
            last_login_at=now,
            metadata=metadata,
        )
    except IntegrityError:
        identity = (
            UserAuthIdentity.objects.select_for_update()
            .select_related("user")
            .get(
                provider=UserAuthIdentity.PROVIDER_GOOGLE,
                provider_user_id=provider_user_id,
            )
        )
        user = identity.user
        linked_existing = False
        created = False
    else:
        _audit_identity_event(
            "provider_linked",
            provider=UserAuthIdentity.PROVIDER_GOOGLE,
            provider_user_id=provider_user_id,
            user_id=user.id,
            email=normalized_email,
            linked_existing=linked_existing,
        )

    return user, created, linked_existing


def revoke_other_user_sessions(*, user, current_refresh_token=None):
    current_jti = None

    if current_refresh_token:
        try:
            current_jti = RefreshToken(current_refresh_token)["jti"]
        except Exception:
            current_jti = None

    outstanding_tokens = OutstandingToken.objects.filter(user=user)

    revoked_count = 0
    for token in outstanding_tokens:
        if current_jti and token.jti == current_jti:
            continue

        _, created = BlacklistedToken.objects.get_or_create(token=token)
        if created:
            revoked_count += 1

    _audit_identity_event(
        "sessions_revoked",
        user_id=user.id,
        revoked_count=revoked_count,
        preserved_current=bool(current_jti),
    )
    return revoked_count
