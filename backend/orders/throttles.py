from rest_framework.throttling import AnonRateThrottle, UserRateThrottle


class DelhiveryThrottle(AnonRateThrottle):
    scope = "delhivery"


class OrderFlowThrottle(UserRateThrottle):
    scope = "checkout"
