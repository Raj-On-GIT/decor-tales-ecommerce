from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("orders", "0021_order_customization_media_purged_at"),
    ]

    operations = [
        migrations.CreateModel(
            name="MediaCleanupTask",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("file_name", models.CharField(db_index=True, max_length=500)),
                ("scope", models.CharField(choices=[("order_customization", "Order Customization"), ("product_media", "Product Media")], max_length=50)),
                ("delete_after", models.DateTimeField(db_index=True)),
                ("deleted_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={
                "ordering": ["delete_after", "id"],
            },
        ),
    ]
