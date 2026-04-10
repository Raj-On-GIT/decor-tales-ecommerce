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
            stored_name = str(getattr(file_field, "name", "")).lstrip("/")
            if stored_name:
                # Use the exact stored public_id/path from the database.
                # Older records may be stored as "products/..." while newer
                # ones may be stored as "media/products/...".
                return cloudinary_url(stored_name, resource_type="image")[0]

        return file_field.url
    except Exception:
        return None
