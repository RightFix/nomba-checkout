from __future__ import annotations

import uuid
from django.db import models

def generate_reference():
    return f"NP-{uuid.uuid4().hex[:12].upper()}"

class Payment(models.Model):
    """
    One row per customer checkout attempt.
    Tracks which dev the money should be forwarded to after completion.
    """

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        SUCCESS = "success", "Success"
        FAILED = "failed", "Failed"
        TRANSFERRED = "transferred", "Transferred to Dev"
        REFUNDED = "refunded", "Refunded to Customer"

    class Method(models.TextChoices):
        CARD = "card", "Card"
        TRANSFER = "transfer", "Bank Transfer"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    dev_id = models.CharField(max_length=128, default="")
    payment_ref = models.CharField(max_length=20,default=generate_reference, editable=False,unique=True)
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    currency = models.CharField(max_length=8, default="NGN")
    customer_email = models.EmailField()
    customer_name = models.CharField(max_length=255, blank=True)
    method = models.CharField(
        max_length=16, choices=Method.choices, default=Method.CARD
    )
    status = models.CharField(
        max_length=16, choices=Status.choices, default=Status.PENDING
    )
    # card flow — set after submit_card succeeds
    transaction_id = models.CharField(max_length=255, blank=True)
    # raw Nomba response stored for audit
    nomba_response = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return f"{self.payment_ref} [{self.status}] → {self.dev_id}"


class SavedCard(models.Model):
    """
    Tokenised card per (dev + customer_email).
    A customer's card saved on Dev A's app is NOT automatically
    available on Dev B's app.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    dev_id = models.CharField(max_length=128,default='')
    customer_email = models.EmailField()
    card_token = models.TextField()  # opaque token from Nomba
    card_last4 = models.CharField(max_length=4, blank=True)
    card_type = models.CharField(max_length=32, blank=True)  # Visa, Mastercard, etc.
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        # one saved card per customer per dev (latest wins)
        unique_together = [("dev_id", "customer_email")]

    def __str__(self) -> str:
        return f"{self.customer_email} card on {self.dev_id} (***{self.card_last4})"


class VirtualAccountSession(models.Model):
    """
    One-time virtual account created per transfer-method payment.
    Expires once money is received; linked back to the Payment so
    the webhook handler knows where to forward the money.
    """

    class Status(models.TextChoices):
        PENDING = "pending", "Awaiting Payment"
        RECEIVED = "received", "Payment Received"
        EXPIRED = "expired", "Expired"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    payment = models.OneToOneField(
        Payment, on_delete=models.CASCADE, related_name="virtual_account"
    )
    account_number = models.CharField(max_length=20)
    account_name = models.CharField(max_length=255)
    bank_name = models.CharField(max_length=128)
    account_ref = models.CharField(max_length=128, unique=True)  # Nomba accountRef
    status = models.CharField(
        max_length=16, choices=Status.choices, default=Status.PENDING
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f"VirtualAcct {self.account_number} → {self.payment.payment_ref}"


class WebhookEvent(models.Model):
    """Append-only log of verified Nomba webhooks. request_id is unique for deduplication."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    event_type = models.CharField(max_length=128)
    request_id = models.CharField(max_length=255, unique=True)
    payload = models.JSONField()
    processed = models.BooleanField(default=False)
    received_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f"{self.event_type} {self.request_id}"


class TransferLog(models.Model):
    """
    Audit trail of every payout from my Nomba account to a dev's bank.
    Written immediately after the Nomba transfer API call succeeds.
    """

    class Status(models.TextChoices):
        SUCCESS = "success", "Success"
        FAILED = "failed", "Failed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    payment = models.OneToOneField(
        Payment, on_delete=models.PROTECT, related_name="transfer_log"
    )
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    merchant_tx_ref = models.CharField(max_length=128, unique=True)
    status = models.CharField(max_length=16, choices=Status.choices)
    nomba_response = models.JSONField(default=dict, blank=True)
    error = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f"Transfer {self.merchant_tx_ref} [{self.status}]"
