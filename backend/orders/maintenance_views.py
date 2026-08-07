import hmac
import logging
from io import StringIO

from django.conf import settings
from django.core.management import call_command
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

logger = logging.getLogger(__name__)


def _token_valid(request):
    expected = settings.MAINTENANCE_CRON_TOKEN
    if not expected:
        return None

    provided = request.META.get("HTTP_X_MAINTENANCE_TOKEN", "").strip()
    if not provided:
        return False

    return hmac.compare_digest(provided, expected)


def _run_command(name, *args):
    stdout = StringIO()
    stderr = StringIO()
    call_command(name, *args, stdout=stdout, stderr=stderr)
    return {
        "output": stdout.getvalue().strip(),
        "error": stderr.getvalue().strip(),
    }


@api_view(["POST"])
@permission_classes([AllowAny])
def run_order_maintenance(request):
    token_valid = _token_valid(request)
    if token_valid is None:
        return Response(
            {"error": "Maintenance endpoint is not configured."},
            status=503,
        )
    if token_valid is False:
        return Response({"error": "Unauthorized."}, status=403)

    commands = [
        ("reconcile_pending_payments", ["--limit", "200"]),
        ("purge_delivered_order_media", ["--limit", "200"]),
        ("purge_failed_pending_orders", ["--limit", "200"]),
    ]

    results = {}
    errors = {}
    for name, args in commands:
        try:
            results[name] = _run_command(name, *args)
        except Exception as exc:
            logger.exception("Maintenance command %s failed: %s", name, exc)
            errors[name] = str(exc)

    logger.info(
        "Order maintenance run completed commands=%s errors=%s",
        len(commands),
        list(errors),
    )
    return Response(
        {
            "ran": [name for name, _ in commands],
            "results": results,
            "errors": errors,
        },
        status=200,
    )
