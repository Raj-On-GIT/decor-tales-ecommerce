from decimal import Decimal
import json
import os
import shutil
import tempfile
from datetime import timedelta

from django.contrib import admin
from django.contrib.auth.models import User
from django.core.cache import cache
from django.core.management import call_command
from django.core.files.uploadedfile import SimpleUploadedFile, UploadedFile
from django.test import RequestFactory, TestCase, override_settings
from django.urls import reverse
from django.utils import timezone
from PIL import Image
from rest_framework.test import APIClient

from orders.models import Cart, CartItem, MediaCleanupTask, Order, OrderItem, StockReservation
from products.admin import ProductAdmin, ProductAdminForm
from products.models import Category, Product, ProductActivity, ProductImage, SubCategory


def build_test_image(name, size=(100, 100), image_format="PNG", content_type="image/png"):
    image_io = tempfile.SpooledTemporaryFile()
    image = Image.new("RGB", size, color=(120, 160, 220))
    image.save(image_io, format=image_format)
    image_io.seek(0)
    return SimpleUploadedFile(name, image_io.read(), content_type=content_type)


class ProductDeletionRulesTests(TestCase):
    def setUp(self):
        self.category = Category.objects.create(name="Frames")
        self.subcategory = SubCategory.objects.create(
            category=self.category,
            name="Modern",
        )

    def create_product(self, title):
        return Product.objects.create(
            title=title,
            mrp=Decimal("799.00"),
            stock=5,
            category=self.category,
            sub_category=self.subcategory,
        )

    def test_unreferenced_product_is_eligible_for_permanent_delete(self):
        product = self.create_product("Free To Delete")

        self.assertTrue(product.can_hard_delete())
        self.assertEqual(product.get_delete_blockers(), [])

    def test_product_in_cart_is_not_eligible_for_permanent_delete(self):
        user = User.objects.create_user("cart-user", "cart@example.com", "pass12345")
        cart = Cart.objects.create(user=user)
        product = self.create_product("In Cart")
        CartItem.objects.create(cart=cart, product=product, quantity=1)

        self.assertFalse(product.can_hard_delete())
        self.assertIn("shopping carts", product.get_delete_blockers())

        product.delete()
        product.refresh_from_db()
        self.assertFalse(product.is_active)
        self.assertTrue(CartItem.objects.filter(product=product).exists())

    def test_product_with_order_history_is_not_eligible_for_permanent_delete(self):
        user = User.objects.create_user("order-user", "order@example.com", "pass12345")
        product = self.create_product("Ordered Product")
        order = Order.objects.create(
            user=user,
            subtotal_amount=Decimal("799.00"),
            discount_amount=Decimal("0.00"),
            total_amount=Decimal("799.00"),
            shipping_address="Address line",
            city="Delhi",
            postal_code="110001",
            phone="9999999999",
            status="paid",
        )
        OrderItem.objects.create(
            order=order,
            product=product,
            quantity=1,
            price=Decimal("799.00"),
        )

        self.assertFalse(product.can_hard_delete())
        self.assertIn("order history", product.get_delete_blockers())

    def test_product_with_stock_reservation_is_not_eligible_for_permanent_delete(self):
        user = User.objects.create_user("reserve-user", "reserve@example.com", "pass12345")
        product = self.create_product("Reserved Product")
        order = Order.objects.create(
            user=user,
            subtotal_amount=Decimal("799.00"),
            discount_amount=Decimal("0.00"),
            total_amount=Decimal("799.00"),
            shipping_address="Address line",
            city="Delhi",
            postal_code="110001",
            phone="9999999999",
            status="pending",
        )
        StockReservation.objects.create(
            order=order,
            product=product,
            quantity=1,
            reserved_until=order.created_at,
        )

        self.assertFalse(product.can_hard_delete())
        self.assertIn("stock reservations", product.get_delete_blockers())


@override_settings(
    SECURE_SSL_REDIRECT=False,
    STORAGES={
        "default": {
            "BACKEND": "django.core.files.storage.FileSystemStorage",
        },
        "staticfiles": {
            "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage",
        },
    },
)
class ProductAdminDeletionControlsTests(TestCase):
    def setUp(self):
        self.category = Category.objects.create(name="Admin Frames")
        self.subcategory = SubCategory.objects.create(
            category=self.category,
            name="Admin Modern",
        )
        self.admin_user = User.objects.create_superuser(
            username="admin",
            email="admin@example.com",
            password="adminpass123",
        )
        self.client.force_login(self.admin_user)

    def create_product(self, title):
        return Product.objects.create(
            title=title,
            mrp=Decimal("899.00"),
            stock=3,
            category=self.category,
            sub_category=self.subcategory,
        )

    def test_change_page_shows_archive_and_permanent_delete_for_eligible_product(self):
        product = self.create_product("Eligible Product")

        response = self.client.get(
            reverse("admin:products_product_change", args=[product.pk]),
        )

        self.assertContains(response, "Archive Product")
        self.assertContains(response, "Permanently Delete")
        self.assertContains(response, "Eligible for permanent delete.")
        self.assertNotContains(response, 'name="_delete"')

    def test_change_page_hides_permanent_delete_for_referenced_product(self):
        user = User.objects.create_user("cart-admin-user", "cartadmin@example.com", "pass12345")
        cart = Cart.objects.create(user=user)
        product = self.create_product("Referenced Product")
        CartItem.objects.create(cart=cart, product=product, quantity=1)

        response = self.client.get(
            reverse("admin:products_product_change", args=[product.pk]),
        )

        self.assertContains(response, "Archive Product")
        self.assertNotContains(response, "Permanently Delete")
        self.assertContains(response, "shopping carts")
        self.assertNotContains(response, 'name="_delete"')

    def test_archive_product_admin_action_sets_product_inactive(self):
        product = self.create_product("Archive Me")

        response = self.client.post(
            reverse("admin:products_product_archive_confirm"),
            {
                "product_ids": [str(product.pk)],
                "next": "/admin/products/product/",
            },
            follow=True,
        )

        product.refresh_from_db()
        self.assertFalse(product.is_active)
        self.assertContains(response, "Archived 1 product")

    def test_admin_delete_confirmation_removes_eligible_product(self):
        product = self.create_product("Delete Me")

        response = self.client.post(
            reverse("admin:products_product_delete", args=[product.pk]),
            {"post": "yes"},
            follow=True,
        )

        self.assertFalse(Product.objects.filter(pk=product.pk).exists())
        self.assertContains(response, "was deleted successfully")

    def test_referenced_product_change_page_hides_delete_link(self):
        user = User.objects.create_user("ordered-admin-user", "orderedadmin@example.com", "pass12345")
        product = self.create_product("Protected Product")
        order = Order.objects.create(
            user=user,
            subtotal_amount=Decimal("899.00"),
            discount_amount=Decimal("0.00"),
            total_amount=Decimal("899.00"),
            shipping_address="Address line",
            city="Delhi",
            postal_code="110001",
            phone="9999999999",
            status="paid",
        )
        OrderItem.objects.create(
            order=order,
            product=product,
            quantity=1,
            price=Decimal("899.00"),
        )

        response = self.client.get(
            reverse("admin:products_product_change", args=[product.pk]),
        )

        self.assertNotContains(response, "Permanently Delete")
        self.assertContains(response, "order history")


@override_settings(
    STORAGES={
        "default": {
            "BACKEND": "django.core.files.storage.FileSystemStorage",
        },
        "staticfiles": {
            "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage",
        },
    },
)
class ProductMediaDeletionTests(TestCase):
    def setUp(self):
        self.media_root = os.path.join(os.getcwd(), "test_media_product_cleanup")
        shutil.rmtree(self.media_root, ignore_errors=True)
        os.makedirs(self.media_root, exist_ok=True)

        from django.conf import settings

        self._original_media_root = settings.MEDIA_ROOT
        settings.MEDIA_ROOT = self.media_root

        self.category = Category.objects.create(name="Media Frames")
        self.subcategory = SubCategory.objects.create(
            category=self.category,
            name="Media Modern",
        )

    def tearDown(self):
        from django.conf import settings

        settings.MEDIA_ROOT = self._original_media_root
        shutil.rmtree(self.media_root, ignore_errors=True)

    def test_hard_delete_queues_product_media_for_retained_cleanup(self):
        product = Product.objects.create(
            title="Disposable Product",
            mrp=Decimal("699.00"),
            stock=2,
            category=self.category,
            sub_category=self.subcategory,
            image=build_test_image("product-main.png", size=(200, 200)),
        )
        gallery_image = ProductImage.objects.create(
            product=product,
            image=build_test_image("product-gallery.png", size=(220, 220)),
        )

        main_path = product.image.path
        gallery_path = gallery_image.image.path

        product.delete()

        self.assertFalse(Product.objects.filter(pk=product.pk).exists())
        self.assertTrue(os.path.exists(main_path))
        self.assertTrue(os.path.exists(gallery_path))
        self.assertEqual(
            MediaCleanupTask.objects.filter(scope="product_media", deleted_at__isnull=True).count(),
            2,
        )

        MediaCleanupTask.objects.filter(scope="product_media").update(
            delete_after=timezone.now() - timedelta(seconds=1)
        )
        call_command("purge_delivered_order_media", "--days", "0", "--limit", "10")

        self.assertFalse(os.path.exists(main_path))
        self.assertFalse(os.path.exists(gallery_path))


@override_settings(
    STORAGES={
        "default": {
            "BACKEND": "django.core.files.storage.FileSystemStorage",
        },
        "staticfiles": {
            "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage",
        },
    },
)
class CatalogImageAdminFormTests(TestCase):
    def setUp(self):
        self.media_root = os.path.join(os.getcwd(), "test_media_catalog_image")
        shutil.rmtree(self.media_root, ignore_errors=True)
        os.makedirs(self.media_root, exist_ok=True)

        from django.conf import settings

        self._original_media_root = settings.MEDIA_ROOT
        settings.MEDIA_ROOT = self.media_root

        self.category = Category.objects.create(name="Image Frames")
        self.subcategory = SubCategory.objects.create(
            category=self.category,
            name="Image Modern",
        )
        self.product = Product.objects.create(
            title="Image Product",
            mrp=Decimal("799.00"),
            stock=5,
            category=self.category,
            sub_category=self.subcategory,
            image=build_test_image("existing.png", size=(200, 200)),
        )

    def tearDown(self):
        from django.conf import settings

        settings.MEDIA_ROOT = self._original_media_root
        shutil.rmtree(self.media_root, ignore_errors=True)

    def test_existing_image_is_not_reprocessed_on_text_only_edit(self):
        form = ProductAdminForm(data={"title": "Renamed"}, instance=self.product)
        form.full_clean()

        image_value = form.cleaned_data["image"]
        self.assertFalse(isinstance(image_value, UploadedFile))
        self.assertEqual(image_value.name, self.product.image.name)

    def test_uploaded_image_is_optimized(self):
        form = ProductAdminForm(
            data={},
            files={"image": build_test_image("fresh.png", size=(200, 200))},
            instance=self.product,
        )
        form.full_clean()

        image_value = form.cleaned_data["image"]
        self.assertIsInstance(image_value, UploadedFile)
        self.assertEqual(image_value.name, "fresh.png")
        self.assertEqual(image_value.content_type, "image/png")


@override_settings(
    STORAGES={
        "default": {
            "BACKEND": "django.core.files.storage.FileSystemStorage",
        },
        "staticfiles": {
            "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage",
        },
    },
)
class ProductImageManagerSyncTests(TestCase):
    """Tests for the custom product image-manager save logic."""

    def setUp(self):
        self.media_root = os.path.join(os.getcwd(), "test_media_image_manager")
        shutil.rmtree(self.media_root, ignore_errors=True)
        os.makedirs(self.media_root, exist_ok=True)

        from django.conf import settings

        self._original_media_root = settings.MEDIA_ROOT
        settings.MEDIA_ROOT = self.media_root

        self.factory = RequestFactory()
        self.admin = ProductAdmin(Product, admin.site)

        self.admin_user = User.objects.create_superuser(
            username="imageadmin",
            email="imageadmin@example.com",
            password="testpass",
        )
        self.client.force_login(self.admin_user)

        self.category = Category.objects.create(name="Image Manager")
        self.subcategory = SubCategory.objects.create(
            category=self.category,
            name="Modern",
        )

    def tearDown(self):
        from django.conf import settings

        settings.MEDIA_ROOT = self._original_media_root
        shutil.rmtree(self.media_root, ignore_errors=True)

    def create_product(self, image=None):
        return Product.objects.create(
            title="Managed Product",
            mrp=Decimal("799.00"),
            stock=5,
            category=self.category,
            sub_category=self.subcategory,
            image=image,
        )

    def build_request(self, meta, files):
        data = {"product_images_meta": json.dumps(meta)}
        if files:
            data["product_image_new_files"] = list(files)
        return self.factory.post("/admin/products/product/add/", data)

    def test_new_uploads_set_main_and_ordered_gallery(self):
        product = self.create_product()
        files = [
            build_test_image("main.png"),
            build_test_image("first.png"),
            build_test_image("second.png"),
        ]
        meta = {"order": ["n0", "n1", "n2"], "main": "n0", "deleted": []}

        self.admin.sync_product_images(self.build_request(meta, files), product)

        product.refresh_from_db()
        self.assertTrue(product.image)
        rows = list(product.images.all())
        self.assertEqual(len(rows), 2)
        self.assertEqual([row.order for row in rows], [1, 2])

    def test_reorders_existing_rows(self):
        product = self.create_product(image=build_test_image("main.png"))
        row_a = ProductImage.objects.create(product=product, image=build_test_image("a.png"))
        row_b = ProductImage.objects.create(product=product, image=build_test_image("b.png"))
        row_c = ProductImage.objects.create(product=product, image=build_test_image("c.png"))

        meta = {
            "order": ["main", f"e{row_c.pk}", f"e{row_a.pk}", f"e{row_b.pk}"],
            "main": "main",
            "deleted": [],
        }

        self.admin.sync_product_images(self.build_request(meta, []), product)

        ordered = list(product.images.all().order_by("order", "id"))
        self.assertEqual([row.pk for row in ordered], [row_c.pk, row_a.pk, row_b.pk])

    def test_change_main_to_existing_gallery_row(self):
        product = self.create_product(image=build_test_image("main.png"))
        row_a = ProductImage.objects.create(product=product, image=build_test_image("a.png"))
        row_b = ProductImage.objects.create(product=product, image=build_test_image("b.png"))

        meta = {
            "order": [f"e{row_a.pk}", f"e{row_b.pk}"],
            "main": f"e{row_a.pk}",
            "deleted": [],
        }

        self.admin.sync_product_images(self.build_request(meta, []), product)

        product.refresh_from_db()
        self.assertTrue(product.image)
        self.assertNotEqual(product.image.name, "products/main.png")
        remaining = list(product.images.all())
        self.assertEqual([row.pk for row in remaining], [row_b.pk])
        self.assertEqual(remaining[0].order, 1)

    def test_removes_selected_rows(self):
        product = self.create_product(image=build_test_image("main.png"))
        row_a = ProductImage.objects.create(product=product, image=build_test_image("a.png"))
        row_b = ProductImage.objects.create(product=product, image=build_test_image("b.png"))

        meta = {"order": ["main", f"e{row_b.pk}"], "main": "main", "deleted": [row_a.pk]}

        self.admin.sync_product_images(self.build_request(meta, []), product)

        remaining = list(product.images.all())
        self.assertEqual([row.pk for row in remaining], [row_b.pk])

    def test_removing_everything_clears_images(self):
        product = self.create_product(image=build_test_image("main.png"))
        ProductImage.objects.create(product=product, image=build_test_image("a.png"))

        meta = {"order": [], "main": None, "deleted": []}

        self.admin.sync_product_images(self.build_request(meta, []), product)

        product.refresh_from_db()
        self.assertFalse(product.image)
        self.assertEqual(product.images.count(), 0)

    def test_no_meta_is_a_noop(self):
        product = self.create_product(image=build_test_image("main.png"))
        original_name = product.image.name
        ProductImage.objects.create(product=product, image=build_test_image("a.png"))

        request = self.factory.post("/admin/products/product/add/")
        self.admin.sync_product_images(request, product)

        product.refresh_from_db()
        self.assertEqual(product.image.name, original_name)
        self.assertEqual(product.images.count(), 1)

    def test_add_page_renders_image_manager(self):
        response = self.client.get(reverse("admin:products_product_add"))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "image-manager")
        self.assertContains(response, "Add Images")
        self.assertContains(response, "product_images_meta")

    def test_change_page_renders_existing_images(self):
        product = self.create_product(image=build_test_image("main.png"))
        ProductImage.objects.create(product=product, image=build_test_image("gallery.png"))

        response = self.client.get(reverse("admin:products_product_change", args=[product.pk]))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "main.png")
        self.assertContains(response, "gallery.png")
        self.assertContains(response, "product_images_meta")


@override_settings(
    SECURE_SSL_REDIRECT=False,
    STORAGES={
        "default": {
            "BACKEND": "django.core.files.storage.FileSystemStorage",
        },
        "staticfiles": {
            "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage",
        },
    },
)
class ProductArchiveAdminTests(TestCase):
    def setUp(self):
        self.category = Category.objects.create(name="Archive Frames")
        self.subcategory = SubCategory.objects.create(
            category=self.category,
            name="Archive Modern",
        )
        self.admin_user = User.objects.create_superuser(
            username="archive-admin",
            email="archive-admin@example.com",
            password="adminpass123",
        )
        self.client.force_login(self.admin_user)

    def create_product(self, title, **kwargs):
        defaults = dict(
            title=title,
            mrp=Decimal("799.00"),
            stock=5,
            category=self.category,
            sub_category=self.subcategory,
        )
        defaults.update(kwargs)
        return Product.objects.create(**defaults)

    def test_archive_and_restore_update_flags(self):
        product = self.create_product("Flags Product")
        product.archive(hide_from_storefront=True)
        product.refresh_from_db()

        self.assertFalse(product.is_active)
        self.assertIsNotNone(product.archived_at)
        self.assertTrue(product.hidden_from_storefront)

        product.restore()
        product.refresh_from_db()
        self.assertTrue(product.is_active)
        self.assertIsNone(product.archived_at)
        self.assertFalse(product.hidden_from_storefront)

    def test_main_changelist_hides_archived_products(self):
        active = self.create_product("Visible List Product")
        archived = self.create_product("Hidden List Product")
        archived.archive()

        response = self.client.get(reverse("admin:products_product_changelist"))

        self.assertContains(response, active.title)
        self.assertNotContains(response, archived.title)

    def test_archived_view_lists_only_archived_products(self):
        active = self.create_product("Active Elsewhere")
        archived = self.create_product("Only Archived")
        archived.archive()

        response = self.client.get(reverse("admin:products_product_archived"))

        self.assertContains(response, archived.title)
        self.assertNotContains(response, active.title)
        self.assertContains(response, "Archive reason")
        self.assertContains(response, "Archived manually")

    def test_archive_confirm_applies_hide_from_storefront(self):
        product = self.create_product("Hide Me Product")

        self.client.post(
            reverse("admin:products_product_archive_confirm"),
            {
                "product_ids": [str(product.pk)],
                "hide_from_storefront": "on",
                "next": "/admin/products/product/",
            },
        )

        product.refresh_from_db()
        self.assertFalse(product.is_active)
        self.assertIsNotNone(product.archived_at)
        self.assertTrue(product.hidden_from_storefront)

    def test_archive_confirm_defaults_to_visible(self):
        product = self.create_product("Keep Visible Product")

        self.client.post(
            reverse("admin:products_product_archive_confirm"),
            {
                "product_ids": [str(product.pk)],
                "next": "/admin/products/product/",
            },
        )

        product.refresh_from_db()
        self.assertFalse(product.is_active)
        self.assertFalse(product.hidden_from_storefront)

    def test_restore_view_reactivates_product(self):
        product = self.create_product("Restore Me Product")
        product.archive()

        response = self.client.get(
            reverse("admin:products_product_restore", args=[product.pk]),
            {"next": "/admin/products/product/archived/"},
            follow=True,
        )

        product.refresh_from_db()
        self.assertTrue(product.is_active)
        self.assertIsNone(product.archived_at)
        self.assertContains(response, "has been restored")

    def test_storefront_toggle_view_flips_hidden_flag(self):
        product = self.create_product("Toggle Me Product")
        product.archive()

        self.client.get(
            reverse("admin:products_product_storefront_toggle", args=[product.pk]),
            follow=True,
        )
        product.refresh_from_db()
        self.assertTrue(product.hidden_from_storefront)

        self.client.get(
            reverse("admin:products_product_storefront_toggle", args=[product.pk]),
            follow=True,
        )
        product.refresh_from_db()
        self.assertFalse(product.hidden_from_storefront)

    def test_bulk_restore_action_reactivates_products(self):
        product = self.create_product("Bulk Restore Product")
        product.archive()

        response = self.client.post(
            reverse("admin:products_product_archived"),
            {
                "action": "restore_selected_products",
                "_selected_action": [str(product.pk)],
            },
            follow=True,
        )

        product.refresh_from_db()
        self.assertTrue(product.is_active)
        self.assertContains(response, "Restored 1 product")

    def test_bulk_permanent_delete_only_deletes_eligible(self):
        eligible = self.create_product("Eligible Delete Product")
        eligible.archive()
        referenced = self.create_product("Referenced Delete Product")
        referenced.archive()

        user = User.objects.create_user("ref-archive-user", "refarchive@example.com", "pass12345")
        cart = Cart.objects.create(user=user)
        CartItem.objects.create(cart=cart, product=referenced, quantity=1)

        response = self.client.post(
            reverse("admin:products_product_archived"),
            {
                "action": "permanently_delete_selected",
                "_selected_action": [str(eligible.pk), str(referenced.pk)],
            },
            follow=True,
        )

        self.assertFalse(Product.objects.filter(pk=eligible.pk).exists())
        self.assertTrue(Product.objects.filter(pk=referenced.pk).exists())
        self.assertContains(response, "Permanently deleted 1 product")

    def test_storefront_detail_hides_hidden_archived_product(self):
        product = self.create_product("Hidden Detail Product")
        product.archive(hide_from_storefront=True)

        response = self.client.get(reverse("product-detail", args=[product.pk]))

        self.assertEqual(response.status_code, 404)

    def test_storefront_detail_shows_visible_archived_product_as_unavailable(self):
        product = self.create_product("Visible Detail Product")
        product.archive()

        response = self.client.get(reverse("product-detail", args=[product.pk]))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["availability_status"], "unavailable")
        self.assertFalse(response.data["is_available_for_purchase"])


class ProductViewThrottleTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.category = Category.objects.create(name="Frames")
        self.subcategory = SubCategory.objects.create(
            category=self.category,
            name="Modern",
        )
        self.product = Product.objects.create(
            title="Throttle Product",
            mrp=Decimal("799.00"),
            stock=5,
            category=self.category,
            sub_category=self.subcategory,
        )
        self.url = reverse("product-detail", args=[self.product.pk])

    def tearDown(self):
        cache.clear()

    def test_throttle_returns_429_after_sixty_requests(self):
        for _ in range(60):
            response = self.client.get(self.url)
            self.assertEqual(response.status_code, 200)

        throttled_response = self.client.get(self.url)
        self.assertEqual(throttled_response.status_code, 429)


class CartAddActivityThrottleTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.category = Category.objects.create(name="Frames")
        self.subcategory = SubCategory.objects.create(
            category=self.category,
            name="Modern",
        )
        self.product = Product.objects.create(
            title="Cart Add Throttle Product",
            mrp=Decimal("799.00"),
            stock=5,
            category=self.category,
            sub_category=self.subcategory,
        )
        self.url = reverse("product-cart-add", args=[self.product.pk])

    def tearDown(self):
        cache.clear()

    def test_throttle_returns_429_after_twenty_requests(self):
        for _ in range(20):
            response = self.client.post(self.url)
            self.assertEqual(response.status_code, 200)

        throttled_response = self.client.post(self.url)
        self.assertEqual(throttled_response.status_code, 429)


class SearchThrottleTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.url = reverse("search")

    def tearDown(self):
        cache.clear()

    def test_throttle_returns_429_after_thirty_requests(self):
        for _ in range(30):
            response = self.client.get(self.url, {"q": "test"})
            self.assertEqual(response.status_code, 200)

        throttled_response = self.client.get(self.url, {"q": "test"})
        self.assertEqual(throttled_response.status_code, 429)


class RealIPMiddlewareTests(TestCase):
    def test_resolves_leftmost_ff_entry_without_trusted_proxies(self):
        from utils.proxy_headers import RealIPMiddleware

        self.assertEqual(
            RealIPMiddleware._resolve_client_ip(
                "203.0.113.5, 198.51.100.2",
                [],
            ),
            "203.0.113.5",
        )

    def test_skips_trusted_proxy_ips_from_the_right(self):
        from utils.proxy_headers import RealIPMiddleware

        self.assertEqual(
            RealIPMiddleware._resolve_client_ip(
                "203.0.113.5, 10.0.0.1, 10.0.0.2",
                {"10.0.0.1", "10.0.0.2"},
            ),
            "203.0.113.5",
        )

    def test_returns_none_when_all_entries_are_trusted(self):
        from utils.proxy_headers import RealIPMiddleware

        self.assertIsNone(
            RealIPMiddleware._resolve_client_ip(
                "10.0.0.1, 10.0.0.2",
                {"10.0.0.1", "10.0.0.2"},
            ),
        )

    def test_middleware_sets_remote_addr_from_xff(self):
        from django.test import RequestFactory
        from utils.proxy_headers import RealIPMiddleware

        request = RequestFactory().get("/health/")
        request.META["HTTP_X_FORWARDED_FOR"] = "203.0.113.9, 10.0.0.1"
        request.META["REMOTE_ADDR"] = "10.0.0.1"

        response = RealIPMiddleware(lambda req: None)(request)

        self.assertIsNone(response)
        self.assertEqual(request.META["REMOTE_ADDR"], "203.0.113.9")


class TrendingCacheTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.url = reverse("product-trending")
        self.category = Category.objects.create(name="Frames")
        self.subcategory = SubCategory.objects.create(
            category=self.category,
            name="Modern",
        )
        self.product = Product.objects.create(
            title="Trending Product",
            mrp=Decimal("799.00"),
            stock=5,
            category=self.category,
            sub_category=self.subcategory,
        )
        ProductActivity.objects.create(
            product=self.product,
            event_type=ProductActivity.EVENT_VIEW,
        )

    def tearDown(self):
        cache.clear()

    def test_trending_result_is_served_from_cache(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        first_ids = [product["id"] for product in response.data["results"]]
        self.assertIn(self.product.id, first_ids)

        ProductActivity.objects.all().delete()

        cached_response = self.client.get(self.url)
        self.assertEqual(cached_response.status_code, 200)
        cached_ids = [product["id"] for product in cached_response.data["results"]]
        self.assertIn(self.product.id, cached_ids)

        cache.clear()
        recomputed_response = self.client.get(self.url)
        recomputed_ids = [product["id"] for product in recomputed_response.data["results"]]
        self.assertNotIn(self.product.id, recomputed_ids)

    def test_rank_order_is_preserved_on_cache_hit(self):
        other_product = Product.objects.create(
            title="Trending Product 2",
            mrp=Decimal("899.00"),
            stock=5,
            category=self.category,
            sub_category=self.subcategory,
        )
        ProductActivity.objects.create(
            product=other_product,
            event_type=ProductActivity.EVENT_CART_ADD,
        )

        first_ids = [product["id"] for product in self.client.get(self.url).data["results"]]
        second_ids = [product["id"] for product in self.client.get(self.url).data["results"]]

        self.assertEqual(first_ids, second_ids)
        self.assertEqual(first_ids.index(other_product.id), 0)
        self.assertEqual(first_ids.index(self.product.id), 1)
