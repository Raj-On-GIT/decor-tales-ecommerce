import secrets
from datetime import timedelta

import requests
from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password
from django.contrib.auth.models import User
from django.core import signing
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from .models import SignupOTPChallenge


SIGNUP_OTP_TOKEN_SALT = "accounts.signup-otp"


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

    email = (payload.get("email") or "").strip().lower()
    if not email:
        raise SignupOTPError("Invalid signup session. Please start again.")
    return email


def issue_signup_otp(validated_data):
    email = validated_data["email"]
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

    user = User.objects.create(
        username=_generate_signup_username(email),
        email=email,
        password=challenge.password_hash,
        first_name=challenge.first_name,
        last_name=challenge.last_name,
    )
    user.profile.phone = challenge.phone
    user.profile.save()

    challenge.consumed_at = timezone.now()
    challenge.save(update_fields=["consumed_at", "updated_at"])

    return user
