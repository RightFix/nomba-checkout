import hmac
from rest_framework.permissions import BasePermission
from django.conf import settings


class IsPluginRequest(BasePermission):
    """
    Validates X-Plugin-Secret header against PLUGIN_API_SECRET env var.
    Every request from the Bubble plugin must include this header.
    Constant-time comparison prevents timing attacks.
    """

    def has_permission(self, request, view):
        secret = request.headers.get("X-Plugin-Secret", "")
        expected = settings.PLUGIN_API_SECRET
        if not secret or not expected:
            return False
        return hmac.compare_digest(secret.encode(), expected.encode())
