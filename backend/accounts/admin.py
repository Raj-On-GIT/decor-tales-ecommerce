from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from django.contrib.auth.models import User

from .models import Address, UserProfile


class UserProfileInline(admin.StackedInline):
    model = UserProfile
    can_delete = False
    extra = 0
    max_num = 1
    fields = ("phone", "created_at", "updated_at")
    readonly_fields = ("created_at", "updated_at")
    verbose_name_plural = "Profile"


@admin.register(Address)
class AddressAdmin(admin.ModelAdmin):
    list_display = ("full_name", "user", "phone", "city", "state", "postal_code", "is_default")
    list_filter = ("is_default", "city", "state", "country")
    search_fields = ("full_name", "user__username", "user__email", "phone", "city", "postal_code")
    list_select_related = ("user",)


class UserAdmin(DjangoUserAdmin):
    inlines = (UserProfileInline,)
    list_display = DjangoUserAdmin.list_display + ("phone_number",)
    search_fields = DjangoUserAdmin.search_fields + ("profile__phone",)

    def phone_number(self, obj):
        return getattr(obj.profile, "phone", "")

    phone_number.short_description = "Phone"


admin.site.unregister(User)
admin.site.register(User, UserAdmin)
