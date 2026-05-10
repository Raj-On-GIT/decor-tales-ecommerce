from unittest.mock import patch

from django.contrib.auth.models import User
from django.core.cache import cache
from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken
from rest_framework_simplejwt.tokens import RefreshToken

from .models import SignupOTPChallenge, UserAuthIdentity
from .services import revoke_other_user_sessions


@override_settings(SECURE_SSL_REDIRECT=False)
class SignupOTPTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient(enforce_csrf_checks=True)
        csrf_response = self.client.get(reverse("csrf_token"))
        self.csrf_token = csrf_response.cookies["csrftoken"].value
        self.signup_payload = {
            "email": "new-user@example.com",
            "password": "Strongpass123!",
            "password2": "Strongpass123!",
            "first_name": "New",
            "last_name": "User",
            "phone": "9876543210",
        }

    @patch("accounts.services.send_signup_otp_email")
    def test_signup_start_sends_otp_without_creating_user(self, mock_send_signup_otp_email):
        response = self.client.post(
            reverse("signup"),
            self.signup_payload,
            format="json",
            HTTP_X_CSRFTOKEN=self.csrf_token,
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["message"], "Verification code sent to your email.")
        self.assertIn("signup_token", response.data)
        self.assertFalse(User.objects.filter(email="new-user@example.com").exists())
        self.assertTrue(SignupOTPChallenge.objects.filter(email="new-user@example.com").exists())
        mock_send_signup_otp_email.assert_called_once()

    @patch("accounts.services.send_signup_otp_email")
    def test_signup_verify_creates_user_after_valid_otp(self, mock_send_signup_otp_email):
        captured_otp = {}

        def capture_otp(*, to_email, otp_code):
            captured_otp["code"] = otp_code
            return {"id": "email_123"}

        mock_send_signup_otp_email.side_effect = capture_otp

        start_response = self.client.post(
            reverse("signup"),
            self.signup_payload,
            format="json",
            HTTP_X_CSRFTOKEN=self.csrf_token,
        )

        verify_response = self.client.post(
            reverse("signup_verify"),
            {
                "signup_token": start_response.data["signup_token"],
                "otp": captured_otp["code"],
            },
            format="json",
            HTTP_X_CSRFTOKEN=self.csrf_token,
        )

        self.assertEqual(verify_response.status_code, 201)
        self.assertEqual(verify_response.data["user"]["email"], "new-user@example.com")
        self.assertTrue(User.objects.filter(email="new-user@example.com").exists())
        self.assertEqual(User.objects.get(email="new-user@example.com").profile.phone, "9876543210")

    @patch("accounts.services.send_signup_otp_email")
    def test_signup_verify_rejects_invalid_otp(self, mock_send_signup_otp_email):
        mock_send_signup_otp_email.return_value = {"id": "email_123"}

        start_response = self.client.post(
            reverse("signup"),
            self.signup_payload,
            format="json",
            HTTP_X_CSRFTOKEN=self.csrf_token,
        )

        verify_response = self.client.post(
            reverse("signup_verify"),
            {
                "signup_token": start_response.data["signup_token"],
                "otp": "000000",
            },
            format="json",
            HTTP_X_CSRFTOKEN=self.csrf_token,
        )

        self.assertEqual(verify_response.status_code, 400)
        self.assertEqual(verify_response.data["error"], "Invalid verification code.")
        self.assertFalse(User.objects.filter(email="new-user@example.com").exists())

    @patch("accounts.services.send_signup_otp_email")
    def test_signup_start_enforces_resend_cooldown(self, mock_send_signup_otp_email):
        mock_send_signup_otp_email.return_value = {"id": "email_123"}

        first_response = self.client.post(
            reverse("signup"),
            self.signup_payload,
            format="json",
            HTTP_X_CSRFTOKEN=self.csrf_token,
        )
        second_response = self.client.post(
            reverse("signup"),
            self.signup_payload,
            format="json",
            HTTP_X_CSRFTOKEN=self.csrf_token,
        )

        self.assertEqual(first_response.status_code, 200)
        self.assertEqual(second_response.status_code, 429)


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
            "sub": "google-sub-mismatch",
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
            "sub": "google-sub-1",
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
        self.assertTrue(
            UserAuthIdentity.objects.filter(
                provider=UserAuthIdentity.PROVIDER_GOOGLE,
                provider_user_id="google-sub-1",
            ).exists()
        )

    @patch("accounts.views.settings.GOOGLE_CLIENT_ID", "google-client-id")
    @patch("accounts.views.id_token.verify_oauth2_token")
    def test_google_auth_links_to_existing_user_with_same_email(self, mock_verify_token):
        existing_user = User.objects.create_user(
            username="existing-user",
            email="google@example.com",
            password="testpass123",
        )
        nonce_response = self.client.get(reverse("google_auth_nonce"))

        mock_verify_token.return_value = {
            "sub": "google-sub-link",
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
        self.assertEqual(response.data["user"]["id"], existing_user.id)
        self.assertEqual(User.objects.filter(email="google@example.com").count(), 1)
        self.assertTrue(
            UserAuthIdentity.objects.filter(
                user=existing_user,
                provider=UserAuthIdentity.PROVIDER_GOOGLE,
                provider_user_id="google-sub-link",
            ).exists()
        )

    @patch("accounts.views.settings.GOOGLE_CLIENT_ID", "google-client-id")
    @patch("accounts.views.id_token.verify_oauth2_token")
    def test_google_auth_reuses_existing_provider_identity(self, mock_verify_token):
        user = User.objects.create_user(
            username="google-user",
            email="google@example.com",
            password="testpass123",
        )
        UserAuthIdentity.objects.create(
            user=user,
            provider=UserAuthIdentity.PROVIDER_GOOGLE,
            provider_user_id="google-sub-stable",
            email_normalized="google@example.com",
        )
        nonce_response = self.client.get(reverse("google_auth_nonce"))

        mock_verify_token.return_value = {
            "sub": "google-sub-stable",
            "email": "Google@Example.com",
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
        self.assertEqual(response.data["user"]["id"], user.id)
        self.assertEqual(User.objects.filter(email__iexact="google@example.com").count(), 1)


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


class PasswordResetTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="reset-user",
            email="reset@example.com",
            password="testpass123",
        )

    @patch("accounts.serializers.send_password_reset_email")
    def test_forgot_password_uses_resend_mailer(self, mock_send_password_reset_email):
        response = self.client.post(
            "/api/auth/forgot-password/",
            {"email": "reset@example.com"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        mock_send_password_reset_email.assert_called_once()


@override_settings(SECURE_SSL_REDIRECT=False)
class AccountSecurityTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient(enforce_csrf_checks=True)
        self.user = User.objects.create_user(
            username="security-user",
            email="security@example.com",
            password="testpass123",
        )
        self.google_only_user = User.objects.create(
            username="google-only",
            email="google-only@example.com",
        )
        self.google_only_user.set_unusable_password()
        self.google_only_user.save(update_fields=["password"])
        UserAuthIdentity.objects.create(
            user=self.google_only_user,
            provider=UserAuthIdentity.PROVIDER_GOOGLE,
            provider_user_id="google-sub-security",
            email_normalized="google-only@example.com",
        )

    def authenticate(self, email, password):
        csrf_response = self.client.get(reverse("csrf_token"))
        csrf_token = csrf_response.cookies["csrftoken"].value
        response = self.client.post(
            reverse("login"),
            {"username": email, "password": password},
            format="json",
            HTTP_X_CSRFTOKEN=csrf_token,
        )
        self.client.cookies["access_token"] = response.cookies["access_token"].value
        self.client.cookies["refresh_token"] = response.cookies["refresh_token"].value
        return csrf_token

    def test_account_security_endpoint_returns_password_and_identity_state(self):
        csrf_token = self.authenticate("security@example.com", "testpass123")

        response = self.client.get(
            "/api/accounts/security/",
            HTTP_X_CSRFTOKEN=csrf_token,
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["email"], "security@example.com")
        self.assertTrue(response.data["has_password"])
        self.assertEqual(response.data["linked_identities"], [])

    def test_set_password_allows_google_only_user(self):
        self.assertTrue(
            self.client.force_authenticate(user=self.google_only_user) is None
        )

        response = self.client.post(
            "/api/accounts/set-password/",
            {
                "new_password": "Strongpass123!",
                "confirm_password": "Strongpass123!",
            },
            format="json",
        )

        self.google_only_user.refresh_from_db()

        self.assertEqual(response.status_code, 200)
        self.assertTrue(self.google_only_user.has_usable_password())
        self.assertTrue(self.google_only_user.check_password("Strongpass123!"))

    def test_set_password_rejects_user_with_existing_password(self):
        self.assertTrue(self.client.force_authenticate(user=self.user) is None)

        response = self.client.post(
            "/api/accounts/set-password/",
            {
                "new_password": "Strongpass123!",
                "confirm_password": "Strongpass123!",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)

    def test_revoke_other_user_sessions_preserves_current_refresh_token(self):
        current_refresh = RefreshToken.for_user(self.user)
        other_refresh = RefreshToken.for_user(self.user)

        revoked_count = revoke_other_user_sessions(
            user=self.user,
            current_refresh_token=str(current_refresh),
        )

        self.assertEqual(revoked_count, 1)
        self.assertFalse(
            BlacklistedToken.objects.filter(token__jti=current_refresh["jti"]).exists()
        )
        self.assertTrue(
            BlacklistedToken.objects.filter(token__jti=other_refresh["jti"]).exists()
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

    @patch("accounts.services.send_signup_otp_email")
    def test_signup_throttle_returns_429_after_ten_requests(self, mock_send_signup_otp_email):
        mock_send_signup_otp_email.return_value = {"id": "email_123"}
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
            self.assertIn(response.status_code, {200, 400, 429})

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
