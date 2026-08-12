from decimal import Decimal

from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from accounts.models import Address
from newsletter.models import NewsletterSubscriber
from orders.models import Cart, Coupon, CouponUsage, Order, OrderItem
from products.models import Banner, Category, Color, Product, Size, SubCategory

from config.admin_search import (
    API_PER_MODEL_LIMIT,
    PAGE_PER_MODEL_LIMIT,
)


class GlobalSearchTestCase(TestCase):
    def setUp(self):
        self.superuser = User.objects.create_user(
            username="staffadmin",
            email="staff@example.com",
            password="pw123456",
            is_staff=True,
            is_superuser=True,
        )
        self.client.force_login(self.superuser)

        self.category = Category.objects.create(name="Frames")
        self.subcategory = SubCategory.objects.create(
            category=self.category, name="Photo Frames"
        )
        self.product = Product.objects.create(
            title="Walnut Photo Frame 12x18",
            category=self.category,
            sub_category=self.subcategory,
        )
        self.size = Size.objects.create(name="12X18 in")
        self.color = Color.objects.create(name="Black")

        self.customer = User.objects.create_user(
            username="janedoe",
            email="jane@example.com",
            password="pw123456",
        )
        self.order = Order.objects.create(
            user=self.customer,
            order_number="ORD-TEST-0001",
            total_amount=Decimal("100.00"),
        )
        self.cart = Cart.objects.create(user=self.customer)
        self.coupon = Coupon.objects.create(
            code="SAVE10",
            title="Save ten percent",
            discount_type="percent",
            discount_value=Decimal("10.00"),
        )
        self.banner = Banner.objects.create(
            type="image",
            title="Summer Sale",
            start_date=timezone.now(),
        )
        self.newsletter = NewsletterSubscriber.objects.create(
            email="news@example.com"
        )
        self.address = Address.objects.create(
            user=self.customer,
            full_name="Jane Doe",
            phone="9876543210",
            address_line_1="1 MG Road",
            city="Bangalore",
            state="Karnataka",
            postal_code="560001",
        )
        self.coupon_usage = CouponUsage.objects.create(
            coupon=self.coupon,
            user=self.customer,
            order=self.order,
            discount_amount=Decimal("5.00"),
        )

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------
    def _search(self, query):
        return self.client.get(reverse("admin:global_search"), {"q": query})

    def _api(self, query):
        return self.client.get(reverse("admin:global_search_api"), {"q": query})

    def _api_groups(self, query):
        response = self._api(query)
        self.assertEqual(response.status_code, 200)
        return response.json()["groups"]

    def _api_model_keys(self, query):
        return [group["key"] for group in self._api_groups(query)]

    # ------------------------------------------------------------------
    # Access control
    # ------------------------------------------------------------------
    def test_anonymous_user_is_redirected_to_login(self):
        self.client.logout()
        response = self._search("walnut")
        self.assertEqual(response.status_code, 302)
        self.assertIn("/admin/login/", response.url)

    def test_non_staff_user_is_redirected_to_login(self):
        non_staff = User.objects.create_user(
            username="regular", password="pw123456"
        )
        self.client.force_login(non_staff)
        response = self._search("walnut")
        self.assertEqual(response.status_code, 302)
        self.assertIn("/admin/login/", response.url)

    # ------------------------------------------------------------------
    # Core matches
    # ------------------------------------------------------------------
    def test_search_matches_product_title(self):
        response = self._search("walnut")
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, self.product.title)
        self.assertContains(
            response, reverse("admin:products_product_change", args=[self.product.pk])
        )

    def test_search_matches_user_by_email_and_username(self):
        response = self._search("jane@example.com")
        self.assertContains(response, "janedoe")
        response = self._search("janedoe")
        self.assertContains(response, "janedoe")

    def test_search_matches_order_by_order_number(self):
        response = self._search("ORD-TEST-0001")
        self.assertContains(response, "ORD-TEST-0001")
        self.assertContains(
            response, reverse("admin:orders_order_change", args=[self.order.pk])
        )

    def test_search_matches_category_and_subcategory(self):
        response = self._search("frames")
        self.assertContains(response, "Frames")
        response = self._search("photo frames")
        self.assertContains(response, "Photo Frames")

    def test_search_matches_size_color_coupon_cart_banner(self):
        self.assertContains(self._search("12X18"), "12X18 in")
        self.assertContains(self._search("black"), "Black")
        self.assertContains(self._search("save10"), "SAVE10")
        self.assertContains(self._search("janedoe"), "Cart for janedoe")
        self.assertContains(self._search("summer sale"), "Summer Sale")

    # ------------------------------------------------------------------
    # Excluded models
    # ------------------------------------------------------------------
    def test_low_signal_models_are_excluded(self):
        OrderItem.objects.create(
            order=self.order,
            product=self.product,
            quantity=1,
            price=Decimal("100.00"),
        )
        keys = self._api_model_keys("walnut")
        self.assertNotIn("orders.orderitem", keys)
        self.assertNotIn("products.productvariant", keys)

        keys = self._api_model_keys("save10")
        self.assertNotIn("orders.couponusage", keys)
        self.assertNotIn("orders.orderitem", keys)
        self.assertNotIn("auth.group", keys)

    # ------------------------------------------------------------------
    # Limits / shape
    # ------------------------------------------------------------------
    def test_api_respects_per_model_limit(self):
        for index in range(API_PER_MODEL_LIMIT + 3):
            Product.objects.create(title=f"Capped Product {index}")
        groups = self._api_groups("capped")
        product_group = next(
            group for group in groups if group["key"] == "products.product"
        )
        self.assertEqual(len(product_group["results"]), API_PER_MODEL_LIMIT)

    def test_page_respects_per_model_limit(self):
        for index in range(PAGE_PER_MODEL_LIMIT + 3):
            Product.objects.create(title=f"Capped Product {index}")
        response = self._search("capped")
        product_group = next(
            group
            for group in response.context["groups"]
            if group["model_key"] == "products.product"
        )
        self.assertEqual(product_group["count"], PAGE_PER_MODEL_LIMIT)

    def test_api_returns_expected_json_shape(self):
        response = self._api("walnut")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"].split(";")[0], "application/json")
        data = response.json()
        self.assertEqual(data["query"], "walnut")
        self.assertTrue(data["groups"])
        group = data["groups"][0]
        self.assertIn("key", group)
        self.assertIn("label", group)
        self.assertIn("changelist_url", group)
        self.assertIn("results", group)

    def test_page_links_to_changelist_with_query(self):
        response = self._search("walnut")
        self.assertContains(
            response,
            reverse("admin:products_product_changelist") + "?q=walnut",
        )

    # ------------------------------------------------------------------
    # Empty / short queries
    # ------------------------------------------------------------------
    def test_empty_query_shows_prompt(self):
        response = self.client.get(reverse("admin:global_search"))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Enter at least two characters")

    def test_short_query_returns_no_results(self):
        response = self._search("w")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context["groups"], [])

    def test_empty_api_query_returns_empty_groups(self):
        response = self.client.get(reverse("admin:global_search_api"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"query": "", "groups": []})

    def test_api_rejects_non_get_methods(self):
        response = self.client.post(reverse("admin:global_search_api"))
        self.assertEqual(response.status_code, 405)
