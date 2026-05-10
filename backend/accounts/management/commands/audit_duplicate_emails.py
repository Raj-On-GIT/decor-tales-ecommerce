from django.contrib.auth.models import User
from django.core.management.base import BaseCommand
from django.db.models import Count
from django.db.models.functions import Lower


class Command(BaseCommand):
    help = "Audit duplicate user emails case-insensitively before uniqueness enforcement."

    def handle(self, *args, **options):
        duplicate_groups = (
            User.objects.exclude(email="")
            .annotate(email_normalized=Lower("email"))
            .values("email_normalized")
            .annotate(user_count=Count("id"))
            .filter(user_count__gt=1)
            .order_by("email_normalized")
        )

        group_count = 0
        affected_users = 0

        for group in duplicate_groups:
            group_count += 1
            users = User.objects.filter(email__iexact=group["email_normalized"]).order_by("id")
            affected_users += users.count()

            self.stdout.write(
                self.style.WARNING(
                    f"duplicate_email email={group['email_normalized']} count={group['user_count']}"
                )
            )
            for user in users:
                self.stdout.write(
                    f"  user_id={user.id} username={user.username} is_active={user.is_active} date_joined={user.date_joined.isoformat()}"
                )

        if group_count == 0:
            self.stdout.write(self.style.SUCCESS("No duplicate emails found."))
            return

        self.stdout.write(
            self.style.WARNING(
                f"Found {group_count} duplicate email groups affecting {affected_users} users."
            )
        )
