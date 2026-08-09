from rest_framework import serializers

from .models import NewsletterSubscriber


class NewsletterSubscribeSerializer(serializers.Serializer):
    email = serializers.EmailField(max_length=254)
    source = serializers.CharField(
        max_length=50,
        required=False,
        allow_blank=True,
        default="footer",
    )

    def validate_email(self, value):
        return (value or "").strip().lower()

    def validate_source(self, value):
        return (value or "").strip() or "footer"
