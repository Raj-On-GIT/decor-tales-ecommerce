from decimal import Decimal
import hmac
import logging
import mimetypes

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.core.files.storage import default_storage
from django.http import FileResponse, Http404
from django.db import transaction
from django.db.models import F, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.urls import reverse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .models import (
    Cart,
    CartItem,
    CartItemImage,
    Coupon,
    CouponUsage,
    Order,
    OrderItem,
    OrderItemImage,
)
from .serializers import AddToCartSerializer
from products.models import Product, ProductVariant
from products.media_utils import build_media_url, normalize_media_name
from utils.delhivery_service import DelhiveryService, DelhiveryServiceError

logger = logging.getLogger(__name__)


def get_product_price(product):
    return product.slashed_price or product.mrp


def is_product_available_for_purchase(product):
    return bool(product and product.is_active)


def serialize_category_trail(product):
    return {
        "category": (
            {
                "name": product.category.name,
                "slug": product.category.slug,
            }
            if product.category
            else None
        ),
        "sub_category": (
            {
                "name": product.sub_category.name,
                "slug": product.sub_category.slug,
            }
            if product.sub_category
            else None
        ),
    }


def serialize_pricing(product, variant=None, effective_price=None):
    original_price = None
    sale_price = None
    discount_percent = None

    if variant:
        original_price = variant.mrp
        sale_price = variant.slashed_price or variant.mrp
        discount_percent = variant.discount_percent
    else:
        original_price = product.mrp
        sale_price = product.slashed_price or product.mrp
        discount_percent = product.discount_percent

    if effective_price is not None:
        sale_price = effective_price

    return {
        "price": str(sale_price or Decimal("0.00")),
        "mrp": str(original_price) if original_price is not None else None,
        "slashed_price": str(sale_price) if sale_price is not None else None,
        "discount_percent": discount_percent,
    }


def validate_indian_pincode(value):
    pincode = str(value or "").strip()
    if not pincode:
        raise ValueError("Pincode is required.")
    if not pincode.isdigit() or len(pincode) != 6:
        raise ValueError("Pincode must be a 6-digit number.")
    return pincode


def validate_delhivery_mot(value):
    mot = str(value or "").strip().upper()
    allowed_values = {"S", "E", "N"}

    if not mot:
        raise ValueError("mot is required.")
    if mot not in allowed_values:
        raise ValueError("mot must be one of S, E, or N.")

    return mot


def validate_optional_text(value):
    return str(value or "").strip()


def validate_expected_pickup_date(value):
    normalized = str(value or "").strip()
    if not normalized:
        return ""

    if parse_datetime(normalized) is None:
        raise ValueError(
            "expected_pickup_date must be in YYYY-MM-DD HH:mm format."
        )

    return normalized


def validate_order_id(value):
    try:
        order_id = int(str(value or "").strip())
    except (TypeError, ValueError) as exc:
        raise ValueError("order_id must be a valid integer.") from exc

    if order_id <= 0:
        raise ValueError("order_id must be a valid integer.")

    return order_id


def validate_order_number(value):
    order_number = str(value or "").strip()
    if not order_number:
        raise ValueError("order_id is required.")
    if len(order_number) > 50:
        raise ValueError("Invalid tracking details.")
    return order_number


def normalize_email(value):
    return str(value or "").strip().lower()


def normalize_phone(value):
    raw_value = str(value or "").strip()
    digits_only = "".join(character for character in raw_value if character.isdigit())

    if not digits_only:
        raise ValueError("Invalid tracking details.")

    return digits_only


def contact_matches_order(*, order, email="", phone=""):
    if email:
        return normalize_email(order.shipping_email) == email

    try:
        return normalize_phone(order.phone) == phone
    except ValueError:
        return False


def validate_tracking_lookup_inputs(*, waybill, order_number, email, phone):
    normalized_waybill = str(waybill or "").strip()
    normalized_order_number = str(order_number or "").strip()
    normalized_email = normalize_email(email)
    normalized_phone = "".join(character for character in str(phone or "").strip() if character.isdigit())

    if bool(normalized_waybill) == bool(normalized_order_number):
        raise ValueError("Provide exactly one of waybill or order_id.")

    if bool(normalized_email) == bool(normalized_phone):
        raise ValueError("Provide exactly one of email or phone.")

    if normalized_waybill:
        if len(normalized_waybill) > 120:
            raise ValueError("Invalid tracking details.")
    else:
        normalized_order_number = validate_order_number(normalized_order_number)

    if normalized_email:
        return {
            "waybill": normalized_waybill,
            "order_number": normalized_order_number,
            "email": normalized_email,
            "phone": "",
        }

    return {
        "waybill": normalized_waybill,
        "order_number": normalized_order_number,
        "email": "",
        "phone": normalize_phone(phone),
    }


def summarize_pincode_serviceability(payload, *, pincode):
    delivery_codes = payload.get("delivery_codes", [])
    postal_code = {}

    if delivery_codes and isinstance(delivery_codes[0], dict):
        postal_code = delivery_codes[0].get("postal_code") or {}

    return {
        "pincode": pincode,
        "serviceable": bool(delivery_codes),
        "cod_available": postal_code.get("cod") == "Y",
        "prepaid_available": postal_code.get("pre_paid") == "Y",
        "pickup_available": postal_code.get("pickup") == "Y",
        "is_oda": postal_code.get("is_oda") == "Y",
        "remarks": postal_code.get("remarks") or "",
        "raw": payload,
    }


def summarize_expected_tat(
    payload,
    *,
    origin_pin,
    destination_pin,
    mot,
    pdt="",
    expected_pickup_date="",
):
    data = payload.get("data") or {}

    return {
        "origin_pin": origin_pin,
        "destination_pin": destination_pin,
        "mot": mot,
        "pdt": pdt,
        "expected_pickup_date": expected_pickup_date,
        "success": bool(payload.get("success")),
        "message": payload.get("msg") or "",
        "tat": data.get("tat"),
        "raw": payload,
    }


def build_delhivery_products_description(order):
    titles = []
    for item in order.items.all():
        title = (item.product_title or "").strip()
        if not title and item.product:
            title = (item.product.title or "").strip()
        if title:
            titles.append(title)

    if not titles:
        return f"Order {order.order_number}"

    unique_titles = list(dict.fromkeys(titles))
    return ", ".join(unique_titles)[:250]


def build_delhivery_shipment_payload(order):
    pickup_location = getattr(settings, "DELHIVERY_PICKUP_LOCATION", "").strip()
    if not pickup_location:
        raise ImproperlyConfigured("DELHIVERY_PICKUP_LOCATION must be configured.")

    missing_fields = []
    if not (order.shipping_full_name or "").strip():
        missing_fields.append("shipping_full_name")
    if not (order.shipping_address or "").strip():
        missing_fields.append("shipping_address")
    if not (order.postal_code or "").strip():
        missing_fields.append("postal_code")
    if not (order.city or "").strip():
        missing_fields.append("city")
    if not (order.shipping_state or "").strip():
        missing_fields.append("shipping_state")
    if not (order.shipping_country or "").strip():
        missing_fields.append("shipping_country")
    if not (order.phone or "").strip():
        missing_fields.append("phone")

    if missing_fields:
        raise ValueError(
            "Order is missing required shipment fields: "
            + ", ".join(missing_fields)
            + "."
        )

    return {
        "shipments": [
            {
                "name": order.shipping_full_name.strip(),
                "add": order.shipping_address.strip(),
                "pin": str(order.postal_code).strip(),
                "city": order.city.strip(),
                "state": order.shipping_state.strip(),
                "country": order.shipping_country.strip(),
                "phone": str(order.phone).strip(),
                "order": order.order_number,
                "payment_mode": "Prepaid",
                "products_desc": build_delhivery_products_description(order),
                # A static fallback keeps the payload aligned with the verified
                # Postman sample until shipment-specific weights are modeled.
                "weight": "1",
                "shipping_mode": "Surface",
                "total_amount": str(order.total_amount),
                "pickup_location": pickup_location,
            }
        ]
    }


def summarize_delhivery_shipment(order, payload):
    packages = payload.get("packages") or []
    package = packages[0] if packages and isinstance(packages[0], dict) else {}

    return {
        "order_id": order.id,
        "order_number": order.order_number,
        "waybill": order.delhivery_waybill,
        "reference": order.delhivery_reference,
        "shipment_status": order.delhivery_shipment_status,
        "client_name": order.delhivery_client_name,
        "payment_mode": order.delhivery_payment_mode,
        "serviceable": package.get("serviceable"),
        "remarks": package.get("remarks") or [],
        "raw": payload,
    }


def create_delhivery_shipment_for_order_id(order_id):
    with transaction.atomic():
        order = (
            Order.objects.select_for_update()
            .select_related("user")
            .prefetch_related("items", "items__product")
            .get(id=order_id)
        )

        if order.delhivery_waybill:
            raise ValueError("Shipment already created for this order.")

        shipment_payload = build_delhivery_shipment_payload(order)
        payload = DelhiveryService().create_shipment(data=shipment_payload)

        if not payload.get("success"):
            raise DelhiveryServiceError("Delhivery shipment creation failed.")

        packages = payload.get("packages") or []
        package = packages[0] if packages and isinstance(packages[0], dict) else {}
        waybill = str(package.get("waybill") or "").strip()

        if not waybill:
            raise DelhiveryServiceError(
                "Delhivery shipment response did not include a waybill."
            )

        order.delhivery_waybill = waybill
        order.delhivery_reference = str(payload.get("upload_wbn") or "").strip()
        order.delhivery_client_name = str(package.get("client") or "").strip()
        order.delhivery_shipment_status = str(package.get("status") or "").strip()
        order.delhivery_payment_mode = str(package.get("payment") or "").strip()
        order.delhivery_raw_response = payload
        order.delhivery_created_at = timezone.now()
        order.save(
            update_fields=[
                "delhivery_waybill",
                "delhivery_reference",
                "delhivery_client_name",
                "delhivery_shipment_status",
                "delhivery_payment_mode",
                "delhivery_raw_response",
                "delhivery_created_at",
                "updated_at",
            ]
        )

    return order, payload


def validate_shipping_label_pdf_size(value):
    normalized = str(value or "").strip().upper()
    if not normalized:
        return "4R"
    if normalized not in {"A4", "4R"}:
        raise ValueError("pdf_size must be either A4 or 4R.")
    return normalized


def summarize_delhivery_shipping_label(order, payload):
    packages = payload.get("packages") or []
    package = packages[0] if packages and isinstance(packages[0], dict) else {}

    return {
        "order_id": order.id,
        "order_number": order.order_number,
        "waybill": order.delhivery_waybill,
        "packages_found": payload.get("packages_found", 0),
        "label": {
            "pdf_download_link": package.get("pdf_download_link") or "",
            "pdf_encoding": package.get("pdf_encoding") or "",
            "wbn": package.get("wbn") or "",
        },
        "raw": payload,
    }


def generate_delhivery_shipping_label_for_order_id(order_id, *, pdf=True, pdf_size="4R"):
    order = Order.objects.get(id=order_id)

    if not order.delhivery_waybill:
        raise ValueError("Shipment has not been created for this order yet.")

    payload = DelhiveryService().generate_shipping_label(
        waybill=order.delhivery_waybill,
        pdf=pdf,
        pdf_size=pdf_size,
    )

    packages_found = int(payload.get("packages_found") or 0)
    packages = payload.get("packages") or []

    if packages_found <= 0 or not packages:
        raise DelhiveryServiceError("Delhivery did not return a shipping label.")

    package = packages[0] if isinstance(packages[0], dict) else {}
    if not str(package.get("wbn") or "").strip():
        raise DelhiveryServiceError("Delhivery shipping label response is incomplete.")

    return order, payload


def get_generic_tracking_error_response():
    return Response(
        {"error": "Tracking details could not be verified."},
        status=400,
    )


def summarize_tracking_response(order, payload):
    shipment_data = payload.get("ShipmentData") or []
    shipment_wrapper = shipment_data[0] if shipment_data and isinstance(shipment_data[0], dict) else {}
    shipment = shipment_wrapper.get("Shipment") or {}
    status_data = shipment.get("Status") or {}
    scans = shipment.get("Scans") or []

    timeline = []
    for item in scans:
        scan_detail = item.get("ScanDetail") or {}
        timeline.append(
            {
                "status": scan_detail.get("Scan") or "",
                "instructions": scan_detail.get("Instructions") or "",
                "location": scan_detail.get("ScannedLocation") or "",
                "status_code": scan_detail.get("StatusCode") or "",
                "status_type": scan_detail.get("ScanType") or "",
                "timestamp": scan_detail.get("ScanDateTime") or scan_detail.get("StatusDateTime"),
            }
        )

    return {
        "order_number": order.order_number,
        "waybill": order.delhivery_waybill,
        "reference_number": shipment.get("ReferenceNo") or "",
        "status": {
            "label": status_data.get("Status") or "",
            "code": status_data.get("StatusCode") or "",
            "type": status_data.get("StatusType") or "",
            "instructions": status_data.get("Instructions") or "",
            "location": status_data.get("StatusLocation") or "",
            "timestamp": status_data.get("StatusDateTime"),
        },
        "shipment": {
            "pickup_date": shipment.get("PickUpDate"),
            "expected_delivery_date": shipment.get("ExpectedDeliveryDate"),
            "promised_delivery_date": shipment.get("PromisedDeliveryDate"),
            "destination": shipment.get("Destination") or "",
            "origin": shipment.get("Origin"),
            "order_type": shipment.get("OrderType") or "",
            "invoice_amount": shipment.get("InvoiceAmount"),
            "cod_amount": shipment.get("CODAmount"),
            "sender_name": shipment.get("SenderName") or "",
            "consignee": shipment.get("Consignee") or {},
        },
        "timeline": timeline,
        "raw": payload,
    }


def apply_delhivery_tracking_snapshot(
    order,
    *,
    raw_payload,
    status,
    synced_at=None,
):
    status = status or {}
    update_fields = [
        "delhivery_tracking_raw_response",
        "delhivery_tracking_synced_at",
        "updated_at",
    ]

    order.delhivery_tracking_raw_response = raw_payload
    order.delhivery_tracking_synced_at = synced_at or timezone.now()

    status_code = str(status.get("code") or "").strip()
    if status_code:
        order.delhivery_tracking_status_code = status_code
        update_fields.append("delhivery_tracking_status_code")

    status_label = str(status.get("label") or "").strip()
    if status_label:
        order.delhivery_tracking_status_label = status_label
        update_fields.append("delhivery_tracking_status_label")

    status_type = str(status.get("type") or "").strip()
    if status_type:
        order.delhivery_tracking_status_type = status_type
        update_fields.append("delhivery_tracking_status_type")

    status_location = str(status.get("location") or "").strip()
    if status_location:
        order.delhivery_last_scan_location = status_location
        update_fields.append("delhivery_last_scan_location")

    status_timestamp = status.get("timestamp")
    if status_timestamp:
        parsed_timestamp = parse_datetime(str(status_timestamp).strip())
        if parsed_timestamp is not None:
            order.delhivery_last_scan_at = parsed_timestamp
            update_fields.append("delhivery_last_scan_at")

    order.save(update_fields=list(dict.fromkeys(update_fields)))
    return order


def refresh_delhivery_tracking_for_order_id(order_id):
    order = Order.objects.get(id=order_id)

    if not order.delhivery_waybill:
        raise ValueError("Shipment has not been created for this order yet.")

    payload = DelhiveryService().track_shipment(
        waybill=order.delhivery_waybill,
        ref_ids=order.order_number,
    )
    summary = summarize_tracking_response(order, payload)

    apply_delhivery_tracking_snapshot(
        order,
        raw_payload=payload,
        status=summary.get("status"),
    )
    return order, summary


def get_delhivery_webhook_secret():
    return getattr(settings, "DELHIVERY_WEBHOOK_SECRET", "").strip()


def process_delhivery_scan_push_payload(payload):
    shipment = payload.get("Shipment") or {}
    status_data = shipment.get("Status") or {}

    awb = str(shipment.get("AWB") or "").strip()
    if not awb:
        raise ValueError("Missing AWB in webhook payload.")

    reference_number = str(shipment.get("ReferenceNo") or "").strip()
    order = Order.objects.filter(delhivery_waybill=awb).first()
    if not order:
        logger.warning("delhivery_scan_push_unmatched_awb awb=%s reference=%s", awb, reference_number)
        return None, "order_not_found"

    if reference_number and str(order.order_number).strip() != reference_number:
        logger.warning(
            "delhivery_scan_push_reference_mismatch order_id=%s awb=%s expected_reference=%s received_reference=%s",
            order.id,
            awb,
            order.order_number,
            reference_number,
        )

    status = {
        "label": status_data.get("Status") or "",
        "code": status_data.get("StatusCode") or "",
        "type": status_data.get("StatusType") or "",
        "instructions": status_data.get("Instructions") or "",
        "location": status_data.get("StatusLocation") or "",
        "timestamp": status_data.get("StatusDateTime"),
    }

    apply_delhivery_tracking_snapshot(
        order,
        raw_payload=payload,
        status=status,
    )
    return order, "updated"


def get_order_item_variant_snapshot(item):
    variant = item.variant

    # Determine variant status:
    # - "available" → FK intact (variant exists in DB)
    # - "available" → FK null but a variant with the same SKU was re-added
    # - "missing"   → FK null, snapshot data exists, no matching variant found
    # - None        → item was never a variant item (main stock product)
    if variant:
        variant_status = "available"
    elif item.variant_sku or item.variant_size_name or item.variant_color_name:
        # The item originally had a variant (snapshot data proves it).
        # The FK is null because the variant was deleted at some point.
        # Check if an equivalent variant has since been re-added via SKU match.
        matching_exists = (
            item.variant_sku
            and ProductVariant.objects.filter(sku=item.variant_sku).exists()
        )
        variant_status = "available" if matching_exists else "missing"
    else:
        variant_status = None

    return {
        "id": variant.id if variant else None,
        "status": variant_status,
        "size_name": (
            variant.size.name if variant and variant.size else item.variant_size_name or None
        ),
        "color_name": (
            variant.color.name if variant and variant.color else item.variant_color_name or None
        ),
        "mrp": str(variant.mrp) if variant and variant.mrp is not None else None,
        "slashed_price": (
            str(variant.slashed_price)
            if variant and variant.slashed_price is not None
            else None
        ),
        "discount_percent": variant.discount_percent if variant else None,
        "sku": variant.sku if variant else item.variant_sku or None,
    }


def find_matching_variant_for_snapshot(item):
    if not item or not item.product or item.product.stock_type != "variants":
        return None

    if item.variant:
        return item.variant

    if item.variant_sku:
        matching_variant = ProductVariant.objects.filter(
            product=item.product,
            sku=item.variant_sku,
        ).select_related("size", "color").first()
        if matching_variant:
            return matching_variant

    queryset = ProductVariant.objects.filter(product=item.product).select_related("size", "color")

    if item.variant_size_name:
        queryset = queryset.filter(size__name=item.variant_size_name)

    if item.variant_color_name:
        queryset = queryset.filter(color__name=item.variant_color_name)

    if item.variant_size_name or item.variant_color_name:
        matches = list(queryset[:2])
        if len(matches) == 1:
            return matches[0]

    return None


def resolve_cart_item_variant(item, persist=False):
    variant = find_matching_variant_for_snapshot(item)

    if variant and item.variant_id != variant.id:
        item.variant = variant
        if persist and item.id:
            CartItem.objects.filter(id=item.id, variant__isnull=True).update(variant=variant)

    return variant


def get_cart_item_variant_snapshot(item, persist=False):
    variant = resolve_cart_item_variant(item, persist=persist)

    if variant:
        variant_status = "available"
    elif item.variant_sku or item.variant_size_name or item.variant_color_name:
        variant_status = "missing"
    elif item.product and item.product.stock_type == "variants":
        variant_status = "missing"
    else:
        variant_status = None

    if variant_status is None:
        return None

    return {
        "id": variant.id if variant else None,
        "status": variant_status,
        "size_name": (
            variant.size.name if variant and variant.size else item.variant_size_name or None
        ),
        "color_name": (
            variant.color.name if variant and variant.color else item.variant_color_name or None
        ),
        "stock": variant.stock if variant else 0,
        "mrp": str(variant.mrp) if variant and variant.mrp is not None else None,
        "slashed_price": (
            str(variant.slashed_price)
            if variant and variant.slashed_price is not None
            else None
        ),
        "discount_percent": variant.discount_percent if variant else None,
        "sku": variant.sku if variant else item.variant_sku or None,
    }


def serialize_order_item_product(item, request):
    product = item.product
    product_exists = product is not None
    product_status = (
        "available"
        if product_exists and product.is_active
        else "unavailable"
        if product_exists
        else "missing"
    )

    image_url = None
    if product_exists and product.image:
        image_url = request.build_absolute_uri(build_media_url(product.image))
    elif item.product_image:
        image_url = request.build_absolute_uri(build_media_url(item.product_image))

    category = None
    if item.product_category_name or (product_exists and product.category):
        category = {
            "name": item.product_category_name or product.category.name,
            "slug": item.product_category_slug or product.category.slug,
        }

    sub_category = None
    if item.product_sub_category_name or (product_exists and product.sub_category):
        sub_category = {
            "name": item.product_sub_category_name or product.sub_category.name,
            "slug": item.product_sub_category_slug or product.sub_category.slug,
        }

    pricing = (
        serialize_pricing(product, item.variant, item.price)
        if product_exists
        else {
            "price": str(item.price or Decimal("0.00")),
            "mrp": None,
            "slashed_price": str(item.price or Decimal("0.00")),
            "discount_percent": None,
        }
    )

    return {
        "id": product.id if product_exists else None,
        "title": item.product_title or (product.title if product_exists else "Product no longer available"),
        "slug": item.product_slug or (product.slug if product_exists else ""),
        "image": image_url,
        "category": category,
        "sub_category": sub_category,
        "status": product_status,
        "exists": product_exists,
        "can_view": product_exists,
        **pricing,
    }


def build_image_urls(request, image_objects):
    return [
        request.build_absolute_uri(build_media_url(image.image))
        for image in image_objects
        if image.image and build_media_url(image.image)
    ]


def get_custom_image_files(request):
    image_files = request.FILES.getlist("custom_images")

    if image_files:
        return image_files

    legacy_image = request.FILES.get("custom_image")
    return [legacy_image] if legacy_image else []


def get_first_error_message(errors):
    if isinstance(errors, list) and errors:
        return get_first_error_message(errors[0])

    if isinstance(errors, dict):
        if "non_field_errors" in errors:
            return get_first_error_message(errors["non_field_errors"])
        first_key = next(iter(errors), None)
        if first_key is not None:
            return get_first_error_message(errors[first_key])

    return str(errors)


def build_secure_order_media_url(request, file_field):
    normalized_name = normalize_media_name(getattr(file_field, "name", ""))
    if not normalized_name or not normalized_name.startswith("order_customizations/"):
        return build_media_url(file_field)

    secure_path = reverse("order_media", kwargs={"file_path": normalized_name})
    return request.build_absolute_uri(secure_path) if request else secure_path


def build_secure_order_image_urls(request, image_objects):
    return [
        build_secure_order_media_url(request, image.image)
        for image in image_objects
        if image.image and build_secure_order_media_url(request, image.image)
    ]


def get_order_owner_for_media(file_path):
    normalized_path = normalize_media_name(file_path)
    if not normalized_path.startswith("order_customizations/"):
        raise Http404("Unsupported media path.")

    order_item_image = (
        OrderItemImage.objects.select_related("order_item__order__user")
        .filter(image=normalized_path)
        .first()
    )
    if order_item_image:
        return order_item_image.order_item.order.user

    order_item = (
        OrderItem.objects.select_related("order__user")
        .filter(custom_image=normalized_path)
        .first()
    )
    if order_item:
        return order_item.order.user

    raise Http404("Media file not found.")


def _serve_order_media_response(request, file_path):
    normalized_path = normalize_media_name(file_path)
    owner = get_order_owner_for_media(normalized_path)

    if not (request.user.is_staff or owner.id == request.user.id):
        raise Http404("Media file not found.")

    if not default_storage.exists(normalized_path):
        raise Http404("Media file not found.")

    media_file = default_storage.open(normalized_path, "rb")
    content_type = mimetypes.guess_type(normalized_path)[0] or "application/octet-stream"
    response = FileResponse(media_file, content_type=content_type)
    response["Cache-Control"] = "private, max-age=300"
    return response


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def serve_order_media(request, file_path):
    return _serve_order_media_response(request, file_path)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def serve_order_media_direct(request, file_path):
    return _serve_order_media_response(
        request,
        f"order_customizations/{normalize_media_name(file_path)}",
    )


def get_coupon_queryset():
    now = timezone.now()
    return (
        Coupon.objects.filter(
            is_active=True,
            start_date__lte=now,
        )
        .filter(Q(end_date__isnull=True) | Q(end_date__gte=now))
        .prefetch_related("categories", "subcategories")
    )


def get_coupon_usage_queryset():
    return CouponUsage.objects.exclude(order__status__in=["cancelled", "failed"])


def get_coupon_description_lines(description):
    return [line.strip("•- \t") for line in (description or "").splitlines() if line.strip()]


def get_cart_line_items(cart_items):
    line_items = []

    for item in cart_items:
        product = item.product
        variant = resolve_cart_item_variant(item)

        if product.stock_type == "variants":
            price = variant.slashed_price or variant.mrp or Decimal("0.00")
        else:
            price = get_product_price(product) or Decimal("0.00")

        price = Decimal(price)
        line_items.append(
            {
                "item": item,
                "product": product,
                "variant": variant,
                "price": price,
                "line_total": price * item.quantity,
            }
        )

    return line_items


def get_coupon_eligible_subtotal(coupon, cart_items):
    category_ids = set(coupon.categories.values_list("id", flat=True))
    subcategory_ids = set(coupon.subcategories.values_list("id", flat=True))

    if not category_ids and not subcategory_ids:
        return sum((item["line_total"] for item in cart_items), Decimal("0.00"))

    eligible_total = Decimal("0.00")
    for item in cart_items:
        product = item["product"]
        if (
            product.category_id in category_ids
            or product.sub_category_id in subcategory_ids
        ):
            eligible_total += item["line_total"]

    return eligible_total


def evaluate_coupon_for_cart(coupon, user, cart_items):
    subtotal = sum((item["line_total"] for item in cart_items), Decimal("0.00"))
    eligible_subtotal = get_coupon_eligible_subtotal(coupon, cart_items)

    if not cart_items:
        return {
            "eligible": False,
            "reason": "Your cart is empty.",
            "eligible_subtotal": eligible_subtotal,
            "discount_amount": Decimal("0.00"),
            "subtotal": subtotal,
            "display_in_list": True,
        }

    usage_qs = get_coupon_usage_queryset().filter(coupon=coupon)

    if coupon.usage_limit is not None and usage_qs.count() >= coupon.usage_limit:
        return {
            "eligible": False,
            "reason": "This coupon has reached its usage limit.",
            "eligible_subtotal": eligible_subtotal,
            "discount_amount": Decimal("0.00"),
            "subtotal": subtotal,
            "display_in_list": False,
        }

    if (
        coupon.usage_limit_per_user is not None
        and usage_qs.filter(user=user).count() >= coupon.usage_limit_per_user
    ):
        return {
            "eligible": False,
            "reason": "You have already used this coupon the maximum number of times.",
            "eligible_subtotal": eligible_subtotal,
            "discount_amount": Decimal("0.00"),
            "subtotal": subtotal,
            "display_in_list": False,
        }

    if coupon.first_order_only and user.orders.exclude(status__in=["cancelled", "failed"]).exists():
        return {
            "eligible": False,
            "reason": "This coupon is only available on your first order.",
            "eligible_subtotal": eligible_subtotal,
            "discount_amount": Decimal("0.00"),
            "subtotal": subtotal,
            "display_in_list": False,
        }

    if eligible_subtotal <= 0:
        return {
            "eligible": False,
            "reason": "No items in your cart qualify for this coupon.",
            "eligible_subtotal": eligible_subtotal,
            "discount_amount": Decimal("0.00"),
            "subtotal": subtotal,
            "display_in_list": True,
        }

    if coupon.min_order_amount and eligible_subtotal < coupon.min_order_amount:
        shortfall = coupon.min_order_amount - eligible_subtotal
        return {
            "eligible": False,
            "reason": f"Add Rs {shortfall:.2f} more in eligible items to use this coupon.",
            "eligible_subtotal": eligible_subtotal,
            "discount_amount": Decimal("0.00"),
            "subtotal": subtotal,
            "display_in_list": True,
        }

    if coupon.discount_type == Coupon.TYPE_PERCENT:
        discount_amount = (eligible_subtotal * coupon.discount_value) / Decimal("100")
    else:
        discount_amount = coupon.discount_value

    if coupon.max_discount_amount is not None:
        discount_amount = min(discount_amount, coupon.max_discount_amount)

    discount_amount = min(discount_amount, eligible_subtotal).quantize(
        Decimal("0.01")
    )

    return {
        "eligible": discount_amount > 0,
        "reason": "" if discount_amount > 0 else "This coupon is not eligible for this cart.",
        "eligible_subtotal": eligible_subtotal,
        "discount_amount": discount_amount,
        "subtotal": subtotal,
        "display_in_list": True,
    }


def serialize_coupon(coupon, evaluation):
    description_lines = get_coupon_description_lines(coupon.description)
    return {
        "code": coupon.code,
        "title": coupon.title,
        "description": coupon.description,
        "description_lines": description_lines,
        "discount_type": coupon.discount_type,
        "discount_value": str(coupon.discount_value),
        "min_order_amount": str(coupon.min_order_amount),
        "max_discount_amount": (
            str(coupon.max_discount_amount)
            if coupon.max_discount_amount is not None
            else None
        ),
        "first_order_only": coupon.first_order_only,
        "eligible": evaluation["eligible"],
        "reason": evaluation["reason"],
        "eligible_subtotal": str(evaluation["eligible_subtotal"]),
        "discount_amount": str(evaluation["discount_amount"]),
    }


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def add_to_cart(request):
    try:
        try:
            quantity = int(request.data.get("quantity", 1))
        except (TypeError, ValueError):
            return Response({"error": "Quantity must be a valid integer."}, status=400)

        if quantity < 1:
            return Response({"error": "Quantity must be at least 1."}, status=400)

        serializer = AddToCartSerializer(
            data={
                "product_id": request.data.get("product_id"),
                "quantity": quantity,
                "variant_id": request.data.get("variant_id"),
                "custom_text": request.data.get("custom_text"),
                "custom_images": get_custom_image_files(request),
            }
        )
        if not serializer.is_valid():
            return Response(
                {"error": get_first_error_message(serializer.errors)},
                status=400,
            )

        product = serializer.validated_data["product"]
        if not is_product_available_for_purchase(product):
            return Response({"error": "This product is no longer available."}, status=400)
        cart, _ = Cart.objects.get_or_create(user=request.user)
        variant = serializer.validated_data["variant"]
        custom_text = serializer.validated_data["custom_text"]
        custom_images = serializer.validated_data["custom_images"]

        available_stock = variant.stock if variant else product.stock

        if custom_text is None and not custom_images:
            cart_item = (
                CartItem.objects.filter(
                    cart=cart,
                    product=product,
                    variant=variant,
                    custom_images__isnull=True,
                )
                .filter(Q(custom_text__isnull=True) | Q(custom_text=""))
                .filter(Q(custom_image__isnull=True) | Q(custom_image=""))
                .first()
            )

            if cart_item:
                CartItem.objects.filter(id=cart_item.id).update(
                    quantity=F("quantity") + quantity
                )
                cart_item.refresh_from_db()
                if variant and (
                    cart_item.variant_size_name != (variant.size.name if variant.size else "")
                    or cart_item.variant_color_name != (variant.color.name if variant.color else "")
                    or cart_item.variant_sku != (variant.sku or "")
                ):
                    cart_item.capture_variant_snapshot(variant)
                    cart_item.save(
                        update_fields=[
                            "variant_size_name",
                            "variant_color_name",
                            "variant_sku",
                        ]
                    )

                if cart_item.quantity > available_stock:
                    cart_item.quantity = available_stock
                    cart_item.save()
            else:
                if quantity > available_stock:
                    quantity = available_stock

                cart_item = CartItem.objects.create(
                    cart=cart,
                    product=product,
                    variant=variant,
                    variant_size_name=variant.size.name if variant and variant.size else "",
                    variant_color_name=variant.color.name if variant and variant.color else "",
                    variant_sku=variant.sku if variant else "",
                    quantity=quantity,
                    custom_text=None,
                    custom_image=None,
                )
        else:
            if quantity > available_stock:
                quantity = available_stock

            cart_item = CartItem.objects.create(
                cart=cart,
                product=product,
                variant=variant,
                variant_size_name=variant.size.name if variant and variant.size else "",
                variant_color_name=variant.color.name if variant and variant.color else "",
                variant_sku=variant.sku if variant else "",
                quantity=quantity,
                custom_text=custom_text,
                custom_image=None,
            )

            for image_file in custom_images:
                CartItemImage.objects.create(cart_item=cart_item, image=image_file)

        price = (
            variant.slashed_price or variant.mrp or get_product_price(product)
            if variant
            else get_product_price(product)
        )

        return Response(
            {
                "message": "Product added to cart",
                "cart_item": {
                    "id": cart_item.id,
                    "quantity": cart_item.quantity,
                    "total": str(cart_item.quantity * price),
                },
            },
            status=201,
        )

    except Exception as e:
        logger.exception(
            "cart_add_failed user_id=%s product_id=%s variant_id=%s",
            getattr(request.user, "id", None),
            request.data.get("product_id"),
            request.data.get("variant_id"),
        )
        return Response({"error": str(e)}, status=400)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_cart(request):
    try:
        cart = Cart.objects.filter(user=request.user).first()

        if not cart:
            return Response({"items": [], "total": "0.00", "count": 0})

        cart_items = (
            CartItem.objects.filter(cart=cart)
            .select_related("product", "variant", "variant__size", "variant__color")
            .prefetch_related("custom_images")
        )

        items = []
        total = 0

        for item in cart_items:
            variant_snapshot = get_cart_item_variant_snapshot(item, persist=True)
            resolved_variant = item.variant

            if resolved_variant:
                price = resolved_variant.slashed_price or resolved_variant.mrp or 0
            else:
                price = get_product_price(item.product) or 0

            price = float(price)
            item_total = price * item.quantity
            total += item_total

            is_variant_missing = (
                item.product.stock_type == "variants"
                and variant_snapshot
                and variant_snapshot["status"] == "missing"
            )
            product_available = item.product.is_active and not is_variant_missing
            product_status = (
                "available" if product_available
                else "variant_missing" if is_variant_missing
                else "unavailable"
            )

            items.append(
                {
                    "id": item.id,
                    "product": {
                        "id": item.product.id,
                        "title": item.product.title,
                        "slug": item.product.slug,
                        "image": (
                            request.build_absolute_uri(build_media_url(item.product.image))
                            if item.product.image
                            else None
                        ),
                        "stock": item.product.stock,
                        "stock_type": item.product.stock_type,
                        "allow_custom_text": item.product.allow_custom_text,
                        "allow_custom_image": item.product.allow_custom_image,
                        "status": product_status,
                        "can_view": True,
                        "is_available_for_purchase": product_available,
                        **serialize_category_trail(item.product),
                        **serialize_pricing(item.product, resolved_variant, Decimal(str(price))),
                    },
                    "variant": variant_snapshot,
                    "quantity": item.quantity,
                    "custom_text": item.custom_text,
                    "custom_images": build_secure_order_image_urls(request, item.custom_images.all()),
                    "custom_image": (
                        build_secure_order_media_url(request, item.custom_image)
                        if item.custom_image
                        else (
                            build_secure_order_media_url(request, item.custom_images.first().image)
                            if item.custom_images.exists()
                            else None
                        )
                    ),
                }
            )

        return Response({"items": items, "total": str(total), "count": len(items)})

    except Exception as e:
        logger.exception(
            "cart_get_failed user_id=%s",
            getattr(request.user, "id", None),
        )
        return Response({"error": str(e)}, status=400)


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def remove_from_cart(request, item_id):
    cart = Cart.objects.filter(user=request.user).first()

    if not cart:
        return Response({"error": "Cart not found"}, status=404)

    cart_item = get_object_or_404(CartItem, id=item_id, cart=cart)
    cart_item.delete()

    return Response({"message": "Item removed"})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def update_cart_item(request, item_id):
    quantity = int(request.data.get("quantity", 1))

    if quantity < 1:
        return Response({"error": "Invalid quantity"}, status=400)

    cart = Cart.objects.filter(user=request.user).first()
    if not cart:
        return Response({"error": "Cart not found"}, status=404)

    cart_item = get_object_or_404(CartItem, id=item_id, cart=cart)

    variant = resolve_cart_item_variant(cart_item, persist=True)
    available_stock = variant.stock if variant else cart_item.product.stock

    if quantity > available_stock:
        return Response(
            {"error": f"Only {available_stock} items available in stock."},
            status=400,
        )

    cart_item.quantity = quantity
    cart_item.save()

    if variant:
        price = variant.slashed_price or variant.mrp
    else:
        price = get_product_price(cart_item.product)

    return Response(
        {
            "message": "Cart updated",
            "cart_item": {
                "id": cart_item.id,
                "quantity": cart_item.quantity,
                "total": str(cart_item.quantity * price),
            },
        }
    )


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def clear_cart(request):
    cart = Cart.objects.filter(user=request.user).first()

    if cart:
        CartItem.objects.filter(cart=cart).delete()

    return Response({"message": "Cart cleared"})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_available_coupons(request):
    cart = Cart.objects.filter(user=request.user).first()
    cart_items = []

    if cart:
        cart_items = list(
            CartItem.objects.select_related(
                "product",
                "product__category",
                "product__sub_category",
                "variant",
            ).filter(cart=cart)
        )

    line_items = get_cart_line_items(cart_items)
    coupons = []
    for coupon in get_coupon_queryset():
        evaluation = evaluate_coupon_for_cart(coupon, request.user, line_items)
        if not evaluation["display_in_list"]:
            continue
        coupons.append(serialize_coupon(coupon, evaluation))

    return Response({"coupons": coupons})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@transaction.atomic
def create_order(request):
    try:
        from .payment_services import release_expired_reservations, validate_checkout_address

        if not getattr(settings, "ALLOW_LEGACY_DIRECT_ORDER", False):
            return Response(
                {
                    "error": "Direct order creation is disabled for safety. Use the payment order flow instead."
                },
                status=400,
            )

        release_expired_reservations()
        cart = Cart.objects.filter(user=request.user).first()

        if not cart or not CartItem.objects.filter(cart=cart).exists():
            return Response({"error": "Cart is empty"}, status=400)

        address_id = request.data.get("address_id")

        if not address_id:
            return Response({"error": "Address required"}, status=400)

        from accounts.models import Address

        address = get_object_or_404(Address, id=address_id, user=request.user)
        validate_checkout_address(address)

        cart_items = CartItem.objects.select_related(
            "product",
            "product__category",
            "product__sub_category",
            "variant",
        ).prefetch_related("custom_images").filter(cart=cart)

        subtotal_amount = Decimal("0.00")
        discount_amount = Decimal("0.00")
        applied_coupon = None

        for item in cart_items:
            product = item.product
            variant = resolve_cart_item_variant(item, persist=True)

            if not is_product_available_for_purchase(product):
                return Response(
                    {"error": f"{product.title} is no longer available."},
                    status=400,
                )

            if product.stock_type == "variants":
                available_stock = variant.stock if variant else 0
                price = variant.slashed_price or variant.mrp
            else:
                available_stock = product.stock
                price = get_product_price(product)

            if item.quantity > available_stock:
                return Response(
                    {"error": f"{product.title} has only {available_stock} left in stock."},
                    status=400,
                )

            subtotal_amount += Decimal(price) * item.quantity

        coupon_code = (request.data.get("coupon_code") or "").strip().upper()

        if coupon_code:
            try:
                applied_coupon = get_coupon_queryset().get(code=coupon_code)
            except Coupon.DoesNotExist:
                return Response({"error": "Coupon is invalid or unavailable."}, status=400)

            evaluation = evaluate_coupon_for_cart(
                applied_coupon,
                request.user,
                get_cart_line_items(cart_items),
            )

            if not evaluation["eligible"]:
                return Response(
                    {"error": evaluation["reason"] or "Coupon is not eligible for this cart."},
                    status=400,
                )

            discount_amount = evaluation["discount_amount"]

        total_amount = subtotal_amount - discount_amount

        order = Order.objects.create(
            user=request.user,
            subtotal_amount=subtotal_amount,
            discount_amount=discount_amount,
            total_amount=total_amount,
            coupon_code=applied_coupon.code if applied_coupon else "",
            shipping_email=(request.user.email or "").strip(),
            shipping_full_name=address.full_name,
            shipping_address=f"{address.address_line_1}, {address.address_line_2}",
            city=address.city,
            shipping_state=address.state,
            shipping_country=address.country,
            postal_code=address.postal_code,
            phone=address.phone,
            status="pending",
        )

        for item in cart_items:
            product = item.product
            variant = resolve_cart_item_variant(item, persist=True)

            if product.stock_type == "variants":
                price = variant.slashed_price or variant.mrp
            else:
                price = get_product_price(product)

            order_item = OrderItem.objects.create(
                order=order,
                product=product,
                variant=variant,
                quantity=item.quantity,
                price=price,
                custom_text=item.custom_text,
                custom_image=item.custom_image if not item.custom_images.exists() else None,
            )
            order_item.capture_product_snapshot(product=product, variant=variant)
            order_item.save(update_fields=[
                "product_title",
                "product_slug",
                "product_image",
                "product_category_name",
                "product_category_slug",
                "product_sub_category_name",
                "product_sub_category_slug",
                "variant_size_name",
                "variant_color_name",
                "variant_sku",
            ])

            for image in item.custom_images.all():
                OrderItemImage.objects.create(order_item=order_item, image=image.image)

            if product.stock_type == "variants":
                ProductVariant.objects.filter(id=variant.id).update(
                    stock=F("stock") - item.quantity
                )
            else:
                Product.objects.filter(id=product.id).update(
                    stock=F("stock") - item.quantity
                )

        if applied_coupon and discount_amount > 0:
            CouponUsage.objects.create(
                coupon=applied_coupon,
                user=request.user,
                order=order,
                discount_amount=discount_amount,
            )

        cart_items.delete()

        return Response(
            {
                "message": "Order created",
                "order": {
                    "id": order.id,
                    "order_number": str(order.order_number),
                    "subtotal": str(order.subtotal_amount),
                    "discount": str(order.discount_amount),
                    "coupon_code": order.coupon_code,
                    "total": str(order.total_amount),
                    "status": order.status,
                    "created_at": order.created_at,
                },
            },
            status=201,
        )

    except Exception as e:
        return Response({"error": str(e)}, status=400)


@api_view(["GET"])
def get_delhivery_pincode_serviceability(request):
    try:
        pincode = validate_indian_pincode(request.query_params.get("pincode"))
        payload = DelhiveryService().get_pincode_serviceability(pincode=pincode)
    except ValueError as exc:
        return Response({"error": str(exc)}, status=400)
    except ImproperlyConfigured as exc:
        return Response({"error": str(exc)}, status=500)
    except DelhiveryServiceError as exc:
        return Response({"error": str(exc)}, status=502)

    return Response(summarize_pincode_serviceability(payload, pincode=pincode))


@api_view(["GET"])
def get_delhivery_expected_tat(request):
    try:
        origin_pin = validate_indian_pincode(request.query_params.get("origin_pin"))
        destination_pin = validate_indian_pincode(
            request.query_params.get("destination_pin")
        )
        mot = validate_delhivery_mot(request.query_params.get("mot"))
        pdt = validate_optional_text(request.query_params.get("pdt"))
        expected_pickup_date = validate_expected_pickup_date(
            request.query_params.get("expected_pickup_date")
        )
        payload = DelhiveryService().get_expected_tat(
            origin_pin=origin_pin,
            destination_pin=destination_pin,
            mot=mot,
            pdt=pdt,
            expected_pickup_date=expected_pickup_date,
        )
    except ValueError as exc:
        return Response({"error": str(exc)}, status=400)
    except ImproperlyConfigured as exc:
        return Response({"error": str(exc)}, status=500)
    except DelhiveryServiceError as exc:
        return Response({"error": str(exc)}, status=502)

    return Response(
        summarize_expected_tat(
            payload,
            origin_pin=origin_pin,
            destination_pin=destination_pin,
            mot=mot,
            pdt=pdt,
            expected_pickup_date=expected_pickup_date,
        )
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_delhivery_shipment(request):
    if not request.user.is_staff:
        return Response({"error": "Forbidden."}, status=403)

    if set(request.data.keys()) - {"order_id"}:
        return Response(
            {"error": "Only order_id is allowed in the request body."},
            status=400,
        )

    try:
        order_id = validate_order_id(request.data.get("order_id"))
    except ValueError as exc:
        return Response({"error": str(exc)}, status=400)

    try:
        order, payload = create_delhivery_shipment_for_order_id(order_id)
    except Order.DoesNotExist:
        return Response({"error": "Order not found."}, status=404)
    except ValueError as exc:
        return Response({"error": str(exc)}, status=400)
    except ImproperlyConfigured as exc:
        return Response({"error": str(exc)}, status=500)
    except DelhiveryServiceError as exc:
        return Response({"error": str(exc)}, status=502)

    return Response(
        {
            "message": "Shipment created.",
            "shipment": summarize_delhivery_shipment(order, payload),
        },
        status=201,
    )


@api_view(["GET"])
def track_delhivery_shipment(request):
    try:
        tracking_inputs = validate_tracking_lookup_inputs(
            waybill=request.query_params.get("waybill"),
            order_number=request.query_params.get("order_id"),
            email=request.query_params.get("email"),
            phone=request.query_params.get("phone"),
        )
    except ValueError:
        return get_generic_tracking_error_response()

    lookup_filters = Q()
    if tracking_inputs["waybill"]:
        lookup_filters &= Q(delhivery_waybill=tracking_inputs["waybill"])
    else:
        lookup_filters &= Q(order_number=tracking_inputs["order_number"])

    candidate_orders = Order.objects.filter(lookup_filters).exclude(delhivery_waybill="")
    order = next(
        (
            candidate
            for candidate in candidate_orders
            if contact_matches_order(
                order=candidate,
                email=tracking_inputs["email"],
                phone=tracking_inputs["phone"],
            )
        ),
        None,
    )

    if not order or not order.delhivery_waybill:
        return get_generic_tracking_error_response()

    try:
        payload = DelhiveryService().track_shipment(
            waybill=order.delhivery_waybill,
            ref_ids=order.order_number,
        )
    except ImproperlyConfigured as exc:
        return Response({"error": str(exc)}, status=500)
    except DelhiveryServiceError:
        return Response({"error": "Unable to fetch tracking updates."}, status=502)

    return Response(summarize_tracking_response(order, payload))


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_delhivery_shipping_label(request):
    if not request.user.is_staff:
        return Response({"error": "Forbidden."}, status=403)

    try:
        order_id = validate_order_id(request.query_params.get("order_id"))
        pdf_size = validate_shipping_label_pdf_size(
            request.query_params.get("pdf_size")
        )
        order, payload = generate_delhivery_shipping_label_for_order_id(
            order_id,
            pdf=True,
            pdf_size=pdf_size,
        )
    except Order.DoesNotExist:
        return Response({"error": "Order not found."}, status=404)
    except ValueError as exc:
        return Response({"error": str(exc)}, status=400)
    except ImproperlyConfigured as exc:
        return Response({"error": str(exc)}, status=500)
    except DelhiveryServiceError as exc:
        return Response({"error": str(exc)}, status=502)

    return Response(summarize_delhivery_shipping_label(order, payload))


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def refresh_delhivery_tracking(request):
    if not request.user.is_staff:
        return Response({"error": "Forbidden."}, status=403)

    try:
        order_id = validate_order_id(request.data.get("order_id"))
        order, summary = refresh_delhivery_tracking_for_order_id(order_id)
    except Order.DoesNotExist:
        return Response({"error": "Order not found."}, status=404)
    except ValueError as exc:
        return Response({"error": str(exc)}, status=400)
    except ImproperlyConfigured as exc:
        return Response({"error": str(exc)}, status=500)
    except DelhiveryServiceError as exc:
        return Response({"error": str(exc)}, status=502)

    return Response(
        {
            **summary,
            "tracking_synced_at": order.delhivery_tracking_synced_at,
        }
    )


@api_view(["POST"])
@permission_classes([AllowAny])
def delhivery_scan_push_webhook(request):
    configured_secret = get_delhivery_webhook_secret()
    if not configured_secret:
        logger.error("delhivery_scan_push_missing_secret")
        return Response({"error": "Webhook secret is not configured."}, status=500)

    received_secret = str(
        request.headers.get("X-Delhivery-Webhook-Secret", "") or ""
    ).strip()
    if not received_secret or not hmac.compare_digest(received_secret, configured_secret):
        logger.warning("delhivery_scan_push_unauthorized")
        return Response({"error": "Forbidden."}, status=403)

    payload = request.data
    if not isinstance(payload, dict):
        return Response({"error": "Invalid payload."}, status=400)

    try:
        order, result = process_delhivery_scan_push_payload(payload)
    except ValueError as exc:
        return Response({"error": str(exc)}, status=400)

    if order is None:
        return Response({"ok": True, "ignored": result}, status=200)

    return Response(
        {
            "ok": True,
            "result": result,
            "order_id": order.id,
            "order_number": order.order_number,
            "waybill": order.delhivery_waybill,
        },
        status=200,
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_my_orders(request):
    orders = Order.objects.filter(user=request.user).order_by("-created_at")

    data = [
        {
                "id": order.id,
                "order_number": str(order.order_number),
                "subtotal": str(order.subtotal_amount),
                "discount": str(order.discount_amount),
                "coupon_code": order.coupon_code,
                "total": str(order.total_amount),
                "status": order.status,
                "created_at": order.created_at,
                "items_count": order.items.count(),
                "items": [
                    {
                        "product": serialize_order_item_product(item, request),
                        "variant": get_order_item_variant_snapshot(item),
                        "quantity": item.quantity,
                    }
                    for item in order.items.select_related(
                        "product",
                        "product__category",
                        "product__sub_category",
                        "variant",
                        "variant__size",
                        "variant__color",
                    )
                ],
        }
        for order in orders
    ]

    return Response({"orders": data, "count": len(data)})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_order_detail(request, order_id):
    order = get_object_or_404(Order, id=order_id, user=request.user)

    items = [
        {
            "product": serialize_order_item_product(item, request),
            "variant": get_order_item_variant_snapshot(item),
            "quantity": item.quantity,
            "price": str(item.price),
            "total": str(item.price * item.quantity),
            "custom_text": item.custom_text,
            "custom_images": build_secure_order_image_urls(request, item.custom_images.all()),
            "custom_image": (
                build_secure_order_media_url(request, item.custom_image)
                if item.custom_image
                else (
                    build_secure_order_media_url(request, item.custom_images.first().image)
                    if item.custom_images.exists()
                    else None
                )
            ),
        }
        for item in order.items.select_related(
            "product",
            "product__category",
            "product__sub_category",
            "variant",
            "variant__size",
            "variant__color",
        ).prefetch_related("custom_images")
    ]

    return Response(
        {
            "order": {
                "id": order.id,
                "order_number": str(order.order_number),
                "subtotal": str(order.subtotal_amount),
                "discount": str(order.discount_amount),
                "coupon_code": order.coupon_code,
                "total": str(order.total_amount),
                "status": order.status,
                "created_at": order.created_at,
                "shipping_address": order.shipping_address,
                "city": order.city,
                "postal_code": order.postal_code,
                "phone": order.phone,
                "items": items,
            }
        }
    )
