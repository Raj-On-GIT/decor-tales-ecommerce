import django.db.models.deletion
from django.db import migrations, models


def migrate_existing_custom_images(apps, schema_editor):
    CartItem = apps.get_model("orders", "CartItem")
    CartItemImage = apps.get_model("orders", "CartItemImage")
    OrderItem = apps.get_model("orders", "OrderItem")
    OrderItemImage = apps.get_model("orders", "OrderItemImage")

    for cart_item in CartItem.objects.exclude(custom_image="").exclude(custom_image__isnull=True):
        CartItemImage.objects.get_or_create(
            cart_item=cart_item,
            image=cart_item.custom_image.name,
        )

    for order_item in OrderItem.objects.exclude(custom_image="").exclude(custom_image__isnull=True):
        OrderItemImage.objects.get_or_create(
            order_item=order_item,
            image=order_item.custom_image.name,
        )


class Migration(migrations.Migration):

    dependencies = [
        ("orders", "0005_orderitem_custom_image_orderitem_custom_text"),
    ]

    operations = [
        migrations.CreateModel(
            name="CartItemImage",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("image", models.ImageField(upload_to="custom_orders/")),
                (
                    "cart_item",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="custom_images", to="orders.cartitem"),
                ),
            ],
            options={
                "ordering": ["id"],
            },
        ),
        migrations.CreateModel(
            name="OrderItemImage",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("image", models.ImageField(upload_to="order_customizations/")),
                (
                    "order_item",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="custom_images", to="orders.orderitem"),
                ),
            ],
            options={
                "ordering": ["id"],
            },
        ),
        migrations.RunPython(migrate_existing_custom_images, migrations.RunPython.noop),
    ]
