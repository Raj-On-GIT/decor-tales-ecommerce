from rest_framework.throttling import AnonRateThrottle


class NewsletterSubscribeThrottle(AnonRateThrottle):
    # Limit subscribe requests to reduce email harvesting abuse from a single IP.
    scope = "newsletter"
