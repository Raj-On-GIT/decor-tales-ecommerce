from django.db import migrations, models
import django.db.models.deletion


def backfill_order_item_snapshots(apps, schema_editor):
    OrderItem = apps.get_model("orders", "OrderItem")

    for item in OrderItem.objects.select_related(
        "product",
        "product__category",
        "product__sub_category",
        "variant",
        "variant__size",
        "variant__color",
    ):
        product = item.product
        variant = item.variant

        if product:
            item.product_title = product.title or item.product_title or ""
            item.product_slug = product.slug or item.product_slug or ""
            item.product_image = getattr(product.image, "name", "") or item.product_image or ""
            item.product_category_name = (
                product.category.name if product.category else item.product_category_name or ""
            )
            item.product_category_slug = (
                product.category.slug if product.category else item.product_category_slug or ""
            )
            item.product_sub_category_name = (
                product.sub_category.name
                if product.sub_category
                else item.product_sub_category_name or ""
            )
            item.product_sub_category_slug = (
                product.sub_category.slug
                if product.sub_category
                else item.product_sub_category_slug or ""
            )

        if variant:
            item.variant_size_name = (
                variant.size.name if getattr(variant, "size", None) else item.variant_size_name or ""
            )
            item.variant_color_name = (
                variant.color.name if getattr(variant, "color", None) else item.variant_color_name or ""
            )
            item.variant_sku = variant.sku or item.variant_sku or ""

        item.save(
            update_fields=[
                "product_title",
                "product_slug",
                "product_image",
                "product_category_name",
                "product_category_slug",
                "product_sub_category_name",
                "product_sub_category_slug",
                "variant_size_name",
                "variant_color_name",
                "variant_sku",
            ]
        )


class Migration(migrations.Migration):

    dependencies = [
        ("orders", "0014_order_refund_processed"),
    ]

    operations = [
        migrations.AlterField(
            model_name="orderitem",
            name="product",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                to="products.product",
            ),
        ),
        migrations.AddField(
            model_name="orderitem",
            name="product_category_name",
            field=models.CharField(blank=True, max_length=100),
        ),
        migrations.AddField(
            model_name="orderitem",
            name="product_category_slug",
            field=models.SlugField(blank=True),
        ),
        migrations.AddField(
            model_name="orderitem",
            name="product_image",
            field=models.CharField(blank=True, max_length=500),
        ),
        migrations.AddField(
            model_name="orderitem",
            name="product_slug",
            field=models.SlugField(blank=True),
        ),
        migrations.AddField(
            model_name="orderitem",
            name="product_sub_category_name",
            field=models.CharField(blank=True, max_length=100),
        ),
        migrations.AddField(
            model_name="orderitem",
            name="product_sub_category_slug",
            field=models.SlugField(blank=True),
        ),
        migrations.AddField(
            model_name="orderitem",
            name="product_title",
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name="orderitem",
            name="variant_color_name",
            field=models.CharField(blank=True, max_length=100),
        ),
        migrations.AddField(
            model_name="orderitem",
            name="variant_size_name",
            field=models.CharField(blank=True, max_length=100),
        ),
        migrations.AddField(
            model_name="orderitem",
            name="variant_sku",
            field=models.CharField(blank=True, max_length=100),
        ),
        migrations.RunPython(backfill_order_item_snapshots, migrations.RunPython.noop),
    ]
