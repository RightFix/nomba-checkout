"""
Payout service — called synchronously from the webhook handler.

After a customer payment lands in my Nomba account the full amount is
forwarded to the dev's bank account immediately. Every attempt is
recorded in TransferLog regardless of outcome so nothing is silently lost.
"""
from __future__ import annotations

import logging
import uuid

from nomba import NombaAPIError

from checkout.models import Payment, TransferLog
from services.nomba import get_client

log = logging.getLogger(__name__)


def payout_to_dev(payment: Payment) -> TransferLog:
    """
    Transfer the full payment amount from my Nomba account to the dev's
    bank account. Returns the TransferLog record.

    Raises nothing — all errors are captured in TransferLog.status=failed
    so the webhook handler can still return 200 to Nomba (preventing
    Nomba from retrying a webhook that we already deduplicated).
    """
    dev = payment.dev
    merchant_tx_ref = f"payout-{payment.payment_ref}"

    # Guard: never double-pay. If a TransferLog already exists for this
    # payment (e.g. a second webhook delivery slipped past deduplication),
    # return the existing record without calling Nomba again.
    existing = TransferLog.objects.filter(payment=payment).first()
    if existing:
        log.warning("payout_to_dev: payment %s already has a TransferLog (%s) — skipping",
                    payment.payment_ref, existing.status)
        return existing

    nomba = get_client()
    nomba_response = {}
    error_msg = ""
    transfer_status = TransferLog.Status.FAILED

    try:
        result = nomba.transfers.perform_bank_account_transfer_the_parent_account(
            amount=str(payment.amount),
            account_number=dev.account_number,
            account_name=dev.account_name,
            bank_code=dev.bank_code,
            merchant_tx_ref=merchant_tx_ref,
            sender_name="Nomba Checkout Platform",
            narration=f"Payout for {payment.payment_ref}",
        )
        nomba_response = result.get("data", result)
        transfer_status = TransferLog.Status.SUCCESS
        log.info("Payout succeeded: payment=%s dev=%s amount=%s ref=%s",
                 payment.payment_ref, dev.id, payment.amount, merchant_tx_ref)

    except NombaAPIError as exc:
        error_msg = str(exc)
        nomba_response = exc.response_body or {}
        log.error("Payout FAILED: payment=%s dev=%s error=%s",
                  payment.payment_ref, dev.id, exc)

    transfer_log = TransferLog.objects.create(
        payment=payment,
        dev=dev,
        amount=payment.amount,
        merchant_tx_ref=merchant_tx_ref,
        status=transfer_status,
        nomba_response=nomba_response,
        error=error_msg,
    )

    if transfer_status == TransferLog.Status.SUCCESS:
        Payment.objects.filter(pk=payment.pk).update(
            status=Payment.Status.TRANSFERRED
        )

    return transfer_log
