from datetime import timedelta

from django.conf import settings
from django.apps import apps
from django.core.files.storage import default_storage
from django.utils import timezone


MEDIA_PURGE_ORDER_STATUSES = ("delivered", "failed", "cancelled")
MEDIA_CLEANUP_TASK_SCOPE_ORDER = "order_customization"
MEDIA_CLEANUP_TASK_SCOPE_PRODUCT = "product_media"


ALL_MEDIA_REFERENCE_SPECS = (
    ("products", "Category", "image"),
    ("products", "Banner", "image"),
    ("products", "SubCategory", "image"),
    ("products", "Product", "image"),
    ("products", "ProductImage", "image"),
    ("orders", "CartItem", "custom_image"),
    ("orders", "CartItemImage", "image"),
    ("orders", "OrderItem", "custom_image"),
    ("orders", "OrderItemImage", "image"),
)

ORDER_CUSTOMIZATION_REFERENCE_SPECS = (
    ("orders", "CartItem", "custom_image"),
    ("orders", "CartItemImage", "image"),
    ("orders", "OrderItem", "custom_image"),
    ("orders", "OrderItemImage", "image"),
)


def normalize_media_name(file_name):
    if not file_name:
        return ""

    normalized = str(file_name).strip().lstrip("/")
    return normalized


def get_media_retention_days():
    return max(int(getattr(settings, "ORDER_CUSTOMIZATION_MEDIA_RETENTION_DAYS", 7)), 0)


def iter_reference_specs(specs=None):
    for app_label, model_name, field_name in specs or ALL_MEDIA_REFERENCE_SPECS:
        yield apps.get_model(app_label, model_name), field_name


def is_file_referenced(file_name, *, exclude_instance=None, specs=None):
    normalized_name = normalize_media_name(file_name)
    if not normalized_name:
        return False

    for model, field_name in iter_reference_specs(specs=specs):
        queryset = model._default_manager.filter(**{field_name: normalized_name})
        if exclude_instance is not None and isinstance(exclude_instance, model):
            queryset = queryset.exclude(pk=exclude_instance.pk)
        if queryset.exists():
            return True

    return False


def delete_file_if_unreferenced(file_name, *, exclude_instance=None, specs=None):
    normalized_name = normalize_media_name(file_name)
    if not normalized_name:
        return False

    if is_file_referenced(
        normalized_name,
        exclude_instance=exclude_instance,
        specs=specs,
    ):
        return False

    default_storage.delete(normalized_name)
    return True


def schedule_file_deletion(file_name, *, scope, days=None):
    normalized_name = normalize_media_name(file_name)
    if not normalized_name:
        return None

    MediaCleanupTask = apps.get_model("orders", "MediaCleanupTask")
    retention_days = get_media_retention_days() if days is None else max(int(days), 0)
    delete_after = timezone.now() + timedelta(days=retention_days)
    task, _ = MediaCleanupTask.objects.get_or_create(
        file_name=normalized_name,
        scope=scope,
        deleted_at__isnull=True,
        defaults={"delete_after": delete_after},
    )
    if task.delete_after > delete_after:
        task.delete_after = delete_after
        task.save(update_fields=["delete_after"])
    return task


def process_scheduled_media_cleanup(*, limit=500):
    MediaCleanupTask = apps.get_model("orders", "MediaCleanupTask")
    now = timezone.now()
    tasks = list(
        MediaCleanupTask.objects.filter(
            deleted_at__isnull=True,
            delete_after__lte=now,
        ).order_by("delete_after", "id")[: max(limit, 1)]
    )

    deleted_count = 0
    for task in tasks:
        specs = (
            ORDER_CUSTOMIZATION_REFERENCE_SPECS
            if task.scope == MEDIA_CLEANUP_TASK_SCOPE_ORDER
            else ALL_MEDIA_REFERENCE_SPECS
        )
        if delete_file_if_unreferenced(task.file_name, specs=specs):
            deleted_count += 1
        task.deleted_at = now
        task.save(update_fields=["deleted_at"])

    return {"processed": len(tasks), "deleted": deleted_count}


def clear_file_field(instance, field_name, *, specs=None):
    field_file = getattr(instance, field_name, None)
    file_name = normalize_media_name(getattr(field_file, "name", field_file))
    if not file_name or not instance.pk:
        return False

    instance.__class__._default_manager.filter(pk=instance.pk).update(**{field_name: ""})
    setattr(instance, field_name, None)
    delete_file_if_unreferenced(
        file_name,
        specs=specs,
    )
    return True


def purge_order_customization_media(order, *, delete_after_days=0):
    prefetched_items = order.items.prefetch_related("custom_images")
    media_removed = False

    for item in prefetched_items:
        custom_image_name = normalize_media_name(
            getattr(item.custom_image, "name", item.custom_image)
        )
        if clear_file_field(
            item,
            "custom_image",
            specs=ORDER_CUSTOMIZATION_REFERENCE_SPECS,
        ):
            schedule_file_deletion(
                custom_image_name,
                scope=MEDIA_CLEANUP_TASK_SCOPE_ORDER,
                days=delete_after_days,
            )
            media_removed = True

        for related_image in list(item.custom_images.all()):
            file_name = normalize_media_name(getattr(related_image.image, "name", related_image.image))
            related_image.delete()
            schedule_file_deletion(
                file_name,
                scope=MEDIA_CLEANUP_TASK_SCOPE_ORDER,
                days=delete_after_days,
            )
            media_removed = True

    purged_at = timezone.now()
    order.__class__._default_manager.filter(pk=order.pk).update(
        customization_media_purged_at=purged_at,
        updated_at=purged_at,
    )
    order.customization_media_purged_at = purged_at
    return media_removed
