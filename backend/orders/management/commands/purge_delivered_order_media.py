from datetime import timedelta

from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils import timezone

from orders.models import Order
from utils.media_cleanup import (
    MEDIA_PURGE_ORDER_STATUSES,
    process_scheduled_media_cleanup,
    purge_order_customization_media,
)


class Command(BaseCommand):
    help = (
        "Permanently remove uploaded customization media from terminal orders "
        "after the configured retention window."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--days",
            type=int,
            default=None,
            help="Retention window in days before media is purged.",
        )
        parser.add_argument(
            "--limit",
            type=int,
            default=200,
            help="Maximum number of orders to process in one run.",
        )

    def handle(self, *args, **options):
        retention_days = options["days"]
        if retention_days is None:
            retention_days = getattr(settings, "ORDER_CUSTOMIZATION_MEDIA_RETENTION_DAYS", 7)

        cutoff = timezone.now() - timedelta(days=max(retention_days, 0))
        queryset = (
            Order.objects.filter(
                status__in=MEDIA_PURGE_ORDER_STATUSES,
                customization_media_purged_at__isnull=True,
                updated_at__lte=cutoff,
            )
            .exclude(status="delivered", payment_processed=False)
            .order_by("updated_at")[: max(options["limit"], 1)]
        )

        processed = 0
        removed = 0
        for order in queryset:
            media_removed = purge_order_customization_media(order, delete_after_days=0)
            processed += 1
            if media_removed:
                removed += 1

        queue_result = process_scheduled_media_cleanup(
            limit=max(options["limit"], 1) * 10
        )

        self.stdout.write(
            self.style.SUCCESS(
                "Processed "
                f"{processed} terminal order(s); cleared media from {removed}. "
                f"Cleanup queue processed {queue_result['processed']} item(s) and deleted "
                f"{queue_result['deleted']} storage asset(s)."
            )
        )
