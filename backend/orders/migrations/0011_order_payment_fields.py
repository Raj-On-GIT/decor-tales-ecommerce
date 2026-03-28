from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("orders", "0010_coupon_couponusage_order_coupon_code_and_more"),
    ]

    operations = [
        migrations.AlterField(
            model_name="order",
            name="status",
            field=models.CharField(
                choices=[
                    ("pending", "Pending"),
                    ("paid", "Paid"),
                    ("failed", "Failed"),
                    ("processing", "Processing"),
                    ("shipped", "Shipped"),
                    ("delivered", "Delivered"),
                    ("cancelled", "Cancelled"),
                ],
                default="pending",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="order",
            name="payment_provider",
            field=models.CharField(default="razorpay", max_length=30),
        ),
        migrations.AddField(
            model_name="order",
            name="payment_verified_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="order",
            name="razorpay_order_id",
            field=models.CharField(blank=True, max_length=120, null=True, unique=True),
        ),
        migrations.AddField(
            model_name="order",
            name="razorpay_payment_id",
            field=models.CharField(blank=True, max_length=120),
        ),
        migrations.AddField(
            model_name="order",
            name="razorpay_signature",
            field=models.CharField(blank=True, max_length=255),
        ),
    ]
