from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("orders", "0020_order_delhivery_tracking_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="order",
            name="customization_media_purged_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
