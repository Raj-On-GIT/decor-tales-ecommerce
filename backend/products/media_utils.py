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
            # Trust the storage backend's canonical Cloudinary URL so mixed
            # public_id formats (for example with/without a "media/" prefix)
            # continue to resolve correctly across deployments.
            return file_field.url

        return file_field.url
    except Exception:
        return None
