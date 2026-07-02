from __future__ import annotations

import logging
import uuid

from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from nomba import NombaAPIError

from checkout.models import Payment, VirtualAccountSession
from checkout.serializers import VirtualAccountSerializer
from services.nomba import get_client

log = logging.getLogger(__name__)


class CreateVirtualAccountView(APIView):
    """
    POST /api/transfer/virtual-account/

    Creates a one-time virtual account for this payment. The customer
    sends the exact amount to this account. When money arrives, Nomba
    fires a webhook → our handler forwards it to the dev.

    Calling this twice for the same payment_ref returns the existing
    virtual account (idempotent).
    """

    def post(self, request: Request) -> Response:
        payment_ref = request.data.get("payment_ref")
        if not payment_ref:
            return Response(
                {"error": "payment_ref is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            payment = Payment.objects.get(
                payment_ref=payment_ref
            )
        except Payment.DoesNotExist:
            return Response(
                {"error": "Payment not found. Call /api/payment/initiate/ first."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Idempotent — return existing virtual account if already created
        existing = VirtualAccountSession.objects.filter(payment=payment).first()
        if existing:
            return Response(VirtualAccountSerializer(existing).data)

        nomba       = get_client()
        account_ref = f"va-{payment_ref}-{uuid.uuid4().hex[:8]}"

        try:
            result = nomba.virtual_accounts.create_virtual_account(
                account_ref=account_ref,
                account_name=f"{payment.customer_name or payment.customer_email}",
                callback_url="",   # webhook handles completion
            )
            va_data = result.get("data", result)
        except NombaAPIError as exc:
            log.error("Virtual account creation failed payment=%s: %s", payment_ref, exc)
            return Response(
                {"error": "Could not create virtual account. Please try again."},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        # Update payment method
        payment.method = Payment.Method.TRANSFER
        payment.save(update_fields=["method"])

        session = VirtualAccountSession.objects.create(
            payment=payment,
            account_number=va_data.get("accountNumber", ""),
            account_name=va_data.get("accountName", ""),
            bank_name=va_data.get("bankName", ""),
            account_ref=account_ref,
        )

        return Response(
            VirtualAccountSerializer(session).data,
            status=status.HTTP_201_CREATED,
        )
