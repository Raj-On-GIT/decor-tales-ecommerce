from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("orders", "0013_alter_coupon_discount_value_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="order",
            name="refund_processed",
            field=models.BooleanField(default=False),
        ),
    ]
