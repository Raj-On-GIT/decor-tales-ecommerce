from django.core.cache import cache
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from .models import NewsletterSubscriber


class NewsletterSubscribeViewTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.url = reverse("newsletter-subscribe")

    def test_valid_email_creates_subscriber(self):
        response = self.client.post(
            self.url,
            {"email": "test@example.com"},
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["status"], "subscribed")
        self.assertEqual(response.data["email"], "test@example.com")
        self.assertTrue(
            NewsletterSubscriber.objects.filter(email="test@example.com").exists()
        )

    def test_email_is_stored_lowercased_and_trimmed(self):
        response = self.client.post(
            self.url,
            {"email": "  Test@Example.COM  "},
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        subscriber = NewsletterSubscriber.objects.get()
        self.assertEqual(subscriber.email, "test@example.com")

    def test_invalid_email_returns_400(self):
        response = self.client.post(
            self.url,
            {"email": "not-an-email"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(NewsletterSubscriber.objects.exists())

    def test_missing_email_returns_400(self):
        response = self.client.post(
            self.url,
            {"email": ""},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(NewsletterSubscriber.objects.exists())

    def test_duplicate_subscribe_is_idempotent(self):
        NewsletterSubscriber.objects.create(email="test@example.com")

        response = self.client.post(
            self.url,
            {"email": "test@example.com"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "already_subscribed")
        self.assertEqual(NewsletterSubscriber.objects.count(), 1)

    def test_resubscribe_reactivates_inactive_subscriber(self):
        subscriber = NewsletterSubscriber.objects.create(
            email="test@example.com",
            is_active=False,
        )
        subscriber.unsubscribe()

        response = self.client.post(
            self.url,
            {"email": "test@example.com"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "subscribed")
        subscriber.refresh_from_db()
        self.assertTrue(subscriber.is_active)
        self.assertIsNone(subscriber.unsubscribed_at)

    def test_source_defaults_to_footer(self):
        self.client.post(
            self.url,
            {"email": "test@example.com"},
            format="json",
        )

        subscriber = NewsletterSubscriber.objects.get()
        self.assertEqual(subscriber.source, "footer")

    def test_custom_source_is_stored(self):
        self.client.post(
            self.url,
            {"email": "test@example.com", "source": "homepage"},
            format="json",
        )

        subscriber = NewsletterSubscriber.objects.get()
        self.assertEqual(subscriber.source, "homepage")

    def test_malformed_json_returns_400(self):
        response = self.client.post(
            self.url,
            data="not json",
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(NewsletterSubscriber.objects.exists())


class NewsletterSubscribeThrottleTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.url = reverse("newsletter-subscribe")

    def test_throttle_returns_429_after_five_requests(self):
        for _ in range(5):
            response = self.client.post(
                self.url,
                {"email": "throttle@example.com"},
                format="json",
            )
            self.assertIn(response.status_code, (200, 201))

        throttled_response = self.client.post(
            self.url,
            {"email": "throttle@example.com"},
            format="json",
        )

        self.assertEqual(throttled_response.status_code, 429)
