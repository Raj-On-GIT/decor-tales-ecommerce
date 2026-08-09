from django.conf import settings


class RealIPMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        xff = request.META.get("HTTP_X_FORWARDED_FOR")
        if xff:
            client_ip = self._resolve_client_ip(xff, settings.TRUSTED_PROXY_IPS)
            if client_ip:
                request.META["REMOTE_ADDR"] = client_ip
        return self.get_response(request)

    @staticmethod
    def _resolve_client_ip(xff, trusted_proxies):
        candidates = [ip.strip() for ip in xff.split(",")]
        if not candidates:
            return None
        if trusted_proxies:
            for candidate in reversed(candidates):
                if candidate not in trusted_proxies:
                    return candidate
            return None
        return candidates[0]
