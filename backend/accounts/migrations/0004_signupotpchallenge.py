from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0003_remove_userprofile_avatar"),
    ]

    operations = [
        migrations.CreateModel(
            name="SignupOTPChallenge",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("email", models.EmailField(max_length=254, unique=True)),
                ("first_name", models.CharField(blank=True, max_length=150)),
                ("last_name", models.CharField(blank=True, max_length=150)),
                ("phone", models.CharField(max_length=20)),
                ("password_hash", models.CharField(max_length=128)),
                ("otp_hash", models.CharField(max_length=128)),
                ("send_count", models.PositiveSmallIntegerField(default=0)),
                ("verify_attempt_count", models.PositiveSmallIntegerField(default=0)),
                ("last_sent_at", models.DateTimeField(blank=True, null=True)),
                ("expires_at", models.DateTimeField()),
                ("consumed_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "ordering": ("-updated_at",),
            },
        ),
    ]
