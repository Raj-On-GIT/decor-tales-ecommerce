from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient


class GoogleAuthTests(TestCase):
    def setUp(self):
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
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)
        self.assertEqual(response.data["user"]["email"], "google@example.com")
        self.assertTrue(User.objects.filter(email="google@example.com").exists())
