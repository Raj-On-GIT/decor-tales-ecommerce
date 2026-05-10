from django.core.exceptions import ValidationError
from django.core.validators import validate_email


def normalize_email_address(value):
    email = (value or "").strip().lower()

    if not email:
        return ""

    validate_email(email)
    return email


def emails_match(left, right):
    try:
        return normalize_email_address(left) == normalize_email_address(right)
    except ValidationError:
        return False
