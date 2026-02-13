from django.contrib import admin
from django import forms
from .models import Category, SubCategory, Product, ProductVariant, ProductImage, Size, Color

class ProductImageInline(admin.TabularInline):
    model = ProductImage
    extra = 1

class ProductVariantInline(admin.TabularInline):
    model = ProductVariant
    extra = 1
    fields = ['size', 'color', 'mrp', 'slashed_price', 'discount_percent', 'stock', 'sku']
    
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

    list_filter = ['stock_type', 'is_active', 'category']
    inlines = [ProductVariantInline, ProductImageInline]
    prepopulated_fields = {'slug': ('title',)}
    
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
        return fieldsets
    
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
        return obj.get_total_stock()
    get_total_stock.short_description = 'Total Stock'

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

    # ✅ Block direct viewing in admin list
    def has_view_permission(self, request, obj=None):
        return False

    # ✅ Block adding directly
    def has_add_permission(self, request):
        return False

    # ✅ Block editing directly
    def has_change_permission(self, request, obj=None):
        return False

    # ✅ Block deleting directly
    def has_delete_permission(self, request, obj=None):
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
