from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("products", "0028_alter_category_id_alter_color_id_alter_product_id_and_more"),
    ]

    operations = [
        migrations.AlterField(
            model_name="product",
            name="stock",
            field=models.PositiveIntegerField(
                default=10,
                help_text="Only used if stock_type is 'main'",
            ),
        ),
        migrations.AlterField(
            model_name="productvariant",
            name="stock",
            field=models.PositiveIntegerField(default=10),
        ),
    ]
