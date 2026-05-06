from decimal import Decimal
import os
import shutil
import tempfile
from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase
from django.test.utils import override_settings
from django.urls import reverse
from django.utils import timezone
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image
from rest_framework.test import APIClient

from orders.models import Cart, CartItem, Coupon, CouponUsage, Order, OrderItem, OrderItemImage, StockReservation
from orders.payment_services import reconcile_order_payment
from products.models import Category, Color, Product, ProductVariant, Size, SubCategory


def build_test_image(name, size=(100, 100), image_format="PNG", content_type="image/png"):
    image_io = tempfile.SpooledTemporaryFile()
    image = Image.new("RGB", size, color=(90, 150, 210))
    image.save(image_io, format=image_format)
    image_io.seek(0)
    return SimpleUploadedFile(name, image_io.read(), content_type=content_type)


class AvailableCouponsTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="coupon-user",
            email="coupon@example.com",
            password="testpass123",
        )
        self.client.force_authenticate(user=self.user)

        self.category = Category.objects.create(name="Frames")
        self.subcategory = SubCategory.objects.create(
            category=self.category,
            name="Wall Frames",
        )
        self.product = Product.objects.create(
            title="Gallery Frame",
            mrp=Decimal("500.00"),
            slashed_price=Decimal("400.00"),
            stock=10,
            category=self.category,
            sub_category=self.subcategory,
        )
        self.cart = Cart.objects.create(user=self.user)
        CartItem.objects.create(
            cart=self.cart,
            product=self.product,
            quantity=1,
        )

    def test_hides_coupon_already_exhausted_for_user(self):
        coupon = Coupon.objects.create(
            code="USEDUP",
            title="Used Up",
            description="One time only",
            discount_type=Coupon.TYPE_FIXED,
            discount_value=Decimal("50.00"),
            usage_limit_per_user=1,
        )
        order = Order.objects.create(
            user=self.user,
            subtotal_amount=Decimal("400.00"),
            discount_amount=Decimal("50.00"),
            total_amount=Decimal("350.00"),
            coupon_code=coupon.code,
            shipping_address="Address line",
            city="Delhi",
            postal_code="110001",
            phone="9999999999",
            status="delivered",
        )
        CouponUsage.objects.create(
            coupon=coupon,
            user=self.user,
            order=order,
            discount_amount=Decimal("50.00"),
        )

        response = self.client.get(reverse("available_coupons"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["coupons"], [])

    def test_hides_exhausted_coupon_even_when_cart_is_under_minimum(self):
        coupon = Coupon.objects.create(
            code="LOCKED",
            title="Locked Offer",
            description="Already exhausted",
            discount_type=Coupon.TYPE_FIXED,
            discount_value=Decimal("50.00"),
            min_order_amount=Decimal("999.00"),
            usage_limit_per_user=1,
        )
        order = Order.objects.create(
            user=self.user,
            subtotal_amount=Decimal("400.00"),
            discount_amount=Decimal("50.00"),
            total_amount=Decimal("350.00"),
            coupon_code=coupon.code,
            shipping_address="Address line",
            city="Delhi",
            postal_code="110001",
            phone="9999999999",
            status="delivered",
        )
        CouponUsage.objects.create(
            coupon=coupon,
            user=self.user,
            order=order,
            discount_amount=Decimal("50.00"),
        )

        response = self.client.get(reverse("available_coupons"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["coupons"], [])

    def test_keeps_actionable_coupon_and_exposes_multiline_description(self):
        Coupon.objects.create(
            code="SAVE75",
            title="Save More",
            description="Valid on frames\nAdd more to unlock savings",
            discount_type=Coupon.TYPE_FIXED,
            discount_value=Decimal("75.00"),
            min_order_amount=Decimal("600.00"),
        )

        response = self.client.get(reverse("available_coupons"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["coupons"]), 1)

        coupon = response.data["coupons"][0]
        self.assertEqual(coupon["code"], "SAVE75")
        self.assertFalse(coupon["eligible"])
        self.assertIn("Add Rs 200.00 more", coupon["reason"])
        self.assertEqual(
            coupon["description_lines"],
            ["Valid on frames", "Add more to unlock savings"],
        )

    def test_hides_first_order_coupon_after_first_purchase(self):
        Coupon.objects.create(
            code="WELCOME",
            title="Welcome Offer",
            description="For first order",
            discount_type=Coupon.TYPE_FIXED,
            discount_value=Decimal("40.00"),
            first_order_only=True,
        )
        Order.objects.create(
            user=self.user,
            subtotal_amount=Decimal("400.00"),
            discount_amount=Decimal("0.00"),
            total_amount=Decimal("400.00"),
            shipping_address="Address line",
            city="Delhi",
            postal_code="110001",
            phone="9999999999",
            status="processing",
        )

        response = self.client.get(reverse("available_coupons"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["coupons"], [])


class CartValidationTests(TestCase):
    def setUp(self):
        self.media_root = os.path.join(os.getcwd(), "test_media_orders")
        shutil.rmtree(self.media_root, ignore_errors=True)
        os.makedirs(self.media_root, exist_ok=True)
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="cart-user",
            email="cart@example.com",
            password="testpass123",
        )
        self.client.force_authenticate(user=self.user)

        self.category = Category.objects.create(name="Cart Frames")
        self.subcategory = SubCategory.objects.create(
            category=self.category,
            name="Cart Wall Frames",
        )

        self.simple_product = Product.objects.create(
            title="Simple Frame",
            mrp=Decimal("500.00"),
            slashed_price=Decimal("400.00"),
            stock=5,
            stock_type="main",
            category=self.category,
            sub_category=self.subcategory,
        )
        self.variant_product = Product.objects.create(
            title="Variant Frame",
            stock=0,
            stock_type="variants",
            category=self.category,
            sub_category=self.subcategory,
        )
        self.other_variant_product = Product.objects.create(
            title="Other Variant Frame",
            stock=0,
            stock_type="variants",
            category=self.category,
            sub_category=self.subcategory,
        )
        self.size = Size.objects.create(name="12x18")
        self.color = Color.objects.create(name="Black")

        self.variant = ProductVariant.objects.create(
            product=self.variant_product,
            size=self.size,
            color=self.color,
            mrp=Decimal("900.00"),
            slashed_price=Decimal("700.00"),
            stock=3,
        )
        self.other_variant = ProductVariant.objects.create(
            product=self.other_variant_product,
            mrp=Decimal("1000.00"),
            slashed_price=Decimal("800.00"),
            stock=2,
        )

        from django.conf import settings

        self._original_media_root = settings.MEDIA_ROOT
        settings.MEDIA_ROOT = self.media_root

    def tearDown(self):
        from django.conf import settings

        settings.MEDIA_ROOT = self._original_media_root
        shutil.rmtree(self.media_root, ignore_errors=True)

    def test_rejects_quantity_less_than_one(self):
        response = self.client.post(
            reverse("add_to_cart"),
            {"product_id": self.simple_product.id, "quantity": 0},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["error"], "Quantity must be at least 1.")
        self.assertFalse(CartItem.objects.filter(product=self.simple_product).exists())

    def test_rejects_variant_for_non_variant_product(self):
        response = self.client.post(
            reverse("add_to_cart"),
            {
                "product_id": self.simple_product.id,
                "variant_id": self.variant.id,
                "quantity": 1,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["error"], "Variants are not supported for this product.")
        self.assertFalse(CartItem.objects.filter(product=self.simple_product).exists())

    def test_rejects_variant_that_belongs_to_different_product(self):
        response = self.client.post(
            reverse("add_to_cart"),
            {
                "product_id": self.variant_product.id,
                "variant_id": self.other_variant.id,
                "quantity": 1,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.data["error"],
            "Selected variant does not belong to this product.",
        )
        self.assertFalse(CartItem.objects.filter(product=self.variant_product).exists())

    def test_allows_variant_that_matches_product(self):
        response = self.client.post(
            reverse("add_to_cart"),
            {
                "product_id": self.variant_product.id,
                "variant_id": self.variant.id,
                "quantity": 1,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        cart_item = CartItem.objects.get(product=self.variant_product)
        self.assertEqual(cart_item.variant_id, self.variant.id)
        self.assertEqual(cart_item.quantity, 1)
        self.assertEqual(cart_item.variant_size_name, "12x18")
        self.assertEqual(cart_item.variant_color_name, "Black")
        self.assertEqual(cart_item.variant_sku, self.variant.sku)

    def test_cart_keeps_missing_variant_snapshot_and_rebinds_when_variant_returns(self):
        self.client.post(
            reverse("add_to_cart"),
            {
                "product_id": self.variant_product.id,
                "variant_id": self.variant.id,
                "quantity": 1,
            },
            format="json",
        )

        cart_item = CartItem.objects.get(product=self.variant_product)
        original_sku = cart_item.variant_sku

        self.variant.delete()
        cart_item.refresh_from_db()
        self.assertIsNone(cart_item.variant_id)
        self.assertEqual(cart_item.variant_size_name, "12x18")
        self.assertEqual(cart_item.variant_color_name, "Black")
        self.assertEqual(cart_item.variant_sku, original_sku)

        missing_response = self.client.get(reverse("get_cart"))
        self.assertEqual(missing_response.status_code, 200)
        missing_item = missing_response.data["items"][0]
        self.assertEqual(missing_item["product"]["status"], "variant_missing")
        self.assertFalse(missing_item["product"]["is_available_for_purchase"])
        self.assertEqual(missing_item["variant"]["status"], "missing")
        self.assertEqual(missing_item["variant"]["size_name"], "12x18")
        self.assertEqual(missing_item["variant"]["color_name"], "Black")

        restored_variant = ProductVariant.objects.create(
            product=self.variant_product,
            size=self.size,
            color=self.color,
            mrp=Decimal("900.00"),
            slashed_price=Decimal("700.00"),
            stock=2,
            sku=original_sku,
        )

        restored_response = self.client.get(reverse("get_cart"))
        self.assertEqual(restored_response.status_code, 200)
        restored_item = restored_response.data["items"][0]
        self.assertEqual(restored_item["product"]["status"], "available")
        self.assertTrue(restored_item["product"]["is_available_for_purchase"])
        self.assertEqual(restored_item["variant"]["status"], "available")
        self.assertEqual(restored_item["variant"]["id"], restored_variant.id)
        self.assertEqual(restored_item["variant"]["size_name"], "12x18")
        self.assertEqual(restored_item["variant"]["color_name"], "Black")

        cart_item.refresh_from_db()
        self.assertEqual(cart_item.variant_id, restored_variant.id)

    def test_strips_html_from_custom_text_before_saving(self):
        self.simple_product.allow_custom_text = True
        self.simple_product.save(update_fields=["allow_custom_text"])

        response = self.client.post(
            reverse("add_to_cart"),
            {
                "product_id": self.simple_product.id,
                "quantity": 1,
                "custom_text": "  <b>Hello Frame</b>  ",
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, 201)
        cart_item = CartItem.objects.get(product=self.simple_product)
        self.assertEqual(cart_item.custom_text, "Hello Frame")

    def test_rejects_whitespace_only_custom_text(self):
        self.simple_product.allow_custom_text = True
        self.simple_product.save(update_fields=["allow_custom_text"])

        response = self.client.post(
            reverse("add_to_cart"),
            {
                "product_id": self.simple_product.id,
                "quantity": 1,
                "custom_text": "   ",
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["error"], "Custom text cannot be empty.")

    def test_rejects_invalid_custom_image_payload(self):
        self.simple_product.allow_custom_image = True
        self.simple_product.save(update_fields=["allow_custom_image"])

        fake_image = SimpleUploadedFile(
            "custom.png",
            b"not-a-real-image",
            content_type="image/png",
        )

        response = self.client.post(
            reverse("add_to_cart"),
            {
                "product_id": self.simple_product.id,
                "quantity": 1,
                "custom_images": [fake_image],
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.data["error"],
            "Upload a valid image. The file you uploaded was either not an image or a corrupted image.",
        )

    def test_accepts_valid_custom_image_and_saves_it(self):
        self.simple_product.allow_custom_image = True
        self.simple_product.custom_image_limit = 2
        self.simple_product.save(update_fields=["allow_custom_image", "custom_image_limit"])

        response = self.client.post(
            reverse("add_to_cart"),
            {
                "product_id": self.simple_product.id,
                "quantity": 1,
                "custom_images": [build_test_image("custom.png", size=(1200, 1200))],
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, 201)
        cart_item = CartItem.objects.get(product=self.simple_product)
        self.assertEqual(cart_item.custom_images.count(), 1)


class SecureOrderMediaTests(TestCase):
    def setUp(self):
        self.media_root = os.path.join(os.getcwd(), "test_media_secure_orders")
        shutil.rmtree(self.media_root, ignore_errors=True)
        os.makedirs(self.media_root, exist_ok=True)

        from django.conf import settings

        self._original_media_root = settings.MEDIA_ROOT
        settings.MEDIA_ROOT = self.media_root

        self.owner = User.objects.create_user(
            username="owner-user",
            email="owner@example.com",
            password="testpass123",
        )
        self.other_user = User.objects.create_user(
            username="other-user",
            email="other@example.com",
            password="testpass123",
        )
        self.admin_user = User.objects.create_user(
            username="admin-user",
            email="admin@example.com",
            password="testpass123",
            is_staff=True,
        )

        self.category = Category.objects.create(name="Secure Frames")
        self.subcategory = SubCategory.objects.create(
            category=self.category,
            name="Secure Wall Frames",
        )
        self.product = Product.objects.create(
            title="Secure Frame",
            mrp=Decimal("500.00"),
            slashed_price=Decimal("400.00"),
            stock=5,
            category=self.category,
            sub_category=self.subcategory,
        )
        self.order = Order.objects.create(
            user=self.owner,
            subtotal_amount=Decimal("400.00"),
            discount_amount=Decimal("0.00"),
            total_amount=Decimal("400.00"),
            shipping_address="Address line",
            city="Delhi",
            postal_code="110001",
            phone="9999999999",
            status="paid",
        )
        self.order_item = OrderItem.objects.create(
            order=self.order,
            product=self.product,
            quantity=1,
            price=Decimal("400.00"),
        )
        self.order_item_image = OrderItemImage.objects.create(
            order_item=self.order_item,
            image=build_test_image("secure-custom.png", size=(200, 200)),
        )

    def tearDown(self):
        from django.conf import settings

        settings.MEDIA_ROOT = self._original_media_root
        shutil.rmtree(self.media_root, ignore_errors=True)

    def test_owner_can_access_secure_media_endpoint(self):
        client = APIClient()
        client.force_authenticate(user=self.owner)

        response = client.get(
            reverse("order_media", kwargs={"file_path": self.order_item_image.image.name})
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "image/png")

    def test_admin_can_access_secure_media_endpoint(self):
        client = APIClient()
        client.force_authenticate(user=self.admin_user)

        response = client.get(
            reverse("order_media", kwargs={"file_path": self.order_item_image.image.name})
        )

        self.assertEqual(response.status_code, 200)

    def test_other_user_cannot_access_secure_media_endpoint(self):
        client = APIClient()
        client.force_authenticate(user=self.other_user)

        response = client.get(
            reverse("order_media", kwargs={"file_path": self.order_item_image.image.name})
        )

        self.assertEqual(response.status_code, 404)

    def test_legacy_media_path_is_now_protected(self):
        client = APIClient()
        client.force_authenticate(user=self.owner)

        response = client.get(f"/media/{self.order_item_image.image.name}")

        self.assertEqual(response.status_code, 200)

    def test_order_detail_uses_secure_media_urls(self):
        client = APIClient()
        client.force_authenticate(user=self.owner)

        response = client.get(reverse("order_detail", kwargs={"order_id": self.order.id}))

        self.assertEqual(response.status_code, 200)
        self.assertIn("/api/orders/media/order_customizations/", response.data["order"]["items"][0]["custom_image"])


@override_settings(SECURE_SSL_REDIRECT=False)
class PaymentFlowSafetyTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="pay-user",
            email="pay@example.com",
            password="testpass123",
        )
        self.client.force_authenticate(user=self.user)

        self.category = Category.objects.create(name="Frames Safe")
        self.subcategory = SubCategory.objects.create(
            category=self.category,
            name="Wall Frames Safe",
        )
        self.product = Product.objects.create(
            title="Limited Frame",
            mrp=Decimal("500.00"),
            slashed_price=Decimal("400.00"),
            stock=1,
            category=self.category,
            sub_category=self.subcategory,
        )
        self.cart = Cart.objects.create(user=self.user)
        CartItem.objects.create(cart=self.cart, product=self.product, quantity=1)

        from accounts.models import Address

        self.address = Address.objects.create(
            user=self.user,
            full_name="Test User",
            phone="9999999999",
            address_line_1="Street 1",
            address_line_2="",
            city="Delhi",
            state="Delhi",
            postal_code="110001",
            is_default=True,
        )

    @patch("orders.payment_services.get_razorpay_client")
    def test_second_checkout_for_last_item_is_blocked_by_reservation(self, mock_client):
        mock_client.return_value.order.create.return_value = {
            "id": "order_rzp_1",
            "amount": 40000,
            "currency": "INR",
        }

        response = self.client.post(
            reverse("create_payment_order"),
            {"address_id": self.address.id},
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(StockReservation.objects.count(), 1)

        second_user = User.objects.create_user(
            username="pay-user-2",
            email="pay2@example.com",
            password="testpass123",
        )
        second_cart = Cart.objects.create(user=second_user)
        CartItem.objects.create(cart=second_cart, product=self.product, quantity=1)
        from accounts.models import Address

        second_address = Address.objects.create(
            user=second_user,
            full_name="Test User 2",
            phone="8888888888",
            address_line_1="Street 2",
            address_line_2="",
            city="Delhi",
            state="Delhi",
            postal_code="110002",
            is_default=True,
        )
        second_client = APIClient()
        second_client.force_authenticate(user=second_user)

        second_response = second_client.post(
            reverse("create_payment_order"),
            {"address_id": second_address.id},
            format="json",
        )
        self.assertEqual(second_response.status_code, 400)
        self.assertIn("enough stock", second_response.data["error"])

    def test_checkout_rejects_address_missing_required_shipping_fields(self):
        self.address.full_name = ""
        self.address.state = ""
        self.address.save(update_fields=["full_name", "state"])

        response = self.client.post(
            reverse("create_payment_order"),
            {"address_id": self.address.id},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.data["error"],
            "Selected address is missing required shipping fields: full_name, state.",
        )

    @patch("orders.payment_services.verify_razorpay_webhook_signature", return_value=True)
    @patch("orders.payment_services.get_razorpay_client")
    def test_successful_payment_without_frontend_callback_is_completed_by_webhook(
        self,
        mock_client,
        mock_verify_signature,
    ):
        mock_client.return_value.order.create.return_value = {
            "id": "order_rzp_2",
            "amount": 40000,
            "currency": "INR",
        }
        mock_client.return_value.order.payments.return_value = {
            "items": [
                {
                    "id": "pay_123",
                    "order_id": "order_rzp_2",
                    "status": "captured",
                }
            ]
        }

        create_response = self.client.post(
            reverse("create_payment_order"),
            {"address_id": self.address.id},
            format="json",
        )
        self.assertEqual(create_response.status_code, 201)
        order_id = create_response.data["order"]["id"]

        webhook_payload = {
            "event": "payment.captured",
            "payload": {
                "payment": {
                    "entity": {
                        "id": "pay_123",
                        "order_id": "order_rzp_2",
                        "notes": {"order_id": str(order_id)},
                    }
                }
            },
        }

        webhook_response = self.client.post(
            reverse("razorpay_webhook"),
            webhook_payload,
            format="json",
            HTTP_X_RAZORPAY_SIGNATURE="sig",
        )
        self.assertEqual(webhook_response.status_code, 200)

        order = Order.objects.get(id=order_id)
        self.product.refresh_from_db()
        self.assertEqual(order.status, "paid")
        self.assertTrue(order.payment_processed)
        self.assertEqual(self.product.stock, 0)

    @patch("orders.payment_services.verify_razorpay_webhook_signature", return_value=True)
    @patch("orders.payment_services.get_razorpay_client")
    def test_duplicate_webhook_handling_is_idempotent(self, mock_client, mock_verify_signature):
        mock_client.return_value.order.create.return_value = {
            "id": "order_rzp_3",
            "amount": 40000,
            "currency": "INR",
        }
        mock_client.return_value.order.payments.return_value = {
            "items": [
                {
                    "id": "pay_456",
                    "order_id": "order_rzp_3",
                    "status": "captured",
                }
            ]
        }

        create_response = self.client.post(
            reverse("create_payment_order"),
            {"address_id": self.address.id},
            format="json",
        )
        self.assertEqual(create_response.status_code, 201)
        order_id = create_response.data["order"]["id"]

        webhook_payload = {
            "event": "payment.captured",
            "payload": {
                "payment": {
                    "entity": {
                        "id": "pay_456",
                        "order_id": "order_rzp_3",
                        "notes": {"order_id": str(order_id)},
                    }
                }
            },
        }

        first_response = self.client.post(
            reverse("razorpay_webhook"),
            webhook_payload,
            format="json",
            HTTP_X_RAZORPAY_SIGNATURE="sig",
        )
        second_response = self.client.post(
            reverse("razorpay_webhook"),
            webhook_payload,
            format="json",
            HTTP_X_RAZORPAY_SIGNATURE="sig",
        )

        self.assertEqual(first_response.status_code, 200)
        self.assertEqual(second_response.status_code, 200)

        self.product.refresh_from_db()
        order = Order.objects.get(id=order_id)
        self.assertEqual(self.product.stock, 0)
        self.assertTrue(order.payment_processed)

    @patch("orders.payment_services.verify_razorpay_webhook_signature", return_value=True)
    @patch("orders.payment_services.get_razorpay_client")
    def test_order_paid_webhook_uses_reconciliation_flow(self, mock_client, mock_verify_signature):
        mock_client.return_value.order.create.return_value = {
            "id": "order_rzp_8",
            "amount": 40000,
            "currency": "INR",
        }
        mock_client.return_value.order.payments.return_value = {
            "items": [
                {
                    "id": "pay_789",
                    "order_id": "order_rzp_8",
                    "status": "captured",
                }
            ]
        }

        create_response = self.client.post(
            reverse("create_payment_order"),
            {"address_id": self.address.id},
            format="json",
        )
        self.assertEqual(create_response.status_code, 201)
        order_id = create_response.data["order"]["id"]

        webhook_payload = {
            "event": "order.paid",
            "payload": {
                "order": {
                    "entity": {
                        "id": "order_rzp_8",
                    }
                }
            },
        }

        response = self.client.post(
            reverse("razorpay_webhook"),
            webhook_payload,
            format="json",
            HTTP_X_RAZORPAY_SIGNATURE="sig",
        )

        self.assertEqual(response.status_code, 200)
        order = Order.objects.get(id=order_id)
        self.product.refresh_from_db()
        self.assertTrue(order.payment_processed)
        self.assertEqual(order.razorpay_payment_id, "pay_789")
        self.assertEqual(self.product.stock, 0)

    @patch("orders.payment_services.get_razorpay_client")
    def test_reconciliation_uses_razorpay_order_id_when_payment_id_is_missing(self, mock_client):
        mock_client.return_value.order.create.return_value = {
            "id": "order_rzp_4",
            "amount": 40000,
            "currency": "INR",
        }
        mock_client.return_value.order.payments.return_value = {
            "items": [
                {
                    "id": "pay_captured_1",
                    "order_id": "order_rzp_4",
                    "status": "captured",
                }
            ]
        }

        create_response = self.client.post(
            reverse("create_payment_order"),
            {"address_id": self.address.id},
            format="json",
        )
        self.assertEqual(create_response.status_code, 201)

        order = Order.objects.get(id=create_response.data["order"]["id"])
        self.assertEqual(order.razorpay_payment_id, "")

        reconciled_order = reconcile_order_payment(order)

        self.product.refresh_from_db()
        reconciled_order.refresh_from_db()
        self.assertEqual(reconciled_order.status, "paid")
        self.assertTrue(reconciled_order.payment_processed)
        self.assertEqual(reconciled_order.razorpay_payment_id, "pay_captured_1")
        self.assertEqual(self.product.stock, 0)

    @patch("orders.payment_services.get_razorpay_client")
    def test_reconciliation_prefers_payment_fetch_when_payment_id_exists(self, mock_client):
        mock_client.return_value.order.create.return_value = {
            "id": "order_rzp_5",
            "amount": 40000,
            "currency": "INR",
        }
        mock_client.return_value.payment.fetch.return_value = {
            "id": "pay_known_1",
            "order_id": "order_rzp_5",
            "status": "captured",
        }

        create_response = self.client.post(
            reverse("create_payment_order"),
            {"address_id": self.address.id},
            format="json",
        )
        self.assertEqual(create_response.status_code, 201)

        order = Order.objects.get(id=create_response.data["order"]["id"])
        order.razorpay_payment_id = "pay_known_1"
        order.save(update_fields=["razorpay_payment_id"])

        reconciled_order = reconcile_order_payment(order)

        self.product.refresh_from_db()
        reconciled_order.refresh_from_db()
        self.assertEqual(reconciled_order.status, "paid")
        self.assertTrue(reconciled_order.payment_processed)
        self.assertEqual(reconciled_order.razorpay_payment_id, "pay_known_1")
        self.assertEqual(self.product.stock, 0)
        mock_client.return_value.payment.fetch.assert_called_once_with("pay_known_1")

    @patch("orders.payment_services.get_razorpay_client")
    def test_reconciliation_uses_order_item_stock_source_after_product_stock_type_changes(
        self,
        mock_client,
    ):
        mock_client.return_value.order.create.return_value = {
            "id": "order_rzp_6",
            "amount": 40000,
            "currency": "INR",
        }
        mock_client.return_value.order.payments.return_value = {
            "items": [
                {
                    "id": "pay_captured_2",
                    "order_id": "order_rzp_6",
                    "status": "captured",
                }
            ]
        }

        create_response = self.client.post(
            reverse("create_payment_order"),
            {"address_id": self.address.id},
            format="json",
        )
        self.assertEqual(create_response.status_code, 201)

        order = Order.objects.get(id=create_response.data["order"]["id"])
        self.product.stock_type = "variants"
        self.product.save(update_fields=["stock_type"])

        reconciled_order = reconcile_order_payment(order)

        self.product.refresh_from_db()
        reconciled_order.refresh_from_db()
        self.assertEqual(reconciled_order.status, "paid")
        self.assertTrue(reconciled_order.payment_processed)
        self.assertEqual(self.product.stock, 0)

    @patch("orders.payment_services.get_razorpay_client")
    def test_reconciliation_marks_order_failed_when_final_stock_is_unavailable(self, mock_client):
        mock_client.return_value.order.create.return_value = {
            "id": "order_rzp_9",
            "amount": 40000,
            "currency": "INR",
        }
        mock_client.return_value.order.payments.return_value = {
            "items": [
                {
                    "id": "pay_captured_3",
                    "order_id": "order_rzp_9",
                    "status": "captured",
                }
            ]
        }

        create_response = self.client.post(
            reverse("create_payment_order"),
            {"address_id": self.address.id},
            format="json",
        )
        self.assertEqual(create_response.status_code, 201)

        order = Order.objects.get(id=create_response.data["order"]["id"])
        self.product.stock = 0
        self.product.save(update_fields=["stock"])

        reconciled_order = reconcile_order_payment(order)

        self.product.refresh_from_db()
        reconciled_order.refresh_from_db()
        self.assertEqual(reconciled_order.status, "failed")
        self.assertFalse(reconciled_order.payment_processed)
        self.assertEqual(reconciled_order.razorpay_payment_id, "pay_captured_3")
        self.assertTrue(reconciled_order.refund_processed)
        self.assertEqual(self.product.stock, 0)
        self.assertFalse(
            reconciled_order.stock_reservations.filter(
                consumed_at__isnull=True,
                released_at__isnull=True,
            ).exists()
        )
        mock_client.return_value.payment.refund.assert_called_once_with("pay_captured_3")

    @patch("orders.payment_services.verify_razorpay_webhook_signature", return_value=True)
    @patch("orders.payment_services.get_razorpay_client")
    def test_webhook_marks_order_failed_when_final_stock_is_unavailable(
        self,
        mock_client,
        mock_verify_signature,
    ):
        mock_client.return_value.order.create.return_value = {
            "id": "order_rzp_10",
            "amount": 40000,
            "currency": "INR",
        }
        mock_client.return_value.order.payments.return_value = {
            "items": [
                {
                    "id": "pay_captured_4",
                    "order_id": "order_rzp_10",
                    "status": "captured",
                }
            ]
        }

        create_response = self.client.post(
            reverse("create_payment_order"),
            {"address_id": self.address.id},
            format="json",
        )
        self.assertEqual(create_response.status_code, 201)
        order_id = create_response.data["order"]["id"]

        self.product.stock = 0
        self.product.save(update_fields=["stock"])

        webhook_payload = {
            "event": "payment.captured",
            "payload": {
                "payment": {
                    "entity": {
                        "id": "pay_999",
                        "order_id": "order_rzp_10",
                    }
                }
            },
        }

        response = self.client.post(
            reverse("razorpay_webhook"),
            webhook_payload,
            format="json",
            HTTP_X_RAZORPAY_SIGNATURE="sig",
        )

        self.assertEqual(response.status_code, 200)
        order = Order.objects.get(id=order_id)
        self.product.refresh_from_db()
        self.assertEqual(order.status, "failed")
        self.assertFalse(order.payment_processed)
        self.assertEqual(order.razorpay_payment_id, "pay_captured_4")
        self.assertTrue(order.refund_processed)
        self.assertEqual(self.product.stock, 0)
        mock_client.return_value.payment.refund.assert_called_once_with("pay_captured_4")

    @patch("orders.payment_services.verify_razorpay_signature", return_value=True)
    @patch("orders.payment_services.get_razorpay_client")
    def test_verify_payment_refunds_when_reservation_or_stock_conflict_occurs(
        self,
        mock_client,
        mock_verify_signature,
    ):
        mock_client.return_value.order.create.return_value = {
            "id": "order_rzp_11",
            "amount": 40000,
            "currency": "INR",
        }
        mock_client.return_value.payment.fetch.return_value = {
            "id": "pay_verify_1",
            "order_id": "order_rzp_11",
            "status": "captured",
            "amount": 40000,
            "notes": {
                "order_id": "1",
                "user_id": str(self.user.id),
            },
        }

        create_response = self.client.post(
            reverse("create_payment_order"),
            {"address_id": self.address.id},
            format="json",
        )
        self.assertEqual(create_response.status_code, 201)

        self.product.stock = 0
        self.product.save(update_fields=["stock"])

        verify_response = self.client.post(
            reverse("verify_payment"),
            {
                "order_id": create_response.data["order"]["id"],
                "razorpay_order_id": "order_rzp_11",
                "razorpay_payment_id": "pay_verify_1",
                "razorpay_signature": "sig",
            },
            format="json",
        )

        self.assertEqual(verify_response.status_code, 400)
        order = Order.objects.get(id=create_response.data["order"]["id"])
        self.assertEqual(order.status, "failed")
        self.assertFalse(order.payment_processed)
        self.assertEqual(order.razorpay_payment_id, "pay_verify_1")
        self.assertTrue(order.refund_processed)
        mock_client.return_value.payment.refund.assert_called_once_with("pay_verify_1")

    def test_reconcile_payments_requires_staff_user(self):
        response = self.client.post(
            reverse("reconcile_payments"),
            {"limit": 10},
            format="json",
        )

        self.assertEqual(response.status_code, 403)

    @patch("orders.payment_views.reconcile_stale_orders", return_value=0)
    def test_reconcile_payments_allows_staff_user(self, mock_reconcile):
        self.user.is_staff = True
        self.user.save(update_fields=["is_staff"])

        response = self.client.post(
            reverse("reconcile_payments"),
            {"limit": 10},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        mock_reconcile.assert_called_once_with(limit=10)

    @patch("orders.payment_services.reconcile_order_payment")
    @patch("orders.payment_services.get_razorpay_client")
    def test_reconciliation_skips_payment_errors_and_continues(
        self,
        mock_client,
        mock_reconcile_order_payment,
    ):
        from orders.payment_services import PaymentError, reconcile_stale_orders

        mock_client.return_value.order.create.return_value = {
            "id": "order_rzp_7",
            "amount": 40000,
            "currency": "INR",
        }

        first_response = self.client.post(
            reverse("create_payment_order"),
            {"address_id": self.address.id},
            format="json",
        )
        self.assertEqual(first_response.status_code, 201)

        second_user = User.objects.create_user(
            username="pay-user-3",
            email="pay3@example.com",
            password="testpass123",
        )
        second_cart = Cart.objects.create(user=second_user)
        CartItem.objects.create(cart=second_cart, product=self.product, quantity=1)
        from accounts.models import Address

        second_address = Address.objects.create(
            user=second_user,
            full_name="Test User 3",
            phone="7777777777",
            address_line_1="Street 3",
            address_line_2="",
            city="Delhi",
            state="Delhi",
            postal_code="110003",
            is_default=True,
        )
        second_client = APIClient()
        second_client.force_authenticate(user=second_user)

        third_response = second_client.post(
            reverse("create_payment_order"),
            {"address_id": second_address.id},
            format="json",
        )
        self.assertEqual(third_response.status_code, 400)

        successful_order = Order.objects.get(id=first_response.data["order"]["id"])

        def side_effect(order):
            if order.id == successful_order.id:
                order.payment_processed = True
                return order
            raise PaymentError("stock conflict")

        mock_reconcile_order_payment.side_effect = side_effect

        reconciled = reconcile_stale_orders(limit=50)
        self.assertEqual(reconciled, 1)


class ProductAvailabilityHistoryTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="history-user",
            email="history@example.com",
            password="testpass123",
        )
        self.client.force_authenticate(user=self.user)

        self.category = Category.objects.create(name="Archive Frames")
        self.subcategory = SubCategory.objects.create(
            category=self.category,
            name="Archive Wall Frames",
        )
        self.product = Product.objects.create(
            title="Legacy Frame",
            mrp=Decimal("999.00"),
            slashed_price=Decimal("799.00"),
            stock=5,
            category=self.category,
            sub_category=self.subcategory,
        )
        self.order = Order.objects.create(
            user=self.user,
            subtotal_amount=Decimal("799.00"),
            discount_amount=Decimal("0.00"),
            total_amount=Decimal("799.00"),
            shipping_address="Address line",
            city="Delhi",
            postal_code="110001",
            phone="9999999999",
            status="paid",
        )
        self.order_item = OrderItem.objects.create(
            order=self.order,
            product=self.product,
            quantity=1,
            price=Decimal("799.00"),
        )
        self.order_item.capture_product_snapshot(product=self.product)
        self.order_item.save()

    def test_deleting_ordered_product_deactivates_instead_of_removing(self):
        self.product.delete()

        self.product.refresh_from_db()
        self.order_item.refresh_from_db()

        self.assertFalse(self.product.is_active)
        self.assertEqual(self.order_item.product_id, self.product.id)
        self.assertEqual(self.order_item.product_title, "Legacy Frame")

    def test_order_detail_uses_snapshot_when_live_product_changes(self):
        self.product.title = "Renamed Frame"
        self.product.category = None
        self.product.sub_category = None
        self.product.save(update_fields=["title", "category", "sub_category"])

        response = self.client.get(reverse("order_detail", kwargs={"order_id": self.order.id}))

        self.assertEqual(response.status_code, 200)
        product_payload = response.data["order"]["items"][0]["product"]
        self.assertEqual(product_payload["title"], "Legacy Frame")
        self.assertEqual(product_payload["category"]["name"], "Archive Frames")
        self.assertEqual(product_payload["status"], "available")
        self.assertTrue(product_payload["can_view"])

    def test_order_detail_includes_stored_shipment_tracking_snapshot(self):
        self.order.delhivery_waybill = "85172510000022"
        self.order.delhivery_reference = str(self.order.order_number)
        self.order.delhivery_shipment_status = "Manifested"
        self.order.delhivery_tracking_status_label = "In Transit"
        self.order.delhivery_tracking_status_code = "IT"
        self.order.delhivery_tracking_status_type = "UD"
        self.order.delhivery_last_scan_location = "Delhi Hub"
        self.order.delhivery_last_scan_at = timezone.now()
        self.order.delhivery_tracking_synced_at = timezone.now()
        self.order.save(
            update_fields=[
                "delhivery_waybill",
                "delhivery_reference",
                "delhivery_shipment_status",
                "delhivery_tracking_status_label",
                "delhivery_tracking_status_code",
                "delhivery_tracking_status_type",
                "delhivery_last_scan_location",
                "delhivery_last_scan_at",
                "delhivery_tracking_synced_at",
            ]
        )

        response = self.client.get(reverse("order_detail", kwargs={"order_id": self.order.id}))

        self.assertEqual(response.status_code, 200)
        shipment_payload = response.data["order"]["shipment_tracking"]
        self.assertTrue(shipment_payload["has_shipment"])
        self.assertEqual(shipment_payload["waybill"], "85172510000022")
        self.assertEqual(shipment_payload["reference"], str(self.order.order_number))
        self.assertEqual(shipment_payload["shipment_status"], "Manifested")
        self.assertEqual(shipment_payload["status"]["label"], "In Transit")
        self.assertEqual(shipment_payload["status"]["code"], "IT")
        self.assertEqual(shipment_payload["status"]["type"], "UD")
        self.assertEqual(shipment_payload["status"]["location"], "Delhi Hub")
        self.assertIsNotNone(shipment_payload["status"]["timestamp"])
        self.assertIsNotNone(shipment_payload["tracking_synced_at"])

    def test_order_detail_shipment_tracking_handles_orders_without_waybill(self):
        response = self.client.get(reverse("order_detail", kwargs={"order_id": self.order.id}))

        self.assertEqual(response.status_code, 200)
        shipment_payload = response.data["order"]["shipment_tracking"]
        self.assertFalse(shipment_payload["has_shipment"])
        self.assertEqual(shipment_payload["waybill"], "")
        self.assertEqual(shipment_payload["status"]["label"], "")
        self.assertIn("Tracking updates will appear", shipment_payload["message"])

    def test_inactive_product_detail_is_accessible_but_marked_unavailable(self):
        self.product.is_active = False
        self.product.save(update_fields=["is_active"])

        response = self.client.get(reverse("product-detail", kwargs={"id": self.product.id}))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["availability_status"], "unavailable")
        self.assertFalse(response.data["is_available_for_purchase"])

    def test_add_to_cart_rejects_inactive_products(self):
        self.product.is_active = False
        self.product.save(update_fields=["is_active"])

        response = self.client.post(
            reverse("add_to_cart"),
            {"product_id": self.product.id, "quantity": 1},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["error"], "This product is no longer available.")


@override_settings(ALLOW_LEGACY_DIRECT_ORDER=True, SECURE_SSL_REDIRECT=False)
class LegacyDirectOrderAddressValidationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="legacy-order-user",
            email="legacy@example.com",
            password="testpass123",
        )
        self.client.force_authenticate(user=self.user)

        self.category = Category.objects.create(name="Legacy Frames")
        self.subcategory = SubCategory.objects.create(
            category=self.category,
            name="Legacy Wall Frames",
        )
        self.product = Product.objects.create(
            title="Legacy Checkout Frame",
            mrp=Decimal("600.00"),
            slashed_price=Decimal("500.00"),
            stock=5,
            category=self.category,
            sub_category=self.subcategory,
        )
        self.cart = Cart.objects.create(user=self.user)
        CartItem.objects.create(cart=self.cart, product=self.product, quantity=1)

        from accounts.models import Address

        self.address = Address.objects.create(
            user=self.user,
            full_name="",
            phone="9999999999",
            address_line_1="Legacy Street 1",
            address_line_2="",
            city="Delhi",
            state="",
            postal_code="110001",
            is_default=True,
        )

    def test_direct_order_rejects_incomplete_saved_address(self):
        response = self.client.post(
            reverse("create_order"),
            {"address_id": self.address.id},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.data["error"],
            "Selected address is missing required shipping fields: full_name, state.",
        )


@override_settings(
    DELHIVERY_BASE_URL="https://track.delhivery.test",
    DELHIVERY_API_KEY="test-api-key",
    SECURE_SSL_REDIRECT=False,
)
class DelhiveryShippingLabelApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.staff_user = User.objects.create_user(
            username="label-staff",
            email="label-staff@example.com",
            password="testpass123",
            is_staff=True,
        )
        self.user = User.objects.create_user(
            username="label-user",
            email="label-user@example.com",
            password="testpass123",
        )
        self.category = Category.objects.create(name="Label Frames")
        self.subcategory = SubCategory.objects.create(
            category=self.category,
            name="Label Wall Frames",
        )
        self.product = Product.objects.create(
            title="Label Frame",
            mrp=Decimal("800.00"),
            slashed_price=Decimal("700.00"),
            stock=5,
            category=self.category,
            sub_category=self.subcategory,
        )
        self.order = Order.objects.create(
            user=self.user,
            subtotal_amount=Decimal("700.00"),
            discount_amount=Decimal("0.00"),
            total_amount=Decimal("700.00"),
            status="paid",
            shipping_email="label@example.com",
            shipping_full_name="Label Customer",
            shipping_address="123 Label Street",
            city="Delhi",
            shipping_state="Delhi",
            shipping_country="India",
            postal_code="110001",
            phone="9999999999",
            delhivery_waybill="85172510000022",
        )
        OrderItem.objects.create(
            order=self.order,
            product=self.product,
            quantity=1,
            price=Decimal("700.00"),
            product_title=self.product.title,
        )

    def test_shipping_label_api_requires_staff_user(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.get(
            reverse("delhivery_shipping_label"),
            {"order_id": self.order.id},
            format="json",
        )

        self.assertEqual(response.status_code, 403)

    @patch("orders.views.DelhiveryService.generate_shipping_label")
    def test_staff_can_fetch_shipping_label(self, mock_generate_shipping_label):
        self.client.force_authenticate(user=self.staff_user)
        mock_generate_shipping_label.return_value = {
            "packages": [
                {
                    "pdf_download_link": "https://labels.example.com/api-label.pdf",
                    "pdf_encoding": "encoded-pdf",
                    "wbn": "85172510000022",
                }
            ],
            "packages_found": 1,
        }

        response = self.client.get(
            reverse("delhivery_shipping_label"),
            {"order_id": self.order.id},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["waybill"], "85172510000022")
        self.assertEqual(response.data["packages_found"], 1)
        self.assertEqual(
            response.data["label"]["pdf_download_link"],
            "https://labels.example.com/api-label.pdf",
        )


@override_settings(
    DELHIVERY_BASE_URL="https://track.delhivery.test",
    DELHIVERY_API_KEY="test-api-key",
    SECURE_SSL_REDIRECT=False,
)
class DelhiveryTrackingRefreshApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.staff_user = User.objects.create_user(
            username="tracking-staff",
            email="tracking-staff@example.com",
            password="testpass123",
            is_staff=True,
        )
        self.user = User.objects.create_user(
            username="tracking-user",
            email="tracking-user@example.com",
            password="testpass123",
        )
        self.category = Category.objects.create(name="Tracking Frames")
        self.subcategory = SubCategory.objects.create(
            category=self.category,
            name="Tracking Wall Frames",
        )
        self.product = Product.objects.create(
            title="Tracking Frame",
            mrp=Decimal("800.00"),
            slashed_price=Decimal("700.00"),
            stock=5,
            category=self.category,
            sub_category=self.subcategory,
        )
        self.order = Order.objects.create(
            user=self.user,
            subtotal_amount=Decimal("700.00"),
            discount_amount=Decimal("0.00"),
            total_amount=Decimal("700.00"),
            status="paid",
            shipping_email="tracking@example.com",
            shipping_full_name="Tracking Customer",
            shipping_address="123 Tracking Street",
            city="Delhi",
            shipping_state="Delhi",
            shipping_country="India",
            postal_code="110001",
            phone="9999999999",
            delhivery_waybill="85172510000022",
        )
        OrderItem.objects.create(
            order=self.order,
            product=self.product,
            quantity=1,
            price=Decimal("700.00"),
            product_title=self.product.title,
        )

    def test_refresh_tracking_api_requires_staff_user(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.post(
            reverse("refresh_delhivery_tracking"),
            {"order_id": self.order.id},
            format="json",
        )

        self.assertEqual(response.status_code, 403)

    @patch("orders.views.DelhiveryService.track_shipment")
    def test_staff_can_refresh_tracking_and_store_fields(self, mock_track_shipment):
        self.client.force_authenticate(user=self.staff_user)
        mock_track_shipment.return_value = {
            "ShipmentData": [
                {
                    "Shipment": {
                        "Status": {
                            "Status": "In Transit",
                            "StatusCode": "IT",
                            "StatusType": "UD",
                            "StatusLocation": "Delhi Hub",
                            "StatusDateTime": "2026-04-27T11:30:00+05:30",
                        },
                        "Scans": [],
                    }
                }
            ]
        }

        response = self.client.post(
            reverse("refresh_delhivery_tracking"),
            {"order_id": self.order.id},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.order.refresh_from_db()
        self.assertEqual(self.order.delhivery_tracking_status_code, "IT")
        self.assertEqual(self.order.delhivery_tracking_status_label, "In Transit")
        self.assertEqual(self.order.delhivery_tracking_status_type, "UD")
        self.assertEqual(self.order.delhivery_last_scan_location, "Delhi Hub")
        self.assertIsNotNone(self.order.delhivery_last_scan_at)
        self.assertIsNotNone(self.order.delhivery_tracking_synced_at)

    @patch("orders.views.DelhiveryService.track_shipment")
    def test_refresh_tracking_does_not_overwrite_saved_fields_with_blank_values(
        self,
        mock_track_shipment,
    ):
        self.client.force_authenticate(user=self.staff_user)
        self.order.delhivery_tracking_status_code = "OLD"
        self.order.delhivery_tracking_status_label = "Old Status"
        self.order.delhivery_tracking_status_type = "OT"
        self.order.delhivery_last_scan_location = "Old Hub"
        self.order.save(
            update_fields=[
                "delhivery_tracking_status_code",
                "delhivery_tracking_status_label",
                "delhivery_tracking_status_type",
                "delhivery_last_scan_location",
            ]
        )
        mock_track_shipment.return_value = {
            "ShipmentData": [
                {
                    "Shipment": {
                        "Status": {
                            "Status": "",
                            "StatusCode": "",
                            "StatusType": "",
                            "StatusLocation": "",
                            "StatusDateTime": "",
                        },
                        "Scans": [],
                    }
                }
            ]
        }

        response = self.client.post(
            reverse("refresh_delhivery_tracking"),
            {"order_id": self.order.id},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.order.refresh_from_db()
        self.assertEqual(self.order.delhivery_tracking_status_code, "OLD")
        self.assertEqual(self.order.delhivery_tracking_status_label, "Old Status")
        self.assertEqual(self.order.delhivery_tracking_status_type, "OT")
        self.assertEqual(self.order.delhivery_last_scan_location, "Old Hub")
        self.assertIsNotNone(self.order.delhivery_tracking_synced_at)


@override_settings(
    DELHIVERY_WEBHOOK_SECRET="dt-webhook-prod-test-secret",
    SECURE_SSL_REDIRECT=False,
)
class DelhiveryScanPushWebhookTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="webhook-user",
            email="webhook@example.com",
            password="testpass123",
        )
        self.category = Category.objects.create(name="Webhook Frames")
        self.subcategory = SubCategory.objects.create(
            category=self.category,
            name="Webhook Wall Frames",
        )
        self.product = Product.objects.create(
            title="Webhook Frame",
            mrp=Decimal("800.00"),
            slashed_price=Decimal("700.00"),
            stock=5,
            category=self.category,
            sub_category=self.subcategory,
        )
        self.order = Order.objects.create(
            user=self.user,
            subtotal_amount=Decimal("700.00"),
            discount_amount=Decimal("0.00"),
            total_amount=Decimal("700.00"),
            status="paid",
            shipping_email="webhook@example.com",
            shipping_full_name="Webhook Customer",
            shipping_address="123 Webhook Street",
            city="Delhi",
            shipping_state="Delhi",
            shipping_country="India",
            postal_code="110001",
            phone="9999999999",
            delhivery_waybill="85172510000022",
        )
        OrderItem.objects.create(
            order=self.order,
            product=self.product,
            quantity=1,
            price=Decimal("700.00"),
            product_title=self.product.title,
        )

    def post_webhook(self, payload):
        return self.client.post(
            reverse("delhivery_scan_push_webhook"),
            payload,
            format="json",
            HTTP_X_DELHIVERY_WEBHOOK_SECRET="dt-webhook-prod-test-secret",
        )

    def test_webhook_requires_valid_secret_header(self):
        with patch("orders.views.logger.warning") as mock_warning:
            response = self.client.post(
                reverse("delhivery_scan_push_webhook"),
                {},
                format="json",
            )

        self.assertEqual(response.status_code, 403)
        mock_warning.assert_called_once_with("delhivery_scan_push_unauthorized")

    def test_webhook_updates_latest_tracking_snapshot(self):
        payload = {
            "Shipment": {
                "Status": {
                    "Status": "Manifested",
                    "StatusDateTime": "2026-05-05T10:30:00+05:30",
                    "StatusType": "UD",
                    "StatusLocation": "Chandigarh_Raiprkln_C (Chandigarh)",
                    "Instructions": "Manifest uploaded",
                },
                "PickUpDate": "2026-05-05 10:30:00",
                "NSLCode": "X-UCI",
                "Sortcode": "IXC/MDP",
                "ReferenceNo": str(self.order.order_number),
                "AWB": "85172510000022",
            }
        }
        response = self.post_webhook(payload)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["ok"], True)
        self.assertEqual(response.data["result"], "updated")
        self.assertEqual(response.data["order_id"], self.order.id)
        self.assertEqual(response.data["order_number"], self.order.order_number)
        self.assertEqual(response.data["waybill"], "85172510000022")
        self.order.refresh_from_db()
        self.assertEqual(self.order.delhivery_tracking_status_label, "Manifested")
        self.assertEqual(self.order.delhivery_tracking_status_type, "UD")
        self.assertEqual(
            self.order.delhivery_last_scan_location,
            "Chandigarh_Raiprkln_C (Chandigarh)",
        )
        self.assertIsNotNone(self.order.delhivery_tracking_synced_at)
        self.assertEqual(self.order.delhivery_tracking_raw_response, payload)

    def test_webhook_updates_successfully_without_reference_number(self):
        response = self.post_webhook(
            {
                "Shipment": {
                    "Status": {
                        "Status": "Manifested",
                        "StatusDateTime": "2026-05-05T10:30:00+05:30",
                        "StatusType": "UD",
                        "StatusLocation": "Origin Hub",
                        "Instructions": "Manifest uploaded",
                    },
                    "PickUpDate": "2026-05-05 10:30:00",
                    "NSLCode": "X-UCI",
                    "Sortcode": "IXC/MDP",
                    "AWB": "85172510000022",
                }
            }
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["result"], "updated")
        self.order.refresh_from_db()
        self.assertEqual(self.order.delhivery_tracking_status_label, "Manifested")
        self.assertEqual(self.order.delhivery_last_scan_location, "Origin Hub")

    def test_webhook_handles_missing_status_code_without_clearing_existing_value(self):
        self.order.delhivery_tracking_status_code = "OLD"
        self.order.save(update_fields=["delhivery_tracking_status_code"])

        response = self.post_webhook(
            {
                "Shipment": {
                    "Status": {
                        "Status": "Manifested",
                        "StatusDateTime": "2026-05-05T10:30:00+05:30",
                        "StatusType": "UD",
                        "StatusLocation": "Origin Hub",
                        "Instructions": "Manifest uploaded",
                    },
                    "ReferenceNo": str(self.order.order_number),
                    "AWB": "85172510000022",
                }
            }
        )

        self.assertEqual(response.status_code, 200)
        self.order.refresh_from_db()
        self.assertEqual(self.order.delhivery_tracking_status_code, "OLD")
        self.assertEqual(self.order.delhivery_tracking_status_label, "Manifested")

    def test_webhook_acknowledges_unknown_awb_without_404(self):
        with patch("orders.views.logger.warning") as mock_warning:
            response = self.post_webhook(
                {
                    "Shipment": {
                        "Status": {
                            "Status": "Manifested",
                            "StatusDateTime": "2026-05-05T10:30:00+05:30",
                        },
                        "ReferenceNo": "28",
                        "AWB": "UNKNOWNAWB123",
                    }
                }
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["ok"], True)
        self.assertEqual(response.data["ignored"], "order_not_found")
        mock_warning.assert_called_once()
        self.assertIn("delhivery_scan_push_unmatched_awb", mock_warning.call_args[0][0])

    @patch("orders.views.logger.warning")
    def test_webhook_logs_reference_mismatch_but_updates_by_awb(self, mock_warning):
        response = self.post_webhook(
            {
                "Shipment": {
                    "Status": {
                        "Status": "Manifested",
                        "StatusDateTime": "2026-05-05T10:30:00+05:30",
                        "StatusType": "UD",
                        "StatusLocation": "Origin Hub",
                        "Instructions": "Manifest uploaded",
                    },
                    "ReferenceNo": "DIFFERENT-REF-123",
                    "AWB": "85172510000022",
                }
            }
        )

        self.assertEqual(response.status_code, 200)
        self.order.refresh_from_db()
        self.assertEqual(self.order.delhivery_tracking_status_label, "Manifested")
        mock_warning.assert_called_once()
        self.assertIn("delhivery_scan_push_reference_mismatch", mock_warning.call_args[0][0])

    def test_webhook_does_not_overwrite_saved_tracking_fields_with_blank_values(self):
        self.order.delhivery_tracking_status_code = "OLD"
        self.order.delhivery_tracking_status_label = "Old Status"
        self.order.delhivery_tracking_status_type = "OT"
        self.order.delhivery_last_scan_location = "Old Hub"
        self.order.save(
            update_fields=[
                "delhivery_tracking_status_code",
                "delhivery_tracking_status_label",
                "delhivery_tracking_status_type",
                "delhivery_last_scan_location",
            ]
        )

        response = self.post_webhook(
            {
                "Shipment": {
                    "Status": {
                        "Status": "",
                        "StatusDateTime": "",
                        "StatusType": "",
                        "StatusLocation": "",
                        "Instructions": "",
                    },
                    "ReferenceNo": str(self.order.order_number),
                    "AWB": "85172510000022",
                }
            }
        )

        self.assertEqual(response.status_code, 200)
        self.order.refresh_from_db()
        self.assertEqual(self.order.delhivery_tracking_status_code, "OLD")
        self.assertEqual(self.order.delhivery_tracking_status_label, "Old Status")
        self.assertEqual(self.order.delhivery_tracking_status_type, "OT")
        self.assertEqual(self.order.delhivery_last_scan_location, "Old Hub")
        self.assertIsNotNone(self.order.delhivery_tracking_synced_at)

    def test_repeated_webhook_delivery_remains_idempotent_for_latest_snapshot(self):
        payload = {
            "Shipment": {
                "Status": {
                    "Status": "Manifested",
                    "StatusDateTime": "2026-05-05T10:30:00+05:30",
                    "StatusType": "UD",
                    "StatusLocation": "Origin Hub",
                    "Instructions": "Manifest uploaded",
                },
                "ReferenceNo": str(self.order.order_number),
                "AWB": "85172510000022",
            }
        }

        first_response = self.post_webhook(payload)
        second_response = self.post_webhook(payload)

        self.assertEqual(first_response.status_code, 200)
        self.assertEqual(second_response.status_code, 200)
        self.order.refresh_from_db()
        self.assertEqual(self.order.delhivery_tracking_status_label, "Manifested")
        self.assertEqual(self.order.delhivery_last_scan_location, "Origin Hub")
        self.assertEqual(self.order.delhivery_tracking_raw_response, payload)

    def test_webhook_rejects_non_object_payload_with_monitoring_log(self):
        with patch("orders.views.logger.warning") as mock_warning:
            response = self.client.post(
                reverse("delhivery_scan_push_webhook"),
                [],
                format="json",
                HTTP_X_DELHIVERY_WEBHOOK_SECRET="dt-webhook-prod-test-secret",
            )

        self.assertEqual(response.status_code, 400)
        mock_warning.assert_called_once()
        self.assertIn("delhivery_scan_push_invalid_payload", mock_warning.call_args[0][0])

    def test_webhook_rejects_missing_awb_with_monitoring_log(self):
        with patch("orders.views.logger.warning") as mock_warning:
            response = self.post_webhook(
                {
                    "Shipment": {
                        "Status": {
                            "Status": "Manifested",
                            "StatusDateTime": "2026-05-05T10:30:00+05:30",
                        },
                        "ReferenceNo": str(self.order.order_number),
                    }
                }
            )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["error"], "Missing AWB in webhook payload.")
        self.assertGreaterEqual(mock_warning.call_count, 2)
        logged_events = [call.args[0] for call in mock_warning.call_args_list]
        self.assertIn("delhivery_scan_push_missing_awb", logged_events)
        self.assertIn("delhivery_scan_push_invalid_payload error=%s", logged_events)

    def test_webhook_logs_successful_update_for_monitoring(self):
        with patch("orders.views.logger.info") as mock_info:
            response = self.post_webhook(
                {
                    "Shipment": {
                        "Status": {
                            "Status": "Manifested",
                            "StatusDateTime": "2026-05-05T10:30:00+05:30",
                            "StatusType": "UD",
                            "StatusLocation": "Origin Hub",
                            "Instructions": "Manifest uploaded",
                        },
                        "ReferenceNo": str(self.order.order_number),
                        "AWB": "85172510000022",
                    }
                }
            )

        self.assertEqual(response.status_code, 200)
        mock_info.assert_called_once()
        self.assertIn("delhivery_scan_push_updated", mock_info.call_args[0][0])


@override_settings(
    DELHIVERY_BASE_URL="https://track.delhivery.test",
    DELHIVERY_API_KEY="test-api-key",
    DELHIVERY_PICKUP_LOCATION="Main Warehouse",
    STORAGES={
        "default": {
            "BACKEND": "django.core.files.storage.FileSystemStorage",
        },
        "staticfiles": {
            "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage",
        },
    },
)
class OrderAdminDelhiveryShipmentTests(TestCase):
    def setUp(self):
        self.admin_user = User.objects.create_superuser(
            username="shipment-admin",
            email="shipment-admin@example.com",
            password="testpass123",
        )
        self.customer = User.objects.create_user(
            username="shipment-customer",
            email="shipment-customer@example.com",
            password="testpass123",
        )
        self.client.force_login(self.admin_user)

        self.category = Category.objects.create(name="Admin Frames")
        self.subcategory = SubCategory.objects.create(
            category=self.category,
            name="Admin Wall Frames",
        )
        self.product = Product.objects.create(
            title="Admin Frame",
            mrp=Decimal("1200.00"),
            slashed_price=Decimal("999.00"),
            stock=10,
            category=self.category,
            sub_category=self.subcategory,
        )
        self.order = Order.objects.create(
            user=self.customer,
            subtotal_amount=Decimal("999.00"),
            discount_amount=Decimal("0.00"),
            total_amount=Decimal("999.00"),
            status="paid",
            shipping_email="shipment@example.com",
            shipping_full_name="Admin Test Customer",
            shipping_address="123 Test Street",
            city="Delhi",
            shipping_state="Delhi",
            shipping_country="India",
            postal_code="110001",
            phone="9999999999",
        )
        OrderItem.objects.create(
            order=self.order,
            product=self.product,
            quantity=1,
            price=Decimal("999.00"),
            product_title=self.product.title,
        )

    def test_change_page_shows_create_shipment_button_for_eligible_order(self):
        response = self.client.get(
            reverse("admin:orders_order_change", args=[self.order.pk]),
            secure=True,
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Create Shipment")
        self.assertContains(
            response,
            reverse("admin:orders_order_create_shipment", args=[self.order.pk]),
        )

    def test_change_page_hides_create_shipment_button_when_waybill_exists(self):
        self.order.delhivery_waybill = "WB123456789"
        self.order.save(update_fields=["delhivery_waybill"])

        response = self.client.get(
            reverse("admin:orders_order_change", args=[self.order.pk]),
            secure=True,
        )

        self.assertEqual(response.status_code, 200)
        self.assertNotContains(response, "Create Shipment")

    @patch("orders.views.DelhiveryService.create_shipment")
    def test_admin_can_create_shipment_from_order_page(self, mock_create_shipment):
        mock_create_shipment.return_value = {
            "success": True,
            "upload_wbn": "REF123",
            "packages": [
                {
                    "waybill": "WB987654321",
                    "client": "Test Client",
                    "status": "Manifested",
                    "payment": "Prepaid",
                    "serviceable": True,
                    "remarks": [],
                }
            ],
        }

        response = self.client.post(
            reverse("admin:orders_order_create_shipment", args=[self.order.pk]),
            secure=True,
            follow=True,
        )

        self.assertEqual(response.status_code, 200)
        self.order.refresh_from_db()
        self.assertEqual(self.order.delhivery_waybill, "WB987654321")
        self.assertContains(response, "Shipment created for order")

    def test_admin_route_blocks_cancelled_orders(self):
        self.order.status = "cancelled"
        self.order.save(update_fields=["status"])

        response = self.client.post(
            reverse("admin:orders_order_create_shipment", args=[self.order.pk]),
            secure=True,
            follow=True,
        )

        self.assertEqual(response.status_code, 200)
        self.order.refresh_from_db()
        self.assertEqual(self.order.delhivery_waybill, "")
        self.assertContains(
            response,
            "Shipment creation is only available for active orders without an existing waybill.",
        )

    def test_change_page_shows_generate_shipping_label_button_when_waybill_exists(self):
        self.order.delhivery_waybill = "WB123456789"
        self.order.save(update_fields=["delhivery_waybill"])

        response = self.client.get(
            reverse("admin:orders_order_change", args=[self.order.pk]),
            secure=True,
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Generate Shipping Label")
        self.assertContains(
            response,
            reverse("admin:orders_order_generate_shipping_label", args=[self.order.pk]),
        )

    @patch("orders.views.DelhiveryService.generate_shipping_label")
    def test_admin_can_generate_shipping_label(self, mock_generate_shipping_label):
        self.order.delhivery_waybill = "WB987654321"
        self.order.save(update_fields=["delhivery_waybill"])

        mock_generate_shipping_label.return_value = {
            "packages": [
                {
                    "pdf_download_link": "https://labels.example.com/test-label.pdf",
                    "pdf_encoding": "encoded-pdf",
                    "wbn": "WB987654321",
                }
            ],
            "packages_found": 1,
        }

        response = self.client.post(
            reverse("admin:orders_order_generate_shipping_label", args=[self.order.pk]),
            secure=True,
        )

        self.assertEqual(response.status_code, 302)
        self.assertEqual(
            response["Location"],
            "https://labels.example.com/test-label.pdf",
        )

    def test_change_page_hides_generate_shipping_label_button_without_waybill(self):
        response = self.client.get(
            reverse("admin:orders_order_change", args=[self.order.pk]),
            secure=True,
        )

        self.assertEqual(response.status_code, 200)
        self.assertNotContains(response, "Generate Shipping Label")

    def test_change_page_shows_refresh_tracking_button_when_waybill_exists(self):
        self.order.delhivery_waybill = "WB123456789"
        self.order.save(update_fields=["delhivery_waybill"])

        response = self.client.get(
            reverse("admin:orders_order_change", args=[self.order.pk]),
            secure=True,
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Refresh Tracking")
        self.assertContains(
            response,
            reverse("admin:orders_order_refresh_tracking", args=[self.order.pk]),
        )

    def test_change_page_shows_compact_shipment_summary(self):
        self.order.delhivery_waybill = "WB123456789"
        self.order.delhivery_reference = str(self.order.order_number)
        self.order.delhivery_shipment_status = "Manifested"
        self.order.delhivery_tracking_status_label = "In Transit"
        self.order.delhivery_tracking_status_code = "IT"
        self.order.delhivery_tracking_status_type = "UD"
        self.order.delhivery_last_scan_location = "Delhi Hub"
        self.order.save(
            update_fields=[
                "delhivery_waybill",
                "delhivery_reference",
                "delhivery_shipment_status",
                "delhivery_tracking_status_label",
                "delhivery_tracking_status_code",
                "delhivery_tracking_status_type",
                "delhivery_last_scan_location",
            ]
        )

        response = self.client.get(
            reverse("admin:orders_order_change", args=[self.order.pk]),
            secure=True,
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Shipment Summary")
        self.assertContains(response, "WB123456789")
        self.assertContains(response, "In Transit")
        self.assertContains(response, "Delhi Hub")
        self.assertNotContains(response, "Delhivery Shipment")
        self.assertNotContains(response, "Delhivery Tracking")

    @patch("orders.views.DelhiveryService.track_shipment")
    def test_admin_can_refresh_tracking(self, mock_track_shipment):
        self.order.delhivery_waybill = "WB987654321"
        self.order.save(update_fields=["delhivery_waybill"])
        mock_track_shipment.return_value = {
            "ShipmentData": [
                {
                    "Shipment": {
                        "Status": {
                            "Status": "Out For Delivery",
                            "StatusCode": "OFD",
                            "StatusType": "UD",
                            "StatusLocation": "Noida",
                            "StatusDateTime": "2026-04-27T14:00:00+05:30",
                        },
                        "Scans": [],
                    }
                }
            ]
        }

        response = self.client.post(
            reverse("admin:orders_order_refresh_tracking", args=[self.order.pk]),
            secure=True,
            follow=True,
        )

        self.assertEqual(response.status_code, 200)
        self.order.refresh_from_db()
        self.assertEqual(self.order.delhivery_tracking_status_code, "OFD")
        self.assertEqual(self.order.delhivery_last_scan_location, "Noida")
        self.assertContains(response, "Tracking refreshed for order")
