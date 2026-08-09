from rest_framework.throttling import AnonRateThrottle


class ProductViewThrottle(AnonRateThrottle):
    scope = "product_view"


class CartAddActivityThrottle(AnonRateThrottle):
    scope = "cart_add_activity"


class SearchThrottle(AnonRateThrottle):
    scope = "search"
