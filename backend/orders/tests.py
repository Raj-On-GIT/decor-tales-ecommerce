from decimal import Decimal

from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from orders.models import Cart, CartItem, Coupon, CouponUsage, Order
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
