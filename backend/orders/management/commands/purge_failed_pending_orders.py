import logging
from datetime import timedelta

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from orders.models import Order
from orders.payment_services import reconcile_order_payment

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = (
        "Permanently delete failed or pending orders that were never paid, "
        "never shipped, and are older than the configured retention window. "
        "Pending orders with a payment id are reconciled against Razorpay "
        "first and skipped if they turn out to be paid."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--days",
            type=int,
            default=None,
            help="Retention window in days before an order is purged.",
        )
        parser.add_argument(
            "--limit",
            type=int,
            default=200,
            help="Maximum number of orders to process in one run.",
        )
        parser.add_argument(
            "--no-reconcile",
            action="store_true",
            help="Do not call Razorpay to reconcile pending payments. "
            "Pending orders with a payment id are then always skipped.",
        )

    def handle(self, *args, **options):
        retention_days = options["days"]
        if retention_days is None:
            retention_days = getattr(
                settings, "FAILED_PENDING_ORDER_RETENTION_DAYS", 7
            )

        cutoff = timezone.now() - timedelta(days=max(retention_days, 0))
        queryset = (
            Order.objects.filter(
                status__in=["pending", "failed"],
                payment_processed=False,
                delhivery_waybill="",
                created_at__lte=cutoff,
            )
            .order_by("created_at")[: max(options["limit"], 1)]
        )

        deleted = 0
        skipped = 0
        for order in queryset:
            if not self._is_safe_to_delete(order, reconcile=not options["no_reconcile"]):
                skipped += 1
                continue

            order_id = order.id
            order_number = order.order_number
            try:
                with transaction.atomic():
                    order.delete()
            except Exception as exc:
                logger.exception(
                    "Failed to purge order_id=%s order_number=%s error=%s",
                    order_id,
                    order_number,
                    str(exc),
                )
                self.stderr.write(
                    self.style.ERROR(
                        f"Failed to purge order {order_number}: {exc}"
                    )
                )
                continue

            deleted += 1
            logger.info(
                "Purged order_id=%s order_number=%s total=%s razorpay_order_id=%s created_at=%s",
                order_id,
                order_number,
                order.total_amount,
                order.razorpay_order_id or "",
                order.created_at,
            )
            self.stdout.write(f"Deleted order {order_number} (id={order_id}).")

        self.stdout.write(
            self.style.SUCCESS(
                f"Processed {deleted + skipped} order(s); deleted {deleted}, "
                f"skipped {skipped}."
            )
        )

    def _is_safe_to_delete(self, order, *, reconcile):
        if order.status == "pending" and order.razorpay_payment_id:
            if not reconcile:
                logger.info(
                    "Skipping pending order_id=%s order_number=%s reason=no_reconcile",
                    order.id,
                    order.order_number,
                )
                return False

            try:
                reconcile_order_payment(order)
            except ImproperlyConfigured:
                logger.warning(
                    "Skipping pending order_id=%s order_number=%s "
                    "reason=razorpay_unavailable",
                    order.id,
                    order.order_number,
                )
                return False
            except Exception as exc:
                logger.warning(
                    "Skipping pending order_id=%s order_number=%s "
                    "reason=reconcile_error error=%s",
                    order.id,
                    order.order_number,
                    str(exc),
                )
                return False

            if order.payment_processed:
                logger.info(
                    "Skipping pending order_id=%s order_number=%s reason=now_paid",
                    order.id,
                    order.order_number,
                )
                return False

        return True
