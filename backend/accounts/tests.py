from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import reverse
from django.core.cache import cache
from rest_framework.test import APIClient


class GoogleAuthTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()

    @patch("accounts.views.settings.GOOGLE_CLIENT_ID", "google-client-id")
    def test_google_nonce_endpoint_returns_nonce_payload(self):
        response = self.client.get(reverse("google_auth_nonce"))

        self.assertEqual(response.status_code, 200)
        self.assertIn("nonce", response.data)
        self.assertIn("nonce_token", response.data)
        self.assertTrue(response.data["nonce"])
        self.assertTrue(response.data["nonce_token"])

    @patch("accounts.views.settings.GOOGLE_CLIENT_ID", "google-client-id")
    def test_google_auth_rejects_invalid_nonce_token(self):
        response = self.client.post(
            reverse("google"),
            {
                "credential": "fake-jwt",
                "nonce_token": "invalid-token",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["error"], "Invalid Google login session.")

    @patch("accounts.views.settings.GOOGLE_CLIENT_ID", "google-client-id")
    @patch("accounts.views.id_token.verify_oauth2_token")
    def test_google_auth_rejects_nonce_mismatch(self, mock_verify_token):
        nonce_response = self.client.get(reverse("google_auth_nonce"))

        mock_verify_token.return_value = {
            "email": "google@example.com",
            "email_verified": True,
            "given_name": "Google",
            "family_name": "User",
            "iss": "https://accounts.google.com",
            "nonce": "wrong-nonce",
        }

        response = self.client.post(
            reverse("google"),
            {
                "credential": "fake-jwt",
                "nonce_token": nonce_response.data["nonce_token"],
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["error"], "Invalid Google token nonce.")

    @patch("accounts.views.settings.GOOGLE_CLIENT_ID", "google-client-id")
    @patch("accounts.views.id_token.verify_oauth2_token")
    def test_google_auth_accepts_valid_verified_id_token(self, mock_verify_token):
        nonce_response = self.client.get(reverse("google_auth_nonce"))

        mock_verify_token.return_value = {
            "email": "google@example.com",
            "email_verified": True,
            "given_name": "Google",
            "family_name": "User",
            "iss": "https://accounts.google.com",
            "nonce": nonce_response.data["nonce"],
        }

        response = self.client.post(
            reverse("google"),
            {
                "credential": "fake-jwt",
                "nonce_token": nonce_response.data["nonce_token"],
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn("access_token", response.cookies)
        self.assertIn("refresh_token", response.cookies)
        self.assertEqual(response.data["user"]["email"], "google@example.com")
        self.assertTrue(User.objects.filter(email="google@example.com").exists())


@override_settings(SECURE_SSL_REDIRECT=False)
class CookieAuthTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient(enforce_csrf_checks=True)
        self.user = User.objects.create_user(
            username="cookie-user",
            email="cookie@example.com",
            password="testpass123",
        )

    def test_login_sets_auth_cookies(self):
        csrf_response = self.client.get(reverse("csrf_token"))
        csrf_token = csrf_response.cookies["csrftoken"].value

        response = self.client.post(
            reverse("login"),
            {
                "username": "cookie@example.com",
                "password": "testpass123",
            },
            format="json",
            HTTP_X_CSRFTOKEN=csrf_token,
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn("access_token", response.cookies)
        self.assertIn("refresh_token", response.cookies)
        self.assertEqual(response.data["user"]["email"], "cookie@example.com")

    def test_refresh_rotates_cookie_session(self):
        csrf_response = self.client.get(reverse("csrf_token"))
        csrf_token = csrf_response.cookies["csrftoken"].value

        login_response = self.client.post(
            reverse("login"),
            {
                "username": "cookie@example.com",
                "password": "testpass123",
            },
            format="json",
            HTTP_X_CSRFTOKEN=csrf_token,
        )

        self.client.cookies["refresh_token"] = login_response.cookies["refresh_token"].value
        refresh_response = self.client.post(
            reverse("token_refresh"),
            {},
            format="json",
            HTTP_X_CSRFTOKEN=csrf_token,
        )

        self.assertEqual(refresh_response.status_code, 200)
        self.assertIn("access_token", refresh_response.cookies)
        self.assertIn("refresh_token", refresh_response.cookies)

    def test_profile_allows_storefront_jwt_cookie_auth(self):
        csrf_response = self.client.get(reverse("csrf_token"))
        csrf_token = csrf_response.cookies["csrftoken"].value

        login_response = self.client.post(
            reverse("login"),
            {
                "username": "cookie@example.com",
                "password": "testpass123",
            },
            format="json",
            HTTP_X_CSRFTOKEN=csrf_token,
        )

        self.client.cookies["access_token"] = login_response.cookies["access_token"].value
        self.client.cookies["refresh_token"] = login_response.cookies["refresh_token"].value

        profile_response = self.client.get(
            "/api/accounts/profile/",
            HTTP_X_CSRFTOKEN=csrf_token,
        )

        self.assertEqual(profile_response.status_code, 200)
        self.assertEqual(profile_response.data["email"], "cookie@example.com")

    def test_profile_rejects_django_session_auth(self):
        self.assertTrue(
            self.client.login(
                username="cookie-user",
                password="testpass123",
            )
        )

        response = self.client.get("/api/accounts/profile/")

        self.assertEqual(response.status_code, 401)
        self.assertEqual(
            response.data["error"],
            "Storefront authentication is required.",
        )


class AdditionalAuthThrottleTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="throttle-user",
            email="throttle@example.com",
            password="testpass123",
        )

    def test_login_throttle_returns_429_after_five_requests(self):
        for _ in range(5):
            response = self.client.post(
                reverse("login"),
                {"username": "throttle@example.com", "password": "wrong-password"},
                format="json",
            )
            self.assertEqual(response.status_code, 400)

        throttled_response = self.client.post(
            reverse("login"),
            {"username": "throttle@example.com", "password": "wrong-password"},
            format="json",
        )

        self.assertEqual(throttled_response.status_code, 429)


class AuthThrottleTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="throttle-user",
            email="throttle@example.com",
            password="testpass123",
        )

    def test_signup_throttle_returns_429_after_ten_requests(self):
        signup_payload = {
            "email": "new-user@example.com",
            "password": "Strongpass123!",
            "password2": "Strongpass123!",
            "first_name": "New",
            "last_name": "User",
            "phone": "9876543210",
        }

        for _ in range(10):
            response = self.client.post(
                reverse("signup"),
                signup_payload,
                format="json",
            )
            self.assertIn(response.status_code, {201, 400})

        throttled_response = self.client.post(
            reverse("signup"),
            signup_payload,
            format="json",
        )

        self.assertEqual(throttled_response.status_code, 429)

    def test_password_reset_throttle_returns_429_after_three_requests(self):
        for _ in range(3):
            response = self.client.post(
                "/api/auth/forgot-password/",
                {"email": "throttle@example.com"},
                format="json",
            )
            self.assertEqual(response.status_code, 200)

        throttled_response = self.client.post(
            "/api/auth/forgot-password/",
            {"email": "throttle@example.com"},
            format="json",
        )

        self.assertEqual(throttled_response.status_code, 429)

    @patch("accounts.views.settings.GOOGLE_CLIENT_ID", "google-client-id")
    def test_google_auth_throttle_returns_429_after_ten_requests(self):
        for _ in range(10):
            response = self.client.post(
                reverse("google"),
                {
                    "credential": "fake-jwt",
                    "nonce_token": "invalid-token",
                },
                format="json",
            )
            self.assertEqual(response.status_code, 400)

        throttled_response = self.client.post(
            reverse("google"),
            {
                "credential": "fake-jwt",
                "nonce_token": "invalid-token",
            },
            format="json",
        )

        self.assertEqual(throttled_response.status_code, 429)
