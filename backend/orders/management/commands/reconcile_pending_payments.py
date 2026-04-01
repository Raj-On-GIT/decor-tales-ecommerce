from django.core.management.base import BaseCommand

from orders.payment_services import reconcile_stale_orders


class Command(BaseCommand):
    help = "Reconcile pending or failed orders against Razorpay."

    def add_arguments(self, parser):
        parser.add_argument("--limit", type=int, default=50)

    def handle(self, *args, **options):
        reconciled = reconcile_stale_orders(limit=options["limit"])
        self.stdout.write(self.style.SUCCESS(f"Reconciled {reconciled} order(s)."))
