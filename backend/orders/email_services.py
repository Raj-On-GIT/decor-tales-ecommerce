import html as html_module
import logging
from decimal import Decimal

from django.conf import settings
from django.utils import timezone

from utils.email_service import send_email

logger = logging.getLogger(__name__)

CUSTOMER_SUBJECT = "Order Confirmed - {order_number}"
STORE_SUBJECT = "New Order Received - {order_number}"

BASE_STYLE = (
    "font-family:Arial,Helvetica,sans-serif;background-color:#f7f7f7;margin:0;padding:0;"
)
CONTENT_STYLE = "background-color:#ffffff;margin:0 auto;max-width:600px;padding:32px;"
HEADING_STYLE = "color:#134e4a;font-size:22px;font-weight:700;margin:0 0 8px;"
SUBHEADING_STYLE = "color:#475569;font-size:14px;line-height:1.6;margin:0 0 24px;"
TH_STYLE = "text-align:left;font-size:12px;text-transform:uppercase;color:#64748b;padding:8px;border-bottom:1px solid #e2e8f0;"
TD_STYLE = "font-size:14px;color:#1e293b;padding:8px;border-bottom:1px solid #f1f5f9;vertical-align:top;"
TOTAL_TD_STYLE = "font-size:14px;color:#1e293b;padding:6px 8px;"
GRAND_TOTAL_STYLE = "font-size:16px;font-weight:700;color:#134e4a;"
SECTION_TITLE_STYLE = "font-size:13px;text-transform:uppercase;color:#134e4a;font-weight:700;margin:0 0 8px;"
MUTED_STYLE = "font-size:13px;color:#64748b;line-height:1.6;margin:0;"
BUTTON_STYLE = (
    "display:inline-block;background-color:#134e4a;color:#ffffff;text-decoration:none;"
    "padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600;"
)


def _escape(value):
    return html_module.escape(str(value or ""))


def _money(value):
    return f"Rs. {Decimal(value or 0):,.2f}"


def _order_recipient_email(order):
    email = (order.shipping_email or "").strip()
    if email:
        return email
    if order.user_id and order.user:
        return (order.user.email or "").strip()
    return ""


def _variant_label(item):
    parts = []
    if item.variant_size_name:
        parts.append(f"Size: {item.variant_size_name}")
    if item.variant_color_name:
        parts.append(f"Color: {item.variant_color_name}")
    if item.variant_sku:
        parts.append(f"SKU: {item.variant_sku}")
    return " &middot; ".join(parts)


def _item_rows_html(order):
    rows = []
    for item in order.items.all():
        line_total = (item.price or 0) * (item.quantity or 0)
        variant = _variant_label(item)
        rows.append(
            "<tr>"
            f"<td style='{TD_STYLE}'>{_escape(item.product_title or 'Product')}"
            + (f"<div style='{MUTED_STYLE}'>{variant}</div>" if variant else "")
            + "</td>"
            f"<td style='{TD_STYLE}'>{item.quantity}</td>"
            f"<td style='{TD_STYLE}'>{_money(item.price)}</td>"
            f"<td style='{TD_STYLE}'>{_money(line_total)}</td>"
            "</tr>"
        )
    return "\n".join(rows)


def _totals_rows_html(order):
    rows = [
        "<tr>"
        f"<td style='{TOTAL_TD_STYLE}'>Subtotal</td>"
        f"<td style='{TOTAL_TD_STYLE};text-align:right'>{_money(order.subtotal_amount)}</td>"
        "</tr>"
    ]
    if order.discount_amount and order.discount_amount > 0:
        discount_label = (
            f"Discount ({_escape(order.coupon_code)})"
            if order.coupon_code
            else "Discount"
        )
        rows.append(
            "<tr>"
            f"<td style='{TOTAL_TD_STYLE}'>{discount_label}</td>"
            f"<td style='{TOTAL_TD_STYLE};text-align:right;color:#b91c1c'>- {_money(order.discount_amount)}</td>"
            "</tr>"
        )
    rows.append(
        "<tr>"
        f"<td style='{GRAND_TOTAL_STYLE}'>Total</td>"
        f"<td style='{GRAND_TOTAL_STYLE};text-align:right'>{_money(order.total_amount)}</td>"
        "</tr>"
    )
    return "\n".join(rows)


def _shipping_block_html(order):
    lines = [
        _escape(order.shipping_full_name or ""),
        _escape(order.shipping_address or ""),
        ", ".join(
            part
            for part in [
                _escape(order.city),
                _escape(order.shipping_state),
                _escape(order.postal_code),
            ]
            if part
        ),
        _escape(order.shipping_country or ""),
        _escape(order.phone or ""),
    ]
    address_html = "<br/>".join(line for line in lines if line)
    return (
        f"<p style='{SECTION_TITLE_STYLE}'>Shipping Address</p>"
        f"<p style='{MUTED_STYLE}'>{address_html}</p>"
    )


def build_order_confirmation_html(order):
    track_url = f"{settings.FRONTEND_URL}/track"
    return (
        f"<!DOCTYPE html><html><body style='{BASE_STYLE}'>"
        f"<div style='{CONTENT_STYLE}'>"
        f"<p style='{HEADING_STYLE}'>Thank you for your order!</p>"
        f"<p style='{SUBHEADING_STYLE}'>"
        f"Your order <strong>{_escape(order.order_number)}</strong> has been placed successfully. "
        "We are preparing your items and will keep you updated."
        "</p>"
        "<table style='width:100%;margin:0 0 24px;'>"
        "<tr>"
        f"<th style='{TH_STYLE}'>Item</th>"
        f"<th style='{TH_STYLE}'>Qty</th>"
        f"<th style='{TH_STYLE}'>Price</th>"
        f"<th style='{TH_STYLE}'>Total</th>"
        "</tr>"
        f"{_item_rows_html(order)}"
        "</table>"
        "<table style='width:100%;margin:0 0 24px;'>"
        f"{_totals_rows_html(order)}"
        "</table>"
        f"{_shipping_block_html(order)}"
        "<p style='margin:24px 0 0;'>"
        f"<a href='{_escape(track_url)}' style='{BUTTON_STYLE}'>Track your order</a>"
        "</p>"
        "<p style='margin:32px 0 0;font-size:12px;color:#94a3b8;'>"
        "Decor Tales &mdash; Thank you for shopping with us."
        "</p>"
        "</div></body></html>"
    )


def build_store_notification_html(order):
    item_summary = ", ".join(
        f"{item.quantity}x {item.product_title or 'Product'}" for item in order.items.all()
    )
    return (
        f"<!DOCTYPE html><html><body style='{BASE_STYLE}'>"
        f"<div style='{CONTENT_STYLE}'>"
        f"<p style='{HEADING_STYLE}'>New Order Received</p>"
        f"<p style='{SUBHEADING_STYLE}'>"
        f"Order <strong>{_escape(order.order_number)}</strong> was successfully placed."
        "</p>"
        f"<p style='{SECTION_TITLE_STYLE}'>Order Summary</p>"
        f"<p style='{MUTED_STYLE}'>"
        f"Customer: {_escape(order.shipping_full_name)} "
        f"({_escape(order.shipping_email)})<br/>"
        f"Phone: {_escape(order.phone)}<br/>"
        f"Items: {_escape(item_summary)}<br/>"
        f"Total: <strong>{_money(order.total_amount)}</strong><br/>"
        f"Shipping to: {_escape(order.city)}, {_escape(order.postal_code)}"
        "</p>"
        "</div></body></html>"
    )


def _mark_confirmation_sent(order):
    if order.confirmation_email_sent_at:
        return
    order.confirmation_email_sent_at = timezone.now()
    order.save(update_fields=["confirmation_email_sent_at", "updated_at"])


def send_order_confirmation_email(order):
    if order.confirmation_email_sent_at:
        logger.info(
            "Skipping order confirmation email order_id=%s reason=already_sent",
            order.id,
        )
        return

    recipient = _order_recipient_email(order)
    if not recipient:
        logger.warning(
            "Skipping order confirmation email order_id=%s reason=no_recipient",
            order.id,
        )
        _mark_confirmation_sent(order)
        return

    try:
        send_email(
            to_email=recipient,
            subject=CUSTOMER_SUBJECT.format(order_number=order.order_number),
            html=build_order_confirmation_html(order),
        )
        logger.info("Order confirmation email sent order_id=%s to=%s", order.id, recipient)
    except Exception as exc:
        logger.error(
            "Order confirmation email FAILED order_id=%s to=%s error=%s",
            order.id,
            recipient,
            str(exc),
        )
    finally:
        _mark_confirmation_sent(order)


def send_store_order_notification(order):
    store_email = getattr(settings, "STORE_ORDER_NOTIFY_EMAIL", "").strip()
    if not store_email:
        logger.info(
            "Skipping store order notification order_id=%s reason=not_configured",
            order.id,
        )
        return

    try:
        send_email(
            to_email=store_email,
            subject=STORE_SUBJECT.format(order_number=order.order_number),
            html=build_store_notification_html(order),
        )
        logger.info("Store order notification sent order_id=%s to=%s", order.id, store_email)
    except Exception as exc:
        logger.error(
            "Store order notification FAILED order_id=%s to=%s error=%s",
            order.id,
            store_email,
            str(exc),
        )
