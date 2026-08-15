from decimal import Decimal

from django.contrib.auth.models import User
from django.core.cache import cache
from django.test import TestCase
from django.urls import reverse

from orders.models import Order, OrderItem
from products.models import Category, Product, SubCategory
from rest_framework.test import APIClient

from .models import ProductReview


class ReviewsBaseTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            "buyer",
            "buyer@example.com",
            "pass12345",
            first_name="Aisha",
            last_name="Khan",
        )
        self.other_user = User.objects.create_user(
            "other",
            "other@example.com",
            "pass12345",
        )

        self.category = Category.objects.create(name="Frames")
        self.subcategory = SubCategory.objects.create(
            category=self.category,
            name="Modern",
        )
        self.product = Product.objects.create(
            title="Walnut Photo Frame",
            slug="walnut-photo-frame",
            mrp=Decimal("799.00"),
            slashed_price=Decimal("699.00"),
            stock=10,
            category=self.category,
            sub_category=self.subcategory,
        )

        self.client = APIClient()

    def create_delivered_order(self, user=None, status="delivered", paid=True):
        user = user or self.user
        order = Order.objects.create(
            user=user,
            total_amount=Decimal("699.00"),
            status=status,
            payment_processed=paid,
            shipping_address="1 Main Road",
            city="Mumbai",
            postal_code="400001",
            phone="9876543210",
        )
        order_item = OrderItem.objects.create(
            order=order,
            product=self.product,
            quantity=1,
            price=Decimal("699.00"),
        )
        order_item.capture_product_snapshot(product=self.product)
        order_item.save(
            update_fields=[
                "product_title",
                "product_slug",
                "product_image",
                "product_category_name",
                "product_category_slug",
                "product_sub_category_name",
                "product_sub_category_slug",
                "variant_size_name",
                "variant_color_name",
                "variant_sku",
            ]
        )
        return order, order_item

    def create_review(self, user=None, rating=5, **kwargs):
        user = user or self.user
        return ProductReview.objects.create(
            user=user,
            product=self.product,
            rating=rating,
            **kwargs,
        )

    def tearDown(self):
        cache.clear()
        super().tearDown()


class ProductReviewListTests(ReviewsBaseTestCase):
    def test_public_list_empty(self):
        url = reverse("product-reviews", args=[self.product.id])
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["count"], 0)
        self.assertEqual(data["summary"]["total_count"], 0)
        self.assertIsNone(data["summary"]["average_rating"])
        self.assertEqual(data["reviews"], [])

    def test_list_includes_verified_reviews_and_summary(self):
        self.create_review(rating=5, title="Great", comment="Love it", is_verified_purchase=True)
        self.create_review(rating=3, comment="Okay", user=self.other_user)

        url = reverse("product-reviews", args=[self.product.id])
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        data = response.json()

        self.assertEqual(data["count"], 2)
        self.assertEqual(data["summary"]["total_count"], 2)
        self.assertEqual(data["summary"]["average_rating"], 4.0)
        self.assertEqual(data["summary"]["distribution"], {"1": 0, "2": 0, "3": 1, "4": 0, "5": 1})

        first = data["reviews"][0]
        self.assertIn("user_name", first)
        self.assertIn("is_verified_purchase", first)
        # Newest review (higher id) sorts first.
        self.assertEqual(first["rating"], 3)
        self.assertEqual(data["reviews"][1]["rating"], 5)


class ProductReviewCreateTests(ReviewsBaseTestCase):
    def test_unauthenticated_create_is_401(self):
        url = reverse("product-review-create", args=[self.product.id])
        response = self.client.post(
            url,
            {"rating": 5, "comment": "Nice frame"},
            format="json",
        )
        self.assertEqual(response.status_code, 401)

    def test_create_requires_delivered_order(self):
        self.client.force_authenticate(user=self.user)
        self.create_delivered_order(status="shipped", paid=True)

        url = reverse("product-review-create", args=[self.product.id])
        response = self.client.post(
            url,
            {"rating": 5, "comment": "Nice frame"},
            format="json",
        )
        self.assertEqual(response.status_code, 403)

    def test_create_with_delivered_unpaid_order_succeeds(self):
        self.client.force_authenticate(user=self.user)
        self.create_delivered_order(status="delivered", paid=False)

        url = reverse("product-review-create", args=[self.product.id])
        response = self.client.post(
            url,
            {"rating": 5, "comment": "Nice frame"},
            format="json",
        )
        self.assertEqual(response.status_code, 201)

    def test_create_with_delivered_paid_order_succeeds(self):
        self.client.force_authenticate(user=self.user)
        order, order_item = self.create_delivered_order()

        url = reverse("product-review-create", args=[self.product.id])
        response = self.client.post(
            url,
            {"rating": 5, "title": "Beautiful", "comment": "Excellent finish."},
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        body = response.json()

        review = ProductReview.objects.get(product=self.product, user=self.user)
        self.assertTrue(review.is_verified_purchase)
        self.assertEqual(review.order, order)
        self.assertEqual(review.order_item, order_item)
        self.assertEqual(body["review"]["rating"], 5)

    def test_duplicate_review_rejected(self):
        self.client.force_authenticate(user=self.user)
        self.create_delivered_order()
        self.create_review()

        url = reverse("product-review-create", args=[self.product.id])
        response = self.client.post(
            url,
            {"rating": 4, "comment": "Again"},
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_rating_bounds_enforced(self):
        self.client.force_authenticate(user=self.user)
        self.create_delivered_order()

        url = reverse("product-review-create", args=[self.product.id])
        for rating in (0, 6, "x"):
            response = self.client.post(
                url,
                {"rating": rating, "comment": "Test"},
                format="json",
            )
            self.assertEqual(response.status_code, 400, f"rating={rating}")

    def test_requires_comment_or_title(self):
        self.client.force_authenticate(user=self.user)
        self.create_delivered_order()

        url = reverse("product-review-create", args=[self.product.id])
        response = self.client.post(
            url,
            {"rating": 5},
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_cancelled_order_never_grants_eligibility(self):
        self.client.force_authenticate(user=self.user)
        self.create_delivered_order(status="cancelled", paid=True)

        url = reverse("product-review-create", args=[self.product.id])
        response = self.client.post(
            url,
            {"rating": 5, "comment": "Test"},
            format="json",
        )
        self.assertEqual(response.status_code, 403)


class ProductReviewUpdateDeleteTests(ReviewsBaseTestCase):
    def setUp(self):
        super().setUp()
        self.create_delivered_order()
        self.review = self.create_review(rating=4, comment="Good")

    def test_owner_can_update(self):
        self.client.force_authenticate(user=self.user)
        url = reverse("review-detail", args=[self.review.id])
        response = self.client.patch(
            url,
            {"rating": 5, "comment": "Updated"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.review.refresh_from_db()
        self.assertEqual(self.review.rating, 5)
        self.assertEqual(self.review.comment, "Updated")

    def test_other_user_cannot_update(self):
        self.client.force_authenticate(user=self.other_user)
        url = reverse("review-detail", args=[self.review.id])
        response = self.client.patch(url, {"rating": 1}, format="json")
        self.assertEqual(response.status_code, 403)

    def test_owner_can_delete(self):
        self.client.force_authenticate(user=self.user)
        url = reverse("review-detail", args=[self.review.id])
        response = self.client.delete(url)
        self.assertEqual(response.status_code, 200)
        self.assertFalse(ProductReview.objects.filter(id=self.review.id).exists())

    def test_other_user_cannot_delete(self):
        self.client.force_authenticate(user=self.other_user)
        url = reverse("review-detail", args=[self.review.id])
        response = self.client.delete(url)
        self.assertEqual(response.status_code, 403)
        self.assertTrue(ProductReview.objects.filter(id=self.review.id).exists())


class ReviewEligibilityAndMyReviewsTests(ReviewsBaseTestCase):
    def test_eligibility_requires_auth(self):
        url = reverse("product-review-eligibility", args=[self.product.id])
        response = self.client.get(url)
        self.assertEqual(response.status_code, 401)

    def test_eligibility_state(self):
        self.client.force_authenticate(user=self.user)
        url = reverse("product-review-eligibility", args=[self.product.id])

        response = self.client.get(url)
        body = response.json()
        self.assertFalse(body["can_review"])
        self.assertFalse(body["has_reviewed"])

        self.create_delivered_order()
        response = self.client.get(url)
        body = response.json()
        self.assertTrue(body["can_review"])
        self.assertFalse(body["has_reviewed"])
        self.assertIsNotNone(body["order_item_id"])

        self.create_review()
        response = self.client.get(url)
        body = response.json()
        self.assertFalse(body["can_review"])
        self.assertTrue(body["has_reviewed"])
        self.assertIsNotNone(body["review_id"])

    def test_my_reviews_lists_only_own(self):
        self.client.force_authenticate(user=self.other_user)
        self.create_delivered_order(user=self.other_user)
        self.create_review(user=self.other_user, rating=3, comment="Nice")

        url = reverse("my-reviews")
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["count"], 1)
        review_data = body["reviews"][0]
        self.assertEqual(review_data["product_id"], self.product.id)
        self.assertEqual(review_data["product_title"], "Walnut Photo Frame")
        self.assertEqual(review_data["product_slug"], "walnut-photo-frame")


class ProductDeletionBlockedByReviewsTests(ReviewsBaseTestCase):
    def test_product_with_review_cannot_be_hard_deleted(self):
        self.create_delivered_order()
        self.create_review()

        self.product.refresh_from_db()
        self.assertFalse(self.product.can_hard_delete())
        self.assertIn("reviews", self.product.get_delete_blockers())

        self.product.delete()
        self.product.refresh_from_db()
        self.assertFalse(self.product.is_active)
        self.assertTrue(Product.objects.filter(id=self.product.id).exists())


class OrderPayloadReviewStateTests(ReviewsBaseTestCase):
    def test_order_detail_includes_review_state(self):
        order, _ = self.create_delivered_order()
        self.client.force_authenticate(user=self.user)

        url = reverse("order_detail", args=[order.id])
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        item = response.json()["order"]["items"][0]
        self.assertTrue(item["reviews"]["can_review"])
        self.assertFalse(item["reviews"]["has_reviewed"])

        self.create_review()
        response = self.client.get(url)
        item = response.json()["order"]["items"][0]
        self.assertFalse(item["reviews"]["can_review"])
        self.assertTrue(item["reviews"]["has_reviewed"])
        self.assertIsNotNone(item["reviews"]["review_id"])
