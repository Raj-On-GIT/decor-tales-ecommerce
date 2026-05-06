from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0002_address"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="userprofile",
            name="avatar",
        ),
    ]
