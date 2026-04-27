from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("orders", "0019_order_shipping_email"),
    ]

    operations = [
        migrations.AddField(
            model_name="order",
            name="delhivery_last_scan_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="order",
            name="delhivery_last_scan_location",
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name="order",
            name="delhivery_tracking_raw_response",
            field=models.JSONField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="order",
            name="delhivery_tracking_status_code",
            field=models.CharField(blank=True, max_length=50),
        ),
        migrations.AddField(
            model_name="order",
            name="delhivery_tracking_status_label",
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name="order",
            name="delhivery_tracking_status_type",
            field=models.CharField(blank=True, max_length=50),
        ),
        migrations.AddField(
            model_name="order",
            name="delhivery_tracking_synced_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
