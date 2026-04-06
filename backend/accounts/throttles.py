from rest_framework.throttling import AnonRateThrottle


class LoginThrottle(AnonRateThrottle):
    # Limit login attempts to reduce credential stuffing from a single IP.
    scope = "login"


class SignupThrottle(AnonRateThrottle):
    # Limit signup requests to reduce account creation abuse from a single IP.
    scope = "signup"


class PasswordResetThrottle(AnonRateThrottle):
    # Limit password reset requests to reduce email spam and reset abuse from a single IP.
    scope = "password_reset"


class GoogleAuthThrottle(AnonRateThrottle):
    # Limit Google auth attempts to reduce token validation abuse from a single IP.
    scope = "google_auth"
