from django.core.management.base import BaseCommand

from orders.payment_services import release_expired_reservations


class Command(BaseCommand):
    help = "Release expired stock reservations for unpaid orders."

    def handle(self, *args, **options):
        released = release_expired_reservations()
        self.stdout.write(self.style.SUCCESS(f"Released {released} expired reservation(s)."))
