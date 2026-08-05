from cloudinary.utils import cloudinary_url
from django.conf import settings


# These are delivery-only transformations. Cloudinary keeps the uploaded
# original intact and creates/caches an appropriately sized browser version.
MEDIA_PRESETS = {
    "catalog": {"width": 1600, "crop": "limit"},
    "category": {"width": 960, "crop": "limit"},
    "banner": {"width": 2000, "crop": "limit"},
}


def normalize_media_name(file_name):
    if not file_name:
        return file_name

    normalized = str(file_name).lstrip("/")
    if normalized.startswith("media/"):
        return normalized[len("media/") :]

    return normalized


def build_media_url(file_field, *, preset="catalog"):
    if not file_field:
        return None

    try:
        if getattr(settings, "USE_CLOUDINARY", False):
            stored_name = str(getattr(file_field, "name", "")).lstrip("/")
            if stored_name:
                # Use the exact stored public_id/path from the database.
                # Older records may be stored as "products/..." while newer
                # ones may be stored as "media/products/...".
                return cloudinary_url(
                    stored_name,
                    resource_type="image",
                    secure=True,
                    quality="auto",
                    fetch_format="auto",
                    **MEDIA_PRESETS.get(preset, MEDIA_PRESETS["catalog"]),
                )[0]

        return file_field.url
    except Exception:
        return None
