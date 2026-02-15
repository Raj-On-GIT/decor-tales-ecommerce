from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('products', '0023_product_created_at'),
    ]

    operations = [
        migrations.CreateModel(
            name='ProductActivity',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('event_type', models.CharField(
                    choices=[('view', 'View'), ('cart_add', 'Cart Add')],
                    max_length=20,
                )),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('product', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='activities',
                    to='products.product',
                )),
            ],
            options={
                'indexes': [
                    models.Index(
                        fields=['product', 'event_type', 'created_at'],
                        name='products_pr_product_idx',
                    ),
                ],
            },
        ),
    ]