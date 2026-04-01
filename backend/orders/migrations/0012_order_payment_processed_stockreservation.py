from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("orders", "0011_order_payment_fields"),
        ("products", "0028_alter_category_id_alter_color_id_alter_product_id_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="order",
            name="payment_processed",
            field=models.BooleanField(default=False),
        ),
        migrations.CreateModel(
            name="StockReservation",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("quantity", models.PositiveIntegerField()),
                ("reserved_until", models.DateTimeField()),
                ("consumed_at", models.DateTimeField(blank=True, null=True)),
                ("released_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "order",
                    models.ForeignKey(
                        on_delete=models.deletion.CASCADE,
                        related_name="stock_reservations",
                        to="orders.order",
                    ),
                ),
                (
                    "product",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=models.deletion.CASCADE,
                        to="products.product",
                    ),
                ),
                (
                    "variant",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=models.deletion.CASCADE,
                        to="products.productvariant",
                    ),
                ),
            ],
            options={
                "ordering": ["id"],
            },
        ),
    ]
