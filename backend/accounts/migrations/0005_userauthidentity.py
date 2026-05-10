from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0004_signupotpchallenge"),
    ]

    operations = [
        migrations.CreateModel(
            name="UserAuthIdentity",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("provider", models.CharField(choices=[("google", "Google")], max_length=32)),
                ("provider_user_id", models.CharField(max_length=255)),
                ("email_normalized", models.EmailField(max_length=254)),
                ("email_verified_at", models.DateTimeField(blank=True, null=True)),
                ("linked_at", models.DateTimeField(auto_now_add=True)),
                ("last_login_at", models.DateTimeField(blank=True, null=True)),
                ("metadata", models.JSONField(blank=True, default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("user", models.ForeignKey(on_delete=models.deletion.CASCADE, related_name="auth_identities", to="auth.user")),
            ],
            options={
                "ordering": ("provider", "linked_at"),
            },
        ),
        migrations.AddConstraint(
            model_name="userauthidentity",
            constraint=models.UniqueConstraint(fields=("provider", "provider_user_id"), name="accounts_auth_identity_provider_uid_uniq"),
        ),
        migrations.AddIndex(
            model_name="userauthidentity",
            index=models.Index(fields=("user", "provider"), name="acct_auth_user_prov_idx"),
        ),
        migrations.AddIndex(
            model_name="userauthidentity",
            index=models.Index(fields=("email_normalized",), name="acct_auth_email_idx"),
        ),
    ]
