from django.db import models
from django.utils import timezone


class NewsletterSubscriber(models.Model):
    email = models.EmailField(unique=True)
    is_active = models.BooleanField(
        default=True,
        help_text="Unchecked once a subscriber opts out. Bulk sends only target active subscribers.",
    )
    source = models.CharField(
        max_length=50,
        default="footer",
        help_text="Where the signup happened (e.g. footer, homepage).",
    )
    unsubscribed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Newsletter subscriber"
        verbose_name_plural = "Newsletter subscribers"

    def __str__(self):
        return self.email

    def save(self, *args, **kwargs):
        self.email = (self.email or "").strip().lower()
        super().save(*args, **kwargs)

    def unsubscribe(self):
        self.is_active = False
        self.unsubscribed_at = timezone.now()
        self.save(update_fields=["is_active", "unsubscribed_at", "updated_at"])

    def resubscribe(self):
        self.is_active = True
        self.unsubscribed_at = None
        self.save(update_fields=["is_active", "unsubscribed_at", "updated_at"])
