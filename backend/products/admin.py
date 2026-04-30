from django.contrib import admin
from django.contrib import messages
from django import forms
from django.db.models import IntegerField, Sum, Value
from django.db.models.functions import Coalesce
from django.http import HttpResponseNotAllowed
from django.shortcuts import redirect
from django.urls import path, reverse
from .models import Banner, Category, SubCategory, Product, ProductVariant, ProductImage, Size, Color

class ProductImageInline(admin.TabularInline):
    model = ProductImage
    extra = 1


@admin.register(Banner)
class BannerAdmin(admin.ModelAdmin):
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
    
    def has_add_permission(self, request, obj=None):
        return True

    def has_delete_permission(self, request, obj=None):
        return True

class ProductAdminForm(forms.ModelForm):
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
    list_display = ['title', 'mrp', 'slashed_price', 'stock_type', 'get_total_stock', 'is_active']
    list_select_related = ["category", "sub_category"]
    list_per_page = 50
    list_filter = ['stock_type', 'is_active', 'category']
    inlines = [ProductVariantInline, ProductImageInline]
    prepopulated_fields = {'slug': ('title',)}
    actions = ["archive_selected_products"]

    def get_queryset(self, request):
        queryset = super().get_queryset(request)
        return queryset.annotate(
            variant_stock_total=Coalesce(
                Sum("variants__stock"),
                Value(0),
                output_field=IntegerField(),
            )
        )
    
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
        js = ('admin/js/toggle_stock_fields.js', "admin/js/hide-fields.js", 'admin/js/filter_subcategory.js',)
    
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
        archived_count = 0
        already_archived_count = 0

        for product in queryset:
            if product.is_active:
                product.archive()
                archived_count += 1
            else:
                already_archived_count += 1

        if archived_count:
            self.message_user(
                request,
                f"Archived {archived_count} product(s).",
                level=messages.SUCCESS,
            )

        if already_archived_count:
            self.message_user(
                request,
                f"{already_archived_count} product(s) were already archived.",
                level=messages.INFO,
            )

    def get_actions(self, request):
        actions = super().get_actions(request)
        actions.pop("delete_selected", None)
        return actions

    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path(
                "<path:object_id>/archive/",
                self.admin_site.admin_view(self.archive_product_view),
                name="products_product_archive",
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
                extra_context["archive_product_url"] = reverse(
                    "admin:products_product_archive",
                    args=[product.pk],
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

    def archive_product_view(self, request, object_id):
        if request.method != "POST":
            return HttpResponseNotAllowed(["POST"])

        product = self.get_object(request, object_id)
        if not product:
            self.message_user(request, "Product not found.", level=messages.ERROR)
            return redirect("admin:products_product_changelist")

        was_active = product.is_active
        product.archive()

        if was_active:
            self.message_user(
                request,
                f'"{product.title}" has been archived.',
                level=messages.SUCCESS,
            )
        else:
            self.message_user(
                request,
                f'"{product.title}" is already archived.',
                level=messages.INFO,
            )

        return redirect("admin:products_product_change", product.pk)

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
    list_display = ['name', 'slug']
    prepopulated_fields = {'slug': ('name',)}

@admin.register(SubCategory)
class SubCategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "category")
    list_filter = ("category",)
    search_fields = ("name",)
    prepopulated_fields = {"slug": ("name",)}
