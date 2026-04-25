from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("orders", "0017_cartitem_variant_snapshot"),
    ]

    operations = [
        migrations.AddField(
            model_name="order",
            name="delhivery_client_name",
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name="order",
            name="delhivery_created_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="order",
            name="delhivery_payment_mode",
            field=models.CharField(blank=True, max_length=50),
        ),
        migrations.AddField(
            model_name="order",
            name="delhivery_raw_response",
            field=models.JSONField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="order",
            name="delhivery_reference",
            field=models.CharField(blank=True, max_length=120),
        ),
        migrations.AddField(
            model_name="order",
            name="delhivery_shipment_status",
            field=models.CharField(blank=True, max_length=50),
        ),
        migrations.AddField(
            model_name="order",
            name="delhivery_waybill",
            field=models.CharField(blank=True, max_length=120),
        ),
        migrations.AddField(
            model_name="order",
            name="shipping_country",
            field=models.CharField(blank=True, default="India", max_length=100),
        ),
        migrations.AddField(
            model_name="order",
            name="shipping_full_name",
            field=models.CharField(blank=True, max_length=150),
        ),
        migrations.AddField(
            model_name="order",
            name="shipping_state",
            field=models.CharField(blank=True, max_length=100),
        ),
    ]
