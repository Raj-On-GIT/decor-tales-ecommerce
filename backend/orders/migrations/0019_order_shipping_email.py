from django.db import migrations, models


def backfill_order_shipping_email(apps, schema_editor):
    Order = apps.get_model("orders", "Order")

    for order in Order.objects.select_related("user").all():
        email = getattr(order.user, "email", "") or ""
        if order.shipping_email == email:
            continue
        order.shipping_email = email
        order.save(update_fields=["shipping_email"])


class Migration(migrations.Migration):

    dependencies = [
        ("orders", "0018_order_delhivery_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="order",
            name="shipping_email",
            field=models.EmailField(blank=True, max_length=254),
        ),
        migrations.RunPython(
            backfill_order_shipping_email,
            migrations.RunPython.noop,
        ),
    ]
