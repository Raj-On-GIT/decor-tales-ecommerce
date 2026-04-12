from django.db import migrations, models


def backfill_cart_item_variant_snapshots(apps, schema_editor):
    CartItem = apps.get_model("orders", "CartItem")

    for item in CartItem.objects.select_related("variant", "variant__size", "variant__color"):
        variant = getattr(item, "variant", None)
        if not variant:
            continue

        size_name = variant.size.name if getattr(variant, "size", None) else ""
        color_name = variant.color.name if getattr(variant, "color", None) else ""
        sku = variant.sku or ""

        if (
            item.variant_size_name == size_name
            and item.variant_color_name == color_name
            and item.variant_sku == sku
        ):
            continue

        item.variant_size_name = size_name
        item.variant_color_name = color_name
        item.variant_sku = sku
        item.save(
            update_fields=[
                "variant_size_name",
                "variant_color_name",
                "variant_sku",
            ]
        )


class Migration(migrations.Migration):

    dependencies = [
        ("orders", "0016_cartitem_variant_set_null"),
    ]

    operations = [
        migrations.AddField(
            model_name="cartitem",
            name="variant_color_name",
            field=models.CharField(blank=True, max_length=100),
        ),
        migrations.AddField(
            model_name="cartitem",
            name="variant_size_name",
            field=models.CharField(blank=True, max_length=100),
        ),
        migrations.AddField(
            model_name="cartitem",
            name="variant_sku",
            field=models.CharField(blank=True, max_length=100),
        ),
        migrations.RunPython(
            backfill_cart_item_variant_snapshots,
            migrations.RunPython.noop,
        ),
    ]
