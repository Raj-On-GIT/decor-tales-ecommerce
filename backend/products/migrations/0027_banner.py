from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("products", "0026_alter_category_id_alter_color_id_alter_product_id_and_more"),
    ]

    operations = [
        migrations.CreateModel(
            name="Banner",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("type", models.CharField(choices=[("image", "Image"), ("text", "Text"), ("mixed", "Mixed")], max_length=20)),
                ("title", models.CharField(max_length=255)),
                ("subtitle", models.CharField(blank=True, max_length=255)),
                ("description", models.TextField(blank=True, help_text="Supports HTML content.")),
                ("image", models.ImageField(blank=True, null=True, upload_to="banners/")),
                ("cta_text", models.CharField(blank=True, max_length=120)),
                ("cta_link", models.URLField(blank=True)),
                ("background_color", models.CharField(default="#111827", max_length=20)),
                ("text_color", models.CharField(default="#FFFFFF", max_length=20)),
                ("priority", models.PositiveIntegerField(default=0)),
                ("is_active", models.BooleanField(default=True)),
                ("start_date", models.DateTimeField()),
                ("end_date", models.DateTimeField(blank=True, null=True)),
                ("metadata", models.JSONField(blank=True, default=dict, help_text="Optional payload for countdowns, coupon codes, personalization, and future banner features.")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "ordering": ["priority", "-created_at"],
            },
        ),
    ]
