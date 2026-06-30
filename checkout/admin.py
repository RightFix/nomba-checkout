from django.contrib import admin
from .models import (
    Dev,
    Payment,
    SavedCard,
    VirtualAccountSession,
    WebhookEvent,
    TransferLog,
)


@admin.register(Dev)
class DevAdmin(admin.ModelAdmin):
    list_display = [
        "account_name",
        "account_number",
        "bank_name",
        "is_active",
        "created_at",
    ]
    list_filter = ["is_active", "bank_name"]
    search_fields = ["account_name", "account_number"]


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ["payment_ref", "dev", "amount", "status", "method", "created_at"]
    list_filter = ["status", "method", "currency"]
    search_fields = ["payment_ref", "customer_email"]
    raw_id_fields = ["dev"]


@admin.register(SavedCard)
class SavedCardAdmin(admin.ModelAdmin):
    list_display = ["dev", "customer_email", "card_last4", "card_type", "created_at"]
    search_fields = ["customer_email"]
    raw_id_fields = ["dev"]


@admin.register(VirtualAccountSession)
class VirtualAccountSessionAdmin(admin.ModelAdmin):
    list_display = ["account_number", "payment", "status", "created_at"]
    list_filter = ["status"]
    raw_id_fields = ["payment"]


@admin.register(WebhookEvent)
class WebhookEventAdmin(admin.ModelAdmin):
    list_display = ["event_type", "request_id", "processed", "received_at"]
    list_filter = ["processed", "event_type"]
    search_fields = ["request_id"]


@admin.register(TransferLog)
class TransferLogAdmin(admin.ModelAdmin):
    list_display = ["merchant_tx_ref", "dev", "amount", "status", "created_at"]
    list_filter = ["status"]
    raw_id_fields = ["dev", "payment"]
