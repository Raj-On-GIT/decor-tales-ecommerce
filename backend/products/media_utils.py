from cloudinary.utils import cloudinary_url
from django.conf import settings


def normalize_media_name(file_name):
    if not file_name:
        return file_name

    normalized = str(file_name).lstrip("/")
    if normalized.startswith("media/"):
        return normalized[len("media/") :]

    return normalized


def build_media_url(file_field):
    if not file_field:
        return None

    try:
        if getattr(settings, "USE_CLOUDINARY", False):
            normalized_name = normalize_media_name(getattr(file_field, "name", ""))
            if normalized_name:
                return cloudinary_url(normalized_name, resource_type="image")[0]

        return file_field.url
    except Exception:
        return None
