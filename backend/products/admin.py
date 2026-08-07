from django.contrib import admin
from django.contrib import messages
from django import forms
from django.conf import settings
from django.core.files.uploadedfile import UploadedFile
from django.db.models import IntegerField, Sum, Value
from django.db.models.functions import Coalesce
from django.http import HttpResponseNotAllowed
from django.shortcuts import redirect, render
from django.urls import path, reverse
from django.utils.html import format_html
from urllib.parse import quote
from .models import Banner, Category, SubCategory, Product, ProductVariant, ProductImage, Size, Color
from utils.validation import optimize_catalog_image


class CatalogImageAdminForm(forms.ModelForm):
    """Process catalog assets before they are sent to media storage."""

    def clean_image(self):
        value = self.cleaned_data.get("image")
        if isinstance(value, UploadedFile):
            return optimize_catalog_image(value)
        return value


class BannerAdminForm(CatalogImageAdminForm):
    class Meta:
        model = Banner
        fields = "__all__"


class ProductImageAdminForm(CatalogImageAdminForm):
    class Meta:
        model = ProductImage
        fields = "__all__"


class CategoryAdminForm(CatalogImageAdminForm):
    class Meta:
        model = Category
        fields = "__all__"


class SubCategoryAdminForm(CatalogImageAdminForm):
    class Meta:
        model = SubCategory
        fields = "__all__"

class ProductImageInline(admin.TabularInline):
    model = ProductImage
    form = ProductImageAdminForm
    extra = 1


@admin.register(Banner)
class BannerAdmin(admin.ModelAdmin):
    form = BannerAdminForm
    list_display = [
        "title",
        "type",
        "priority",
        "is_active",
        "start_date",
        "end_date",
        "updated_at",
    ]
    list_filter = ["type", "is_active", "start_date", "end_date"]
    search_fields = ["title", "subtitle", "description", "cta_text", "cta_link"]
    ordering = ["priority", "-updated_at"]
    readonly_fields = ["created_at", "updated_at"]
    fieldsets = (
        ("Content", {
            "fields": (
                "type",
                "title",
                "subtitle",
                "description",
                "image",
                "cta_text",
                "cta_link",
            )
        }),
        ("Presentation", {
            "fields": (
                "background_color",
                "text_color",
                "priority",
                "metadata",
            )
        }),
        ("Scheduling", {
            "fields": (
                "is_active",
                "start_date",
                "end_date",
            )
        }),
        ("Audit", {
            "fields": (
                "created_at",
                "updated_at",
            )
        }),
    )

class ProductVariantInline(admin.TabularInline):
    model = ProductVariant
    extra = 1
    fields = ['size', 'color', 'mrp', 'slashed_price', 'discount_percent', 'stock']

    default_variant_rows = [
        {
            "size": "12X18 in",
            "color": "Black",
            "mrp": 500,
            "slashed_price": 480,
            "discount_percent": 4,
            "stock": 10,
        },
        {
            "size": "12X18 in",
            "color": "Dark brown",
            "mrp": 500,
            "slashed_price": 480,
            "discount_percent": 4,
            "stock": 10,
        },
        {
            "size": "18X24 in",
            "color": "Black",
            "mrp": 1500,
            "slashed_price": 1350,
            "discount_percent": 10,
            "stock": 10,
        },
        {
            "size": "18X24 in",
            "color": "Dark brown",
            "mrp": 1500,
            "slashed_price": 1350,
            "discount_percent": 10,
            "stock": 10,
        },
        {
            "size": "2ft by 3ft",
            "color": "Black",
            "mrp": 2500,
            "slashed_price": 2350,
            "discount_percent": 6,
            "stock": 10,
        },
        {
            "size": "2ft by 3ft",
            "color": "Dark brown",
            "mrp": 2500,
            "slashed_price": 2350,
            "discount_percent": 6,
            "stock": 10,
        },
        {
            "size": "8X12 in",
            "color": "Black",
            "mrp": 450,
            "slashed_price": 320,
            "discount_percent": 29,
            "stock": 10,
        },
        {
            "size": "8X12 in",
            "color": "Dark brown",
            "mrp": 450,
            "slashed_price": 320,
            "discount_percent": 29,
            "stock": 10,
        },
    ]

    def get_extra(self, request, obj=None, **kwargs):
        if obj is None:
            return len(self.default_variant_rows)
        return self.extra

    def _build_default_initial_rows(self):
        size_ids = {
            size.name.lower(): size.pk
            for size in Size.objects.filter(
                name__in=[row["size"] for row in self.default_variant_rows]
            )
        }
        color_ids = {
            color.name.lower(): color.pk
            for color in Color.objects.filter(
                name__in=[row["color"] for row in self.default_variant_rows]
            )
        }

        initial_rows = []
        for row in self.default_variant_rows:
            initial_rows.append(
                {
                    "size": size_ids.get(row["size"].lower()),
                    "color": color_ids.get(row["color"].lower()),
                    "mrp": row["mrp"],
                    "slashed_price": row["slashed_price"],
                    "discount_percent": row["discount_percent"],
                    "stock": row["stock"],
                }
            )
        return initial_rows

    def get_formset(self, request, obj=None, **kwargs):
        formset = super().get_formset(request, obj, **kwargs)
        default_initial_rows = self._build_default_initial_rows()

        class PrefilledProductVariantFormSet(formset):
            def __init__(self, *args, **inner_kwargs):
                if obj is None and not inner_kwargs.get("data") and not inner_kwargs.get("files"):
                    inner_kwargs["initial"] = default_initial_rows
                super().__init__(*args, **inner_kwargs)

        return PrefilledProductVariantFormSet
    
    def has_add_permission(self, request, obj=None):
        return True

    def has_delete_permission(self, request, obj=None):
        return True

class ProductAdminForm(CatalogImageAdminForm):
    stock_type = forms.ChoiceField(
        choices=Product.STOCK_TYPE_CHOICES,
        widget=forms.RadioSelect,
        help_text="Select how you want to manage stock for this product"
    )

    class Meta:
        model = Product
        fields = '__all__'

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        # Default queryset = all (fallback)
        self.fields['sub_category'].queryset = SubCategory.objects.all()

        # Case 1 — Editing existing product
        if self.instance and self.instance.pk and self.instance.category:
            self.fields['sub_category'].queryset = SubCategory.objects.filter(
                category=self.instance.category
            )

        # Case 2 — Category selected in POST/GET data
        elif 'category' in self.data:
            try:
                category_id = int(self.data.get('category'))
                self.fields['sub_category'].queryset = SubCategory.objects.filter(
                    category_id=category_id
                )
            except (ValueError, TypeError):
                pass


    def clean(self):
        cleaned_data = super().clean()

        stock_type = cleaned_data.get("stock_type")
        stock = cleaned_data.get("stock")

        if stock_type == "main":
            if stock < 0:
                raise forms.ValidationError(
                    "Main stock must be set when using Main Stock."
                )

        if stock_type == "variants":
            cleaned_data["stock"] = 0

        return cleaned_data


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    form = ProductAdminForm
    list_display = ['title', 'category', 'mrp', 'slashed_price', 'stock_type', 'get_total_stock']
    list_select_related = ["category", "sub_category"]
    list_per_page = 50
    list_filter = ['stock_type', 'category']
    inlines = [ProductVariantInline, ProductImageInline]
    prepopulated_fields = {'slug': ('title',)}
    actions = ["archive_selected_products", "restore_selected_products", "permanently_delete_selected"]

    def get_queryset(self, request):
        queryset = super().get_queryset(request).annotate(
            variant_stock_total=Coalesce(
                Sum("variants__stock"),
                Value(0),
                output_field=IntegerField(),
            )
        )
        kind = getattr(request, "product_changelist_kind", None)
        if kind == "archived":
            return queryset.filter(is_active=False)
        if kind == "active":
            return queryset.filter(is_active=True)
        return queryset

    def changelist_view(self, request, extra_context=None):
        if request.path.rstrip("/").endswith("/archived"):
            request.product_changelist_kind = "archived"
            extra_context = dict(extra_context or {})
            extra_context["archived_list"] = True
            extra_context["title"] = "Archived Products"
        else:
            request.product_changelist_kind = "active"
        return super().changelist_view(request, extra_context=extra_context)

    def get_list_display(self, request):
        if getattr(request, "product_changelist_kind", None) == "archived":
            return (
                "title",
                "category",
                "mrp",
                "get_total_stock",
                "archived_reason",
                "archived_at_display",
                "storefront_status",
                "archived_actions",
            )
        return super().get_list_display(request)

    def archived_reason(self, obj):
        blockers = obj.get_delete_blockers()
        return ", ".join(blockers) if blockers else "Archived manually"
    archived_reason.short_description = "Archive reason"

    def archived_at_display(self, obj):
        if not obj.archived_at:
            return "—"
        return obj.archived_at.strftime("%d %b %Y, %H:%M")
    archived_at_display.short_description = "Archived on"
    archived_at_display.admin_order_field = "archived_at"

    def storefront_status(self, obj):
        if obj.hidden_from_storefront:
            label = '<span style="color:#ba2121;font-weight:600;">Hidden</span>'
            action = "Show"
        else:
            label = '<span style="color:#417690;font-weight:600;">Visible</span>'
            action = "Hide"
        toggle_url = reverse("admin:products_product_storefront_toggle", args=[obj.pk])
        return format_html(
            "{} &nbsp; <a href='{}'>{} on storefront</a>",
            label,
            toggle_url,
            action,
        )
    storefront_status.short_description = "Storefront"

    def archived_actions(self, obj):
        restore_url = reverse("admin:products_product_restore", args=[obj.pk])
        view_url = f"{settings.FRONTEND_URL.rstrip('/')}/products/{obj.pk}"
        return format_html(
            '<a href="{}">Restore</a> &nbsp;|&nbsp; '
            '<a href="{}" target="_blank" rel="noopener">View</a>',
            restore_url,
            view_url,
        )
    archived_actions.short_description = "Actions"

    def get_actions(self, request):
        actions = super().get_actions(request)
        kind = getattr(request, "product_changelist_kind", None)
        if kind == "archived":
            actions.pop("archive_selected_products", None)
        else:
            actions.pop("restore_selected_products", None)
            actions.pop("permanently_delete_selected", None)
        actions.pop("delete_selected", None)
        return actions
    
    def get_fieldsets(self, request, obj=None):
        fieldsets = (
            ('Basic Information', {
                'fields': ('title', 'slug', 'description', 'category', 'sub_category', 'is_active')
            }),
            ('Main Product Image', {
                'fields': ('image',)
            }),
            ('Customization', {
                'fields': ('allow_custom_image', 'custom_image_limit', 'allow_custom_text'),
                'description': 'Allow customers to customize this product'
            }),
            ('Stock Management', {
                'fields': ('stock_type', 'stock', 'mrp', 'slashed_price', 'discount_percent')
            }),
        )
        if obj:
            fieldsets += (
                ("Deletion", {
                    "fields": ("deletion_status",),
                    "description": "Products can be permanently deleted only when they are not referenced in carts, orders, or stock reservations.",
                }),
            )
        return fieldsets

    def get_readonly_fields(self, request, obj=None):
        readonly_fields = list(super().get_readonly_fields(request, obj))
        if obj:
            readonly_fields.append("deletion_status")
        return readonly_fields
    
    class Media:
        css = {'all': ('admin/css/admin_custom.css',)}
        js = ('admin/js/toggle_stock_fields.js', "admin/js/hide-fields.js", 'admin/js/filter_subcategory.js', 'admin/js/product_form_progress.js',)
    
    def save_model(self, request, obj, form, change):
        """
        Commit only the selected stock type values.
        Variant stock → stock must always be 0.
        """
        if obj.stock_type == "variants":
            obj.stock = 0  # ✅ force database value

        super().save_model(request, obj, form, change)

    def get_total_stock(self, obj):
        if obj.stock_type == "main":
            return obj.stock
        return getattr(obj, "variant_stock_total", 0)
    get_total_stock.short_description = 'Total Stock'

    def deletion_status(self, obj):
        blockers = obj.get_delete_blockers()
        if not blockers:
            return "Eligible for permanent delete."

        blocker_text = ", ".join(blockers)
        return f"Archive only. Permanent delete blocked by: {blocker_text}."
    deletion_status.short_description = "Deletion status"

    def delete_model(self, request, obj):
        obj.delete()

    def delete_queryset(self, request, queryset):
        for product in queryset:
            product.delete()

    @admin.action(description="Archive selected products")
    def archive_selected_products(self, request, queryset):
        ids = ",".join(str(pk) for pk in queryset.values_list("pk", flat=True))
        url = reverse("admin:products_product_archive_confirm")
        return redirect(f"{url}?ids={ids}&next={quote(request.path)}")

    @admin.action(description="Restore selected archived products")
    def restore_selected_products(self, request, queryset):
        restored_count = 0
        for product in queryset:
            if not product.is_active:
                product.restore()
                restored_count += 1
        self.message_user(
            request,
            f"Restored {restored_count} product(s).",
            level=messages.SUCCESS,
        )

    @admin.action(description="Permanently delete selected archived products")
    def permanently_delete_selected(self, request, queryset):
        deleted_count = 0
        skipped = []
        for product in queryset:
            if product.can_hard_delete():
                product.delete()
                deleted_count += 1
            else:
                skipped.append(
                    f"{product.title} ({', '.join(product.get_delete_blockers())})"
                )

        if deleted_count:
            self.message_user(
                request,
                f"Permanently deleted {deleted_count} product(s).",
                level=messages.SUCCESS,
            )
        if skipped:
            self.message_user(
                request,
                "Skipped (still referenced): " + "; ".join(skipped),
                level=messages.WARNING,
            )

    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path(
                "archived/",
                self.admin_site.admin_view(self.changelist_view),
                name="products_product_archived",
            ),
            path(
                "archive-confirm/",
                self.admin_site.admin_view(self.archive_confirm_view),
                name="products_product_archive_confirm",
            ),
            path(
                "<path:object_id>/restore/",
                self.admin_site.admin_view(self.restore_product_view),
                name="products_product_restore",
            ),
            path(
                "<path:object_id>/storefront-toggle/",
                self.admin_site.admin_view(self.storefront_toggle_view),
                name="products_product_storefront_toggle",
            ),
            path(
                "<path:object_id>/permanently-delete/",
                self.admin_site.admin_view(self.permanently_delete_product_view),
                name="products_product_permanently_delete",
            ),
        ]
        return custom_urls + urls

    def changeform_view(self, request, object_id=None, form_url="", extra_context=None):
        extra_context = extra_context or {}

        if object_id:
            product = self.get_object(request, object_id)
            if product:
                change_url = reverse("admin:products_product_change", args=[product.pk])
                if product.is_active:
                    extra_context["archive_confirm_url"] = (
                        reverse("admin:products_product_archive_confirm")
                        + f"?ids={product.pk}&next={quote(change_url)}"
                    )
                else:
                    extra_context["restore_product_url"] = (
                        reverse("admin:products_product_restore", args=[product.pk])
                        + f"?next={quote(change_url)}"
                    )
                extra_context["show_permanent_delete_button"] = product.can_hard_delete()
                if product.can_hard_delete():
                    extra_context["permanent_delete_product_url"] = reverse(
                        "admin:products_product_delete",
                        args=[product.pk],
                    )
                extra_context["show_delete"] = False

        return super().changeform_view(
            request,
            object_id=object_id,
            form_url=form_url,
            extra_context=extra_context,
        )

    def _safe_redirect_target(self, request):
        target = request.GET.get("next") or request.POST.get("next") or ""
        if target.startswith("/") and not target.startswith("//"):
            return target
        return reverse("admin:products_product_archived")

    def _parse_archive_ids(self, request):
        ids = request.POST.getlist("product_ids") or request.GET.get("ids", "").split(",")
        parsed = []
        for value in ids:
            try:
                parsed.append(int(value))
            except (TypeError, ValueError):
                continue
        return parsed

    def archive_confirm_view(self, request):
        products = Product.objects.filter(pk__in=self._parse_archive_ids(request))

        if request.method == "POST":
            archived_count = 0
            hide_from_storefront = request.POST.get("hide_from_storefront") in {"1", "on", "true", "yes"}
            for product in products:
                if product.is_active:
                    product.archive(hide_from_storefront=hide_from_storefront)
                    archived_count += 1
            self.message_user(
                request,
                f"Archived {archived_count} product(s).",
                level=messages.SUCCESS,
            )
            return redirect(self._safe_redirect_target(request))

        return render(
            request,
            "admin/products/product/archive_confirm.html",
            {
                "products": products,
                "next": self._safe_redirect_target(request),
                "opts": self.model._meta,
                "title": "Archive products",
            },
        )

    def restore_product_view(self, request, object_id):
        product = self.get_object(request, object_id)
        if not product:
            self.message_user(request, "Product not found.", level=messages.ERROR)
            return redirect(self._safe_redirect_target(request))

        if not product.is_active:
            product.restore()
            self.message_user(
                request,
                f'"{product.title}" has been restored.',
                level=messages.SUCCESS,
            )
        else:
            self.message_user(
                request,
                f'"{product.title}" is already active.',
                level=messages.INFO,
            )

        return redirect(self._safe_redirect_target(request))

    def storefront_toggle_view(self, request, object_id):
        product = self.get_object(request, object_id)
        if not product:
            self.message_user(request, "Product not found.", level=messages.ERROR)
            return redirect(self._safe_redirect_target(request))

        product.hidden_from_storefront = not product.hidden_from_storefront
        product.save(update_fields=["hidden_from_storefront"])
        state = "hidden from" if product.hidden_from_storefront else "shown on"
        self.message_user(
            request,
            f'"{product.title}" is now {state} the storefront.',
            level=messages.SUCCESS,
        )

        return redirect(self._safe_redirect_target(request))

    def permanently_delete_product_view(self, request, object_id):
        if request.method != "POST":
            return HttpResponseNotAllowed(["POST"])

        product = self.get_object(request, object_id)
        if not product:
            self.message_user(request, "Product not found.", level=messages.ERROR)
            return redirect("admin:products_product_changelist")

        blockers = product.get_delete_blockers()
        if blockers:
            self.message_user(
                request,
                f'Cannot permanently delete "{product.title}". Blocked by: {", ".join(blockers)}.',
                level=messages.ERROR,
            )
            return redirect("admin:products_product_change", product.pk)

        product_title = product.title
        product.delete()
        self.message_user(
            request,
            f'"{product_title}" has been permanently deleted.',
            level=messages.SUCCESS,
        )
        return redirect("admin:products_product_changelist")

@admin.register(Size)
class SizeAdmin(admin.ModelAdmin):
    list_display = ['name']
    search_fields = ['name']

@admin.register(Color)
class ColorAdmin(admin.ModelAdmin):
    list_display = ['name', 'hex_code']
    search_fields = ['name']

@admin.register(ProductVariant)
class ProductVariantAdmin(admin.ModelAdmin):

    # ✅ Hide from sidebar
    def has_module_permission(self, request):
        return False


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    form = CategoryAdminForm
    list_display = ['name', 'slug']
    prepopulated_fields = {'slug': ('name',)}

@admin.register(SubCategory)
class SubCategoryAdmin(admin.ModelAdmin):
    form = SubCategoryAdminForm
    list_display = ("name", "category")
    list_filter = ("category",)
    search_fields = ("name",)
    prepopulated_fields = {"slug": ("name",)}
