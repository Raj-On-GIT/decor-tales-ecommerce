from django.conf import settings
from django.db.models.signals import post_delete, post_save, pre_save
from django.dispatch import receiver

from products.models import Banner, Category, Product, ProductImage, SubCategory

from .models import CartItem, CartItemImage, Order, OrderItem, OrderItemImage
from utils.media_cleanup import (
    ALL_MEDIA_REFERENCE_SPECS,
    MEDIA_PURGE_ORDER_STATUSES,
    delete_file_if_unreferenced,
    purge_order_customization_media,
    schedule_file_deletion,
    MEDIA_CLEANUP_TASK_SCOPE_PRODUCT,
)


TRACKED_FILE_FIELDS = {
    Category: ("image",),
    Banner: ("image",),
    SubCategory: ("image",),
    Product: ("image",),
    ProductImage: ("image",),
    CartItem: ("custom_image",),
    CartItemImage: ("image",),
    OrderItem: ("custom_image",),
    OrderItemImage: ("image",),
}


def _get_previous_instance(sender, instance):
    if not instance.pk:
        return None
    return sender._default_manager.filter(pk=instance.pk).first()


@receiver(pre_save, sender=Category)
@receiver(pre_save, sender=Banner)
@receiver(pre_save, sender=SubCategory)
@receiver(pre_save, sender=Product)
@receiver(pre_save, sender=ProductImage)
@receiver(pre_save, sender=CartItem)
@receiver(pre_save, sender=CartItemImage)
@receiver(pre_save, sender=OrderItem)
@receiver(pre_save, sender=OrderItemImage)
def delete_replaced_media_files(sender, instance, **kwargs):
    previous_instance = _get_previous_instance(sender, instance)
    if previous_instance is None:
        return

    for field_name in TRACKED_FILE_FIELDS.get(sender, ()):
        previous_file = getattr(previous_instance, field_name, None)
        current_file = getattr(instance, field_name, None)
        previous_name = getattr(previous_file, "name", previous_file)
        current_name = getattr(current_file, "name", current_file)

        if previous_name and previous_name != current_name:
            delete_file_if_unreferenced(
                previous_name,
                exclude_instance=instance,
                specs=ALL_MEDIA_REFERENCE_SPECS,
            )


@receiver(post_delete, sender=Category)
@receiver(post_delete, sender=Banner)
@receiver(post_delete, sender=SubCategory)
@receiver(post_delete, sender=Product)
@receiver(post_delete, sender=ProductImage)
@receiver(post_delete, sender=CartItem)
@receiver(post_delete, sender=CartItemImage)
@receiver(post_delete, sender=OrderItem)
@receiver(post_delete, sender=OrderItemImage)
def delete_orphaned_media_files(sender, instance, **kwargs):
    for field_name in TRACKED_FILE_FIELDS.get(sender, ()):
        field_file = getattr(instance, field_name, None)
        file_name = getattr(field_file, "name", field_file)
        if sender in {Product, ProductImage}:
            schedule_file_deletion(
                file_name,
                scope=MEDIA_CLEANUP_TASK_SCOPE_PRODUCT,
            )
            continue
        delete_file_if_unreferenced(
            file_name,
            specs=ALL_MEDIA_REFERENCE_SPECS,
        )


@receiver(pre_save, sender=Order)
def mark_order_for_customization_media_purge(sender, instance, **kwargs):
    if not instance.pk:
        return

    previous_order = _get_previous_instance(sender, instance)
    if previous_order is None:
        return

    entered_purgeable_status = (
        previous_order.status not in MEDIA_PURGE_ORDER_STATUSES
        and instance.status in MEDIA_PURGE_ORDER_STATUSES
    )
    if not entered_purgeable_status:
        return

    if instance.status == "delivered" and not instance.payment_processed:
        return

    if previous_order.customization_media_purged_at:
        return

    if getattr(settings, "ORDER_CUSTOMIZATION_MEDIA_RETENTION_DAYS", 7) > 0:
        return

    instance._purge_customization_media_after_save = True


@receiver(post_save, sender=Order)
def purge_order_customization_media_when_delivered(sender, instance, **kwargs):
    if not getattr(instance, "_purge_customization_media_after_save", False):
        return

    instance._purge_customization_media_after_save = False
    purge_order_customization_media(instance)
