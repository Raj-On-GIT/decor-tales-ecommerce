from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from orders.models import Cart, CartItem, Coupon, CouponUsage, Order, StockReservation
from orders.payment_services import reconcile_order_payment
from products.models import Category, Product, SubCategory


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
