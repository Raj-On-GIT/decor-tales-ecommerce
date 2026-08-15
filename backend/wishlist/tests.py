from decimal import Decimal

from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from products.models import Category, Product

from .models import WishlistItem


class WishlistBaseTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            "shopper",
            "shopper@example.com",
            "pass12345",
        )
        self.other_user = User.objects.create_user(
            "other",
            "other@example.com",
            "pass12345",
        )

        self.category = Category.objects.create(name="Frames")
        self.product = Product.objects.create(
            title="Walnut Photo Frame",
            slug="walnut-photo-frame",
            mrp=Decimal("799.00"),
            slashed_price=Decimal("699.00"),
            stock=10,
            category=self.category,
        )

        self.client = APIClient()


class WishlistEndpointTests(WishlistBaseTestCase):
    def test_list_requires_authentication(self):
        response = self.client.get(reverse("wishlist-list"))
        self.assertEqual(response.status_code, 401)

    def test_toggle_requires_authentication(self):
        response = self.client.post(
            reverse("wishlist-toggle"),
            {"product_id": self.product.id},
            format="json",
        )
        self.assertEqual(response.status_code, 401)

    def test_empty_wishlist(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get(reverse("wishlist-list"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["items"], [])
        self.assertEqual(response.data["count"], 0)
        self.assertFalse(response.data["has_more"])

    def test_toggle_adds_and_removes(self):
        self.client.force_authenticate(user=self.user)
        url = reverse("wishlist-toggle")

        response = self.client.post(url, {"product_id": self.product.id}, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.data["in_wishlist"])
        self.assertIsNotNone(response.data["wishlist_item_id"])
        self.assertTrue(
            WishlistItem.objects.filter(
                user=self.user, product=self.product
            ).exists()
        )

        response = self.client.post(url, {"product_id": self.product.id}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data["in_wishlist"])
        self.assertFalse(
            WishlistItem.objects.filter(
                user=self.user, product=self.product
            ).exists()
        )

    def test_add_is_idempotent(self):
        self.client.force_authenticate(user=self.user)
        url = reverse("wishlist-add")

        first = self.client.post(url, {"product_id": self.product.id}, format="json")
        self.assertEqual(first.status_code, 201)

        second = self.client.post(url, {"product_id": self.product.id}, format="json")
        self.assertEqual(second.status_code, 200)
        self.assertEqual(
            WishlistItem.objects.filter(
                user=self.user, product=self.product
            ).count(),
            1,
        )

    def test_toggle_requires_product_id(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.post(
            reverse("wishlist-toggle"), {}, format="json"
        )
        self.assertEqual(response.status_code, 400)

    def test_toggle_invalid_product(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.post(
            reverse("wishlist-toggle"),
            {"product_id": 999999},
            format="json",
        )
        self.assertEqual(response.status_code, 404)

    def test_list_contains_product_data(self):
        self.client.force_authenticate(user=self.user)
        WishlistItem.objects.create(user=self.user, product=self.product)

        response = self.client.get(reverse("wishlist-list"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        item = response.data["items"][0]
        self.assertEqual(item["product"]["id"], self.product.id)
        self.assertEqual(item["product"]["title"], "Walnut Photo Frame")
        self.assertEqual(item["product"]["slug"], "walnut-photo-frame")

    def test_list_is_user_scoped(self):
        self.client.force_authenticate(user=self.user)
        WishlistItem.objects.create(user=self.other_user, product=self.product)

        response = self.client.get(reverse("wishlist-list"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 0)

    def test_remove_only_owner(self):
        item = WishlistItem.objects.create(user=self.user, product=self.product)

        self.client.force_authenticate(user=self.other_user)
        response = self.client.delete(
            reverse("wishlist-remove", args=[item.id])
        )
        self.assertEqual(response.status_code, 404)
        self.assertTrue(
            WishlistItem.objects.filter(id=item.id).exists()
        )

        self.client.force_authenticate(user=self.user)
        response = self.client.delete(
            reverse("wishlist-remove", args=[item.id])
        )
        self.assertEqual(response.status_code, 200)
        self.assertFalse(
            WishlistItem.objects.filter(id=item.id).exists()
        )

    def test_unique_user_product(self):
        WishlistItem.objects.create(user=self.user, product=self.product)
        duplicate = WishlistItem(user=self.user, product=self.product)
        with self.assertRaises(Exception):
            duplicate.save()

    def test_toggle_list_pagination(self):
        self.client.force_authenticate(user=self.user)
        for index in range(3):
            product = Product.objects.create(
                title=f"Frame {index}",
                slug=f"frame-{index}",
                mrp=Decimal("500.00"),
                slashed_price=Decimal("400.00"),
                stock=5,
                category=self.category,
            )
            WishlistItem.objects.create(user=self.user, product=product)

        response = self.client.get(reverse("wishlist-list"), {"limit": 2, "offset": 0})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["items"]), 2)
        self.assertTrue(response.data["has_more"])

        response = self.client.get(reverse("wishlist-list"), {"limit": 2, "offset": 2})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["items"]), 1)
        self.assertFalse(response.data["has_more"])
