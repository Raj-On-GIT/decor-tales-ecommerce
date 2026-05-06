from io import BytesIO
from pathlib import Path

from django.core.files.uploadedfile import InMemoryUploadedFile
from django.utils.html import strip_tags
from PIL import Image, ImageOps, UnidentifiedImageError
from rest_framework import serializers


ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
ALLOWED_IMAGE_MIME_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
}
PILLOW_FORMAT_BY_EXTENSION = {
    ".jpg": "JPEG",
    ".jpeg": "JPEG",
    ".png": "PNG",
    ".webp": "WEBP",
}
CONTENT_TYPE_BY_FORMAT = {
    "JPEG": "image/jpeg",
    "PNG": "image/png",
    "WEBP": "image/webp",
}


def _normalize_image_mode(image, target_format):
    if target_format == "JPEG":
        # JPEG does not support alpha, so flatten transparent uploads safely.
        if image.mode in ("RGBA", "LA") or (
            image.mode == "P" and "transparency" in image.info
        ):
            flattened = Image.new("RGB", image.size, (255, 255, 255))
            flattened.paste(image.convert("RGBA"), mask=image.convert("RGBA").split()[-1])
            return flattened
        return image.convert("RGB")

    if image.mode in ("RGBA", "LA"):
        return image.convert("RGBA")

    if image.mode == "P":
        return image.convert("RGBA")

    return image


def _sanitize_image_upload(
    file,
    *,
    max_file_size,
    max_width,
    max_height,
    resize_to=None,
):
    if not file:
        return file

    extension = Path(file.name or "").suffix.lower()
    if extension not in ALLOWED_IMAGE_EXTENSIONS:
        raise serializers.ValidationError(
            "Unsupported file extension. Allowed formats: jpg, jpeg, png, webp."
        )

    content_type = (getattr(file, "content_type", "") or "").lower()
    if content_type not in ALLOWED_IMAGE_MIME_TYPES:
        raise serializers.ValidationError(
            "Unsupported image MIME type. Allowed types: image/jpeg, image/png, image/webp."
        )

    if file.size > max_file_size:
        raise serializers.ValidationError(
            f"Image size must be {max_file_size // (1024 * 1024)}MB or smaller."
        )

    raw_bytes = file.read()
    file.seek(0)

    try:
        with Image.open(BytesIO(raw_bytes)) as probe_image:
            probe_image.verify()
    except (UnidentifiedImageError, OSError, ValueError):
        raise serializers.ValidationError("Uploaded file is not a valid image.")

    try:
        with Image.open(BytesIO(raw_bytes)) as opened_image:
            image = ImageOps.exif_transpose(opened_image)
            image.load()
    except (UnidentifiedImageError, OSError, ValueError):
        raise serializers.ValidationError("Uploaded file is not a valid image.")

    if image.width > max_width or image.height > max_height:
        raise serializers.ValidationError(
            f"Image dimensions must not exceed {max_width}x{max_height} pixels."
        )

    if resize_to:
        # Reduce oversized avatars to a safe display/storage size without upscaling.
        image.thumbnail((resize_to, resize_to), Image.Resampling.LANCZOS)

    target_format = PILLOW_FORMAT_BY_EXTENSION[extension]
    image = _normalize_image_mode(image, target_format)

    output = BytesIO()
    save_kwargs = {}
    if target_format in {"JPEG", "WEBP"}:
        save_kwargs["quality"] = 90
    image.save(output, format=target_format, **save_kwargs)
    output.seek(0)

    sanitized_size = output.getbuffer().nbytes
    if sanitized_size > max_file_size:
        raise serializers.ValidationError(
            f"Processed image size must be {max_file_size // (1024 * 1024)}MB or smaller."
        )

    return InMemoryUploadedFile(
        file=output,
        field_name=getattr(file, "field_name", None),
        name=f"{Path(file.name).stem}{extension}",
        content_type=CONTENT_TYPE_BY_FORMAT[target_format],
        size=sanitized_size,
        charset=None,
    )


def validate_custom_image(file):
    """
    Validate and sanitize order customization images only.

    - Caps file size at 5MB
    - Allows jpg/jpeg/png/webp
    - Verifies MIME type, extension, and actual image contents
    - Rejects images above 4096x4096
    - Strips metadata by re-saving the image
    """
    return _sanitize_image_upload(
        file,
        max_file_size=5 * 1024 * 1024,
        max_width=4096,
        max_height=4096,
    )


def validate_custom_text(text):
    """
    Normalize and validate customization text only.

    - Strips HTML tags to avoid XSS in stored/displayed text
    - Trims surrounding whitespace
    - Rejects blank or whitespace-only content
    - Enforces a 300 character limit
    """
    if text is None:
        return None

    cleaned_text = strip_tags(str(text)).strip()
    if not cleaned_text:
        raise serializers.ValidationError("Custom text cannot be empty.")

    if len(cleaned_text) > 300:
        raise serializers.ValidationError("Custom text cannot exceed 300 characters.")

    return cleaned_text
