from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .models import NewsletterSubscriber
from .serializers import NewsletterSubscribeSerializer
from .throttles import NewsletterSubscribeThrottle


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([NewsletterSubscribeThrottle])
def subscribe_view(request):
    serializer = NewsletterSubscribeSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(
            {"error": "A valid email address is required."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    email = serializer.validated_data["email"]
    source = serializer.validated_data["source"]

    subscriber = NewsletterSubscriber.objects.filter(email=email).first()

    if subscriber is not None:
        if subscriber.is_active:
            return Response(
                {"status": "already_subscribed", "email": email},
                status=status.HTTP_200_OK,
            )
        subscriber.resubscribe()
        return Response(
            {"status": "subscribed", "email": email},
            status=status.HTTP_200_OK,
        )

    NewsletterSubscriber.objects.create(email=email, source=source)
    return Response(
        {"status": "subscribed", "email": email},
        status=status.HTTP_201_CREATED,
    )
