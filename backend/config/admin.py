from django.contrib.admin import AdminSite
from django.urls import path

from config.admin_search import admin_global_search_api, admin_global_search_view


class LuxeFramesAdminSite(AdminSite):
    """Admin site that also serves the global search views.

    The search views live inside the ``admin:`` URL namespace alongside the
    regular admin pages, so ``{% url 'admin:global_search' %}`` and
    ``{% url 'admin:global_search_api' %}`` resolve on every admin page.
    """

    def get_urls(self):
        urls = super().get_urls()
        return [
            path(
                "search/api/",
                self.admin_view(admin_global_search_api),
                name="global_search_api",
            ),
            path(
                "search/",
                self.admin_view(admin_global_search_view),
                name="global_search",
            ),
        ] + urls
