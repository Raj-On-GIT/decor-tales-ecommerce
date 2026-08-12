from django.contrib.admin.apps import AdminConfig


class LuxeFramesAdminConfig(AdminConfig):
    default_site = "config.admin.LuxeFramesAdminSite"
