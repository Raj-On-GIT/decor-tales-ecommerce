from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0005_userauthidentity"),
    ]

    operations = [
        migrations.RunSQL(
            sql=(
                "CREATE UNIQUE INDEX auth_user_email_uniq_nblank "
                "ON auth_user (email) "
                "WHERE email <> '';"
            ),
            reverse_sql="DROP INDEX IF EXISTS auth_user_email_uniq_nblank;",
        ),
    ]
