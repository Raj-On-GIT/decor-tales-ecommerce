from decimal import Decimal
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ("products", "0027_banner"),
        ("orders", "0009_alter_cart_id_alter_cartitem_id_and_more"),
    ]

    operations = [
        migrations.CreateModel(
            name="Coupon",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("code", models.CharField(max_length=50, unique=True)),
                ("title", models.CharField(max_length=120)),
                ("description", models.TextField(blank=True)),
                ("discount_type", models.CharField(choices=[("percent", "Percentage"), ("fixed", "Fixed amount")], max_length=20)),
                ("discount_value", models.DecimalField(decimal_places=2, max_digits=10)),
                ("min_order_amount", models.DecimalField(decimal_places=2, default=Decimal("0.00"), max_digits=10)),
                ("max_discount_amount", models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True)),
                ("usage_limit", models.PositiveIntegerField(blank=True, null=True)),
                ("usage_limit_per_user", models.PositiveIntegerField(blank=True, null=True)),
                ("first_order_only", models.BooleanField(default=False)),
                ("is_active", models.BooleanField(default=True)),
                ("start_date", models.DateTimeField(default=django.utils.timezone.now)),
                ("end_date", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("categories", models.ManyToManyField(blank=True, related_name="coupons", to="products.category")),
                ("subcategories", models.ManyToManyField(blank=True, related_name="coupons", to="products.subcategory")),
            ],
            options={"ordering": ["code"]},
        ),
        migrations.AddField(
            model_name="order",
            name="coupon_code",
            field=models.CharField(blank=True, max_length=50),
        ),
        migrations.AddField(
            model_name="order",
            name="discount_amount",
            field=models.DecimalField(decimal_places=2, default=Decimal("0.00"), max_digits=10),
        ),
        migrations.AddField(
            model_name="order",
            name="subtotal_amount",
            field=models.DecimalField(decimal_places=2, default=Decimal("0.00"), max_digits=10),
        ),
        migrations.CreateModel(
            name="CouponUsage",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("discount_amount", models.DecimalField(decimal_places=2, max_digits=10)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("coupon", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="usages", to="orders.coupon")),
                ("order", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="coupon_usages", to="orders.order")),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="coupon_usages", to="auth.user")),
            ],
            options={
                "ordering": ["-created_at"],
                "unique_together": {("coupon", "order")},
            },
        ),
    ]
