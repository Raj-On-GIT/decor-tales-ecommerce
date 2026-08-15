from rest_framework.throttling import AnonRateThrottle, UserRateThrottle


class ReviewWriteThrottle(UserRateThrottle):
    scope = "review"
