from decimal import Decimal
import os
import shutil
import tempfile
from datetime import timedelta

from django.contrib.auth.models import User
from django.core.management import call_command
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone
from PIL import Image

from orders.models import Cart, CartItem, MediaCleanupTask, Order, OrderItem, StockReservation
from products.models import Category, Product, ProductImage, SubCategory


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
            reverse("admin:products_product_archive", args=[product.pk]),
            follow=True,
        )

        product.refresh_from_db()
        self.assertFalse(product.is_active)
        self.assertContains(response, "has been archived")

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
