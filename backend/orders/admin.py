from django.contrib import admin, messages
from django import forms
from django.http import HttpResponseNotAllowed
from django.shortcuts import redirect
from django.urls import path, reverse
from django.utils import timezone
from django.utils.html import format_html, format_html_join
from django.utils.safestring import mark_safe
from django.db import models
from django.core.exceptions import ImproperlyConfigured

from .models import (
    Coupon,
    CouponUsage,
    Order,
    OrderItem,
    OrderItemImage,
    Cart,
    CartItem,
    CartItemImage,
)
from .views import (
    create_delhivery_shipment_for_order_id,
    generate_delhivery_shipping_label_for_order_id,
    refresh_delhivery_tracking_for_order_id,
    summarize_delhivery_shipping_label,
)
from utils.delhivery_service import DelhiveryServiceError


@admin.register(Coupon)
class CouponAdmin(admin.ModelAdmin):
    list_display = (
        "code",
        "title",
        "discount_type",
        "discount_value",
        "min_order_amount",
        "first_order_only",
        "is_active",
        "start_date",
        "end_date",
    )
    list_filter = ("discount_type", "first_order_only", "is_active", "start_date", "end_date")
    search_fields = ("code", "title", "description")
    filter_horizontal = ("categories", "subcategories")
    formfield_overrides = {
        models.TextField: {
            "widget": forms.Textarea(
                attrs={
                    "rows": 6,
                    "placeholder": "Enter one benefit or condition per line.",
                }
            )
        }
    }


@admin.register(CouponUsage)
class CouponUsageAdmin(admin.ModelAdmin):
    list_display = ("coupon", "user", "order", "discount_amount", "created_at")
    search_fields = ("coupon__code", "user__username", "user__email", "order__order_number")
    readonly_fields = ("created_at",)


class CartItemImageInline(admin.TabularInline):
    model = CartItemImage
    extra = 0
    fields = ("image",)


@admin.register(CartItem)
class CartItemAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "cart",
        "product",
        "variant",
        "quantity",
        "is_customized",
        "custom_image_count",
    )
    search_fields = ("product__title", "cart__user__username", "cart__user__email")
    list_filter = ("product", "variant")
    inlines = [CartItemImageInline]

    @admin.display(boolean=True, description="Customized")
    def is_customized(self, obj):
        return bool(obj.custom_text or obj.custom_image or obj.custom_images.exists())

    @admin.display(description="Image Count")
    def custom_image_count(self, obj):
        count = obj.custom_images.count()
        return count if count else (1 if obj.custom_image else 0)


@admin.register(CartItemImage)
class CartItemImageAdmin(admin.ModelAdmin):
    list_display = ("id", "cart_item", "image_preview")
    search_fields = ("cart_item__product__title", "cart_item__cart__user__email")

    @admin.display(description="Preview")
    def image_preview(self, obj):
        if not obj.image:
            return "-"
        return format_html(
            '<a href="{}" target="_blank" rel="noopener noreferrer">'
            '<img src="{}" style="width:60px;height:60px;object-fit:cover;border-radius:6px;" />'
            "</a>",
            obj.image.url,
            obj.image.url,
        )


class OrderItemInline(admin.StackedInline):
    model = OrderItem
    extra = 0
    fields = (
        "product",
        "variant",
        "quantity",
        "price",
        "customized_status",
        "custom_text",
        "custom_images_preview",
    )
    readonly_fields = ("customized_status", "custom_images_preview")
    show_change_link = True

    @admin.display(description="Customized")
    def customized_status(self, obj):
        return "Yes" if obj and (obj.custom_text or obj.custom_image or obj.custom_images.exists()) else "No"

    @admin.display(description="Customization Images")
    def custom_images_preview(self, obj):
        if not obj:
            return "-"

        images = []
        if obj.custom_images.exists():
            images = [image.image.url for image in obj.custom_images.all() if image.image]
        elif obj.custom_image:
            images = [obj.custom_image.url]

        if not images:
            return "No images"

        return mark_safe(
            "".join(
                '<a href="{0}" target="_blank" rel="noopener noreferrer">'
                '<img src="{0}" style="width:72px;height:72px;object-fit:cover;border-radius:8px;margin-right:8px;border:1px solid #444;" />'
                "</a>".format(image_url)
                for image_url in images
            )
        )


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    change_form_template = "admin/orders/order/change_form.html"
    list_display = (
        "order_number",
        "customer_name",
        "customer_email",
        "username",
        "status",
        "coupon_code",
        "discount_amount",
        "total_amount",
        "items_count",
        "city",
        "phone",
        "created_at",
    )
    search_fields = (
        "order_number",
        "user__username",
        "user__email",
        "user__first_name",
        "user__last_name",
        "phone",
        "city",
        "shipping_address",
    )
    list_filter = ("status", "created_at", "city")
    readonly_fields = (
        "created_at",
        "updated_at",
        "shipment_summary",
        "delhivery_waybill",
        "delhivery_reference",
        "delhivery_client_name",
        "delhivery_shipment_status",
        "delhivery_payment_mode",
        "delhivery_created_at",
        "delhivery_tracking_status_label",
        "delhivery_tracking_status_code",
        "delhivery_tracking_status_type",
        "delhivery_last_scan_at",
        "delhivery_last_scan_location",
        "delhivery_tracking_synced_at",
        "delhivery_raw_response",
        "delhivery_tracking_raw_response",
    )
    inlines = [OrderItemInline]
    fieldsets = (
        (
            "Order",
            {
                "fields": (
                    "user",
                    "order_number",
                    "status",
                    "coupon_code",
                    "subtotal_amount",
                    "discount_amount",
                    "total_amount",
                )
            },
        ),
        (
            "Payment",
            {
                "fields": (
                    "payment_provider",
                    "razorpay_order_id",
                    "razorpay_payment_id",
                    "razorpay_signature",
                    "payment_verified_at",
                    "payment_processed",
                    "refund_processed",
                )
            },
        ),
        (
            "Shipping Details",
            {
                "fields": (
                    "shipping_email",
                    "shipping_full_name",
                    "shipping_address",
                    "city",
                    "shipping_state",
                    "shipping_country",
                    "postal_code",
                    "phone",
                )
            },
        ),
        (
            "Shipment Summary",
            {
                "fields": (
                    "shipment_summary",
                )
            },
        ),
        (
            "Delhivery Raw Data",
            {
                "classes": ("collapse",),
                "fields": (
                    "delhivery_raw_response",
                    "delhivery_tracking_raw_response",
                ),
            },
        ),
        (
            "Audit",
            {
                "fields": (
                    "created_at",
                    "updated_at",
                )
            },
        ),
    )

    class Media:
        css = {"all": ("admin/css/admin_custom.css",)}

    def can_create_delhivery_shipment(self, obj):
        if not obj:
            return False

        return not obj.delhivery_waybill and obj.status not in {"failed", "cancelled"}

    def can_generate_delhivery_shipping_label(self, obj):
        if not obj:
            return False

        return bool(obj.delhivery_waybill) and obj.status not in {"failed", "cancelled"}

    def can_refresh_delhivery_tracking(self, obj):
        if not obj:
            return False

        return bool(obj.delhivery_waybill)

    @admin.display(description="Shipment Summary")
    def shipment_summary(self, obj):
        if not obj:
            return "-"

        def display(value, empty="Not available"):
            normalized = str(value or "").strip()
            return normalized or empty

        def display_dt(value, empty="Not available"):
            if not value:
                return empty

            local_value = timezone.localtime(value) if timezone.is_aware(value) else value
            return local_value.strftime("%d %b %Y, %I:%M %p")

        latest_status = display(
            obj.delhivery_tracking_status_label or obj.delhivery_shipment_status,
            "Tracking pending",
        )

        rows = (
            ("AWB", display(obj.delhivery_waybill, "Not created")),
            ("Reference", display(obj.delhivery_reference)),
            ("Client", display(obj.delhivery_client_name)),
            ("Shipment State", display(obj.delhivery_shipment_status, "Not created")),
            ("Payment Mode", display(obj.delhivery_payment_mode)),
            ("Latest Tracking", latest_status),
            ("Tracking Code", display(obj.delhivery_tracking_status_code)),
            ("Tracking Type", display(obj.delhivery_tracking_status_type)),
            ("Last Scan Location", display(obj.delhivery_last_scan_location, "No scans yet")),
            ("Last Scan Time", display_dt(obj.delhivery_last_scan_at, "No scans yet")),
            ("Tracking Synced", display_dt(obj.delhivery_tracking_synced_at, "Never synced")),
            ("Shipment Created", display_dt(obj.delhivery_created_at, "Not created")),
        )

        return format_html(
            '<div class="shipment-summary-grid">{}</div>',
            format_html_join(
                "",
                (
                    '<div class="shipment-summary-card">'
                    '<div class="shipment-summary-label">{}</div>'
                    '<div class="shipment-summary-value">{}</div></div>'
                ),
                ((label, value) for label, value in rows),
            ),
        )

    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path(
                "<path:object_id>/create-shipment/",
                self.admin_site.admin_view(self.create_shipment_view),
                name="orders_order_create_shipment",
            ),
            path(
                "<path:object_id>/generate-shipping-label/",
                self.admin_site.admin_view(self.generate_shipping_label_view),
                name="orders_order_generate_shipping_label",
            ),
            path(
                "<path:object_id>/refresh-tracking/",
                self.admin_site.admin_view(self.refresh_tracking_view),
                name="orders_order_refresh_tracking",
            ),
        ]
        return custom_urls + urls

    def changeform_view(self, request, object_id=None, form_url="", extra_context=None):
        extra_context = extra_context or {}

        if object_id:
            obj = self.get_object(request, object_id)
            if obj and self.can_create_delhivery_shipment(obj):
                extra_context["show_create_shipment_button"] = True
                extra_context["create_shipment_url"] = reverse(
                    "admin:orders_order_create_shipment",
                    args=[obj.pk],
                )
            if obj and self.can_generate_delhivery_shipping_label(obj):
                extra_context["show_generate_shipping_label_button"] = True
                extra_context["generate_shipping_label_url"] = reverse(
                    "admin:orders_order_generate_shipping_label",
                    args=[obj.pk],
                )
            if obj and self.can_refresh_delhivery_tracking(obj):
                extra_context["show_refresh_tracking_button"] = True
                extra_context["refresh_tracking_url"] = reverse(
                    "admin:orders_order_refresh_tracking",
                    args=[obj.pk],
                )

        return super().changeform_view(
            request,
            object_id=object_id,
            form_url=form_url,
            extra_context=extra_context,
        )

    def create_shipment_view(self, request, object_id):
        if request.method != "POST":
            return HttpResponseNotAllowed(["POST"])

        obj = self.get_object(request, object_id)
        if obj is None:
            self.message_user(request, "Order not found.", level=messages.ERROR)
            return redirect("admin:orders_order_changelist")

        if not self.has_change_permission(request, obj):
            self.message_user(
                request,
                "You do not have permission to update this order.",
                level=messages.ERROR,
            )
            return redirect("admin:orders_order_change", obj.pk)

        if not self.can_create_delhivery_shipment(obj):
            self.message_user(
                request,
                "Shipment creation is only available for active orders without an existing waybill.",
                level=messages.ERROR,
            )
            return redirect("admin:orders_order_change", obj.pk)

        try:
            order, _ = create_delhivery_shipment_for_order_id(obj.pk)
        except Order.DoesNotExist:
            self.message_user(request, "Order not found.", level=messages.ERROR)
            return redirect("admin:orders_order_changelist")
        except (ValueError, ImproperlyConfigured, DelhiveryServiceError) as exc:
            self.message_user(request, str(exc), level=messages.ERROR)
            return redirect("admin:orders_order_change", obj.pk)

        self.message_user(
            request,
            f"Shipment created for order {order.order_number}. Waybill: {order.delhivery_waybill}.",
            level=messages.SUCCESS,
        )
        return redirect("admin:orders_order_change", order.pk)

    def generate_shipping_label_view(self, request, object_id):
        if request.method != "POST":
            return HttpResponseNotAllowed(["POST"])

        obj = self.get_object(request, object_id)
        if obj is None:
            self.message_user(request, "Order not found.", level=messages.ERROR)
            return redirect("admin:orders_order_changelist")

        if not self.has_change_permission(request, obj):
            self.message_user(
                request,
                "You do not have permission to update this order.",
                level=messages.ERROR,
            )
            return redirect("admin:orders_order_change", obj.pk)

        if not self.can_generate_delhivery_shipping_label(obj):
            self.message_user(
                request,
                "Shipping label generation is only available for active orders with an existing waybill.",
                level=messages.ERROR,
            )
            return redirect("admin:orders_order_change", obj.pk)

        try:
            order, payload = generate_delhivery_shipping_label_for_order_id(
                obj.pk,
                pdf=True,
                pdf_size="4R",
            )
        except Order.DoesNotExist:
            self.message_user(request, "Order not found.", level=messages.ERROR)
            return redirect("admin:orders_order_changelist")
        except (ValueError, ImproperlyConfigured, DelhiveryServiceError) as exc:
            self.message_user(request, str(exc), level=messages.ERROR)
            return redirect("admin:orders_order_change", obj.pk)

        label = summarize_delhivery_shipping_label(order, payload)["label"]
        pdf_download_link = str(label.get("pdf_download_link") or "").strip()

        if pdf_download_link:
            self.message_user(
                request,
                f"Shipping label generated for order {order.order_number}.",
                level=messages.SUCCESS,
            )
            return redirect(pdf_download_link)

        self.message_user(
            request,
            f"Shipping label generated for order {order.order_number}, but no download link was returned.",
            level=messages.WARNING,
        )
        return redirect("admin:orders_order_change", order.pk)

    def refresh_tracking_view(self, request, object_id):
        if request.method != "POST":
            return HttpResponseNotAllowed(["POST"])

        obj = self.get_object(request, object_id)
        if obj is None:
            self.message_user(request, "Order not found.", level=messages.ERROR)
            return redirect("admin:orders_order_changelist")

        if not self.has_change_permission(request, obj):
            self.message_user(
                request,
                "You do not have permission to update this order.",
                level=messages.ERROR,
            )
            return redirect("admin:orders_order_change", obj.pk)

        if not self.can_refresh_delhivery_tracking(obj):
            self.message_user(
                request,
                "Tracking refresh is only available for orders with an existing waybill.",
                level=messages.ERROR,
            )
            return redirect("admin:orders_order_change", obj.pk)

        try:
            order, summary = refresh_delhivery_tracking_for_order_id(obj.pk)
        except Order.DoesNotExist:
            self.message_user(request, "Order not found.", level=messages.ERROR)
            return redirect("admin:orders_order_changelist")
        except (ValueError, ImproperlyConfigured, DelhiveryServiceError) as exc:
            self.message_user(request, str(exc), level=messages.ERROR)
            return redirect("admin:orders_order_change", obj.pk)

        status_label = str((summary.get("status") or {}).get("label") or "").strip()
        status_suffix = f" Latest status: {status_label}." if status_label else ""
        self.message_user(
            request,
            f"Tracking refreshed for order {order.order_number}.{status_suffix}",
            level=messages.SUCCESS,
        )
        return redirect("admin:orders_order_change", order.pk)

    @admin.display(description="Customer Name")
    def customer_name(self, obj):
        full_name = obj.user.get_full_name().strip()
        return full_name or "-"

    @admin.display(description="Customer Email")
    def customer_email(self, obj):
        return obj.user.email or "-"

    @admin.display(description="Username")
    def username(self, obj):
        return obj.user.username

    @admin.display(description="Items")
    def items_count(self, obj):
        return obj.items.count()


class OrderItemImageInline(admin.TabularInline):
    model = OrderItemImage
    extra = 0
    fields = ("image",)


@admin.register(OrderItem)
class OrderItemAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "order",
        "product",
        "variant",
        "quantity",
        "price",
        "is_customized",
        "custom_image_count",
    )
    search_fields = (
        "order__order_number",
        "product__title",
        "order__user__username",
        "order__user__email",
        "custom_text",
    )
    list_filter = ("variant", "order__status")
    inlines = [OrderItemImageInline]
    readonly_fields = ("custom_images_preview",)
    fieldsets = (
        (
            None,
            {
                "fields": (
                    "order",
                    "product",
                    "variant",
                    "quantity",
                    "price",
                    "custom_text",
                    "custom_image",
                    "custom_images_preview",
                )
            },
        ),
    )

    @admin.display(boolean=True, description="Customized")
    def is_customized(self, obj):
        return bool(obj.custom_text or obj.custom_image or obj.custom_images.exists())

    @admin.display(description="Image Count")
    def custom_image_count(self, obj):
        count = obj.custom_images.count()
        return count if count else (1 if obj.custom_image else 0)

    @admin.display(description="Customization Images")
    def custom_images_preview(self, obj):
        images = []
        if obj.custom_images.exists():
            images = [image.image.url for image in obj.custom_images.all() if image.image]
        elif obj.custom_image:
            images = [obj.custom_image.url]

        if not images:
            return "No images"

        return mark_safe(
            "".join(
                '<a href="{0}" target="_blank" rel="noopener noreferrer">'
                '<img src="{0}" style="width:72px;height:72px;object-fit:cover;border-radius:8px;margin-right:8px;border:1px solid #444;" />'
                "</a>".format(image_url)
                for image_url in images
            )
        )


@admin.register(OrderItemImage)
class OrderItemImageAdmin(admin.ModelAdmin):
    list_display = ("id", "order_item", "image_preview")
    search_fields = ("order_item__order__order_number", "order_item__product__title")

    @admin.display(description="Preview")
    def image_preview(self, obj):
        if not obj.image:
            return "-"
        return format_html(
            '<a href="{}" target="_blank" rel="noopener noreferrer">'
            '<img src="{}" style="width:60px;height:60px;object-fit:cover;border-radius:6px;" />'
            "</a>",
            obj.image.url,
            obj.image.url,
        )


@admin.register(Cart)
class CartAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "created_at", "updated_at")
    search_fields = ("user__username", "user__email")
