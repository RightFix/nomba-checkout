from __future__ import annotations

import logging

from django.conf import settings
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from nomba.webhooks import verify_webhook_request

from checkout.models import Payment, TransferLog, VirtualAccountSession, WebhookEvent
from services.payout import payout_to_dev, refund_customer

log = logging.getLogger(__name__)


class NombaWebhookView(APIView):
    """
    POST /api/webhooks/nomba/

    Nomba calls this directly — no plugin secret, verified by HMAC signature.
    Handles both card payment events and virtual account payment events.

    Flow:
      1. Verify signature + replay window
      2. Deduplicate on request_id
      3. Determine event type → mark payment SUCCESS
      4. Immediately transfer full amount to dev's bank account
    """

    permission_classes = []

    def post(self, request: Request) -> Response:
        webhook_key = settings.NOMBA_WEBHOOK_KEY

        if not webhook_key:
            log.warning("NOMBA_WEBHOOK_KEY not set — skipping signature verification")
            payload = request.data
        else:
            try:
                payload = verify_webhook_request(
                    webhook_key,
                    body=request.body,
                    headers=dict(request.headers),
                    max_age_seconds=300,
                )
            except Exception as exc:
                log.warning("Webhook signature verification failed: %s", exc)
                return Response(
                    {"error": "invalid signature"},
                    status=status.HTTP_401_UNAUTHORIZED,
                )

        event_type = payload.get("event_type", "")
        request_id = payload.get("requestId", "")
        txn = (payload.get("data") or {}).get("transaction") or {}
        resp_code = txn.get("responseCode", "")
        txn_id = txn.get("transactionId", "")

        # ── deduplication ────────────────────────────────────────────────────
        _, created = WebhookEvent.objects.get_or_create(
            request_id=request_id,
            defaults={"event_type": event_type, "payload": payload},
        )
        if not created:
            log.info("Duplicate webhook ignored: requestId=%s", request_id)
            return Response({"received": True, "duplicate": True})

        log.info(
            "Webhook received: %s requestId=%s responseCode=%s",
            event_type,
            request_id,
            resp_code,
        )

        # ── card payment completed ────────────────────────────────────────────
        if resp_code == "00" and txn_id:
            payment = (
                Payment.objects.filter(
                    transaction_id=txn_id,
                    status=Payment.Status.PENDING,
                )
                .select_related("dev")
                .first()
            )

            if payment:
                payment.status = Payment.Status.SUCCESS
                payment.nomba_response = payload
                payment.save()
                transfer = payout_to_dev(payment)
                if transfer.status == TransferLog.Status.FAILED:
                    refund_result = refund_customer(payment)
                    if refund_result.get("success"):
                        payment.status = Payment.Status.REFUNDED
                    else:
                        payment.status = Payment.Status.FAILED
                    payment.save()
                log.info(
                    "Card payout: payment=%s transfer=%s status=%s",
                    payment.payment_ref,
                    transfer.merchant_tx_ref,
                    transfer.status,
                )

        # ── virtual account payment received ──────────────────────────────────
        # Nomba fires a different event type for virtual account credits.
        # The virtual account number in the payload lets us find the session.
        if event_type in (
            "virtualaccount.credit",
            "vact_transfer",
            "virtual_account_payment",
        ):
            va_number = (
                txn.get("destinationAccountNumber")
                or txn.get("accountNumber")
                or (payload.get("data") or {}).get("accountNumber")
                or ""
            )
            if va_number:
                session = (
                    VirtualAccountSession.objects.filter(
                        account_number=va_number,
                        status=VirtualAccountSession.Status.PENDING,
                    )
                    .select_related("payment__dev")
                    .first()
                )

                if session:
                    session.status = VirtualAccountSession.Status.RECEIVED
                    session.save()

                    payment = session.payment
                    if payment.status == Payment.Status.PENDING:
                        payment.status = Payment.Status.SUCCESS
                        payment.nomba_response = payload
                        payment.save()
                        transfer = payout_to_dev(payment)
                        if transfer.status == TransferLog.Status.FAILED:
                            payment.status = Payment.Status.FAILED
                            payment.save()
                            log.error(
                                "Virtual account payout FAILED for payment=%s - requires manual refund via Nomba dashboard",
                                payment.payment_ref,
                            )
                        log.info(
                            "Transfer payout: payment=%s transfer=%s status=%s",
                            payment.payment_ref,
                            transfer.merchant_tx_ref,
                            transfer.status,
                        )

        WebhookEvent.objects.filter(request_id=request_id).update(processed=True)
        return Response({"received": True})
