from __future__ import annotations

import logging

from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from nomba import NombaAPIError
from nomba.flows import CardPaymentFlow

from checkout.models import Payment, SavedCard, TransferLog
from checkout.permissions import IsPluginRequest
from checkout.serializers import (
    SubmitCardSerializer,
    SubmitOTPSerializer,
    TokenizedCardPaySerializer,
)
from services.nomba import get_client
from services.payout import payout_to_dev, refund_customer

log = logging.getLogger(__name__)


def _nomba_err(exc: NombaAPIError) -> Response:
    return Response(
        {"error": str(exc), "code": exc.code},
        status=status.HTTP_502_BAD_GATEWAY,
    )


class CardSubmitView(APIView):
    """
    POST /api/card/submit/
    Submit encrypted card details. Returns requires_otp / requires_3ds flags.
    If payment completes immediately (responseCode 00), triggers payout to dev.
    """

    permission_classes = [IsPluginRequest]

    def post(self, request: Request) -> Response:
        ser = SubmitCardSerializer(data=request.data)
        if not ser.is_valid():
            return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)

        data = ser.validated_data

        try:
            payment = Payment.objects.select_related("dev").get(
                payment_ref=data["payment_ref"]
            )
        except Payment.DoesNotExist:
            return Response(
                {"error": "Payment not found. Call /api/payment/initiate/ first."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if payment.status not in (Payment.Status.PENDING,):
            return Response(
                {"error": f"Payment is already {payment.status}."},
                status=status.HTTP_409_CONFLICT,
            )

        nomba = get_client()
        flow = CardPaymentFlow(nomba.charge, order_reference=payment.payment_ref)

        try:
            step = flow.submit_card(
                card_details=data["card_details"],
                key=data["key"],
                save_card=data["save_card"],
            )
        except NombaAPIError as exc:
            log.error("card submit failed payment=%s: %s", payment.payment_ref, exc)
            return _nomba_err(exc)

        # Persist transaction_id so OTP step can resume the flow
        if step.transaction_id:
            payment.transaction_id = step.transaction_id
            payment.method = Payment.Method.CARD

        if step.completed:
            payment.status = Payment.Status.SUCCESS
            payment.nomba_response = step.raw
            payment.save()
            _handle_payout_and_tokenize(payment, step, data["save_card"])
        else:
            payment.save()

        return Response(
            {
                "payment_ref": payment.payment_ref,
                "transaction_id": step.transaction_id,
                "requires_otp": step.requires_otp,
                "requires_3ds": step.requires_3ds,
                "secure_auth_url": (step.secure_authentication_data or {}).get(
                    "redirectUrl"
                ),
                "completed": step.completed,
                "message": step.message,
            }
        )


class CardOTPView(APIView):
    """POST /api/card/otp/"""

    permission_classes = [IsPluginRequest]

    def post(self, request: Request) -> Response:
        ser = SubmitOTPSerializer(data=request.data)
        if not ser.is_valid():
            return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)

        data = ser.validated_data

        try:
            payment = Payment.objects.select_related("dev").get(
                payment_ref=data["payment_ref"]
            )
        except Payment.DoesNotExist:
            return Response(
                {"error": "Payment not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        nomba = get_client()
        flow = CardPaymentFlow(nomba.charge, order_reference=payment.payment_ref)
        flow.transaction_id = payment.transaction_id or None

        try:
            step = flow.submit_otp(data["otp"])
        except ValueError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except NombaAPIError as exc:
            log.error("OTP submit failed payment=%s: %s", payment.payment_ref, exc)
            return _nomba_err(exc)

        if step.completed:
            payment.status = Payment.Status.SUCCESS
            payment.nomba_response = step.raw
            payment.save()
            _handle_payout_and_tokenize(payment, step, save_card=False)

        return Response(
            {
                "payment_ref": payment.payment_ref,
                "completed": step.completed,
                "message": step.message,
            }
        )


class CardOTPResendView(APIView):
    """POST /api/card/otp/resend/"""

    permission_classes = [IsPluginRequest]

    def post(self, request: Request) -> Response:
        payment_ref = request.data.get("payment_ref")
        if not payment_ref:
            return Response(
                {"error": "payment_ref is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        nomba = get_client()
        try:
            result = nomba.charge.resend_customer_payment_otp(
                order_reference=payment_ref
            )
        except NombaAPIError as exc:
            return _nomba_err(exc)

        return Response({"payment_ref": payment_ref, "nomba": result})


class TokenizedCardPayView(APIView):
    """
    POST /api/card/tokenized/
    Charge a returning customer's saved card in one step — no need to
    re-enter card details. Customer still sees a confirmation before charge.
    """

    permission_classes = [IsPluginRequest]

    def post(self, request: Request) -> Response:
        ser = TokenizedCardPaySerializer(data=request.data)
        if not ser.is_valid():
            return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)

        data = ser.validated_data

        try:
            payment = Payment.objects.select_related("dev").get(
                payment_ref=data["payment_ref"]
            )
        except Payment.DoesNotExist:
            return Response(
                {"error": "Payment not found. Call /api/payment/initiate/ first."},
                status=status.HTTP_404_NOT_FOUND,
            )

        try:
            saved = SavedCard.objects.get(
                dev_id=data["dev_id"],
                customer_email=data["customer_email"],
            )
        except SavedCard.DoesNotExist:
            return Response(
                {"error": "No saved card found for this customer and dev."},
                status=status.HTTP_404_NOT_FOUND,
            )

        nomba = get_client()
        try:
            result = nomba.checkout.charge_customer_with_tokenized_card_data(
                token_key=saved.card_token,
                order={"orderReference": payment.payment_ref},
            )
            result_data = result.get("data", result)
            response_code = result_data.get("responseCode", "")
            transaction_id = result_data.get("transactionId", "")

            if response_code == "00":
                payment.status = Payment.Status.SUCCESS
                payment.transaction_id = transaction_id
                payment.method = Payment.Method.CARD
                payment.nomba_response = result_data
                payment.save()
                payout_to_dev(payment)
                return Response({"payment_ref": payment.payment_ref, "completed": True})

            return Response(
                {
                    "payment_ref": payment.payment_ref,
                    "completed": False,
                    "response_code": response_code,
                    "message": result_data.get("message", ""),
                }
            )

        except NombaAPIError as exc:
            log.error("Tokenized pay failed payment=%s: %s", payment.payment_ref, exc)
            return _nomba_err(exc)


# ── internal helper ───────────────────────────────────────────────────────────


def _handle_payout_and_tokenize(payment: Payment, step, save_card: bool) -> None:
    """
    Called after a card payment completes. Triggers the payout to the dev
    and optionally saves the card token for future one-click payments.
    If payout fails, refunds the customer.
    """
    transfer = payout_to_dev(payment)

    if transfer.status == TransferLog.Status.FAILED:
        refund_result = refund_customer(payment)
        if refund_result.get("success"):
            payment.status = Payment.Status.REFUNDED
        else:
            payment.status = Payment.Status.FAILED
        payment.save()
        return

    if save_card:
        raw = step.raw or {}
        data = raw.get("data", raw)
        card_token = data.get("cardToken") or data.get("token")
        card_last4 = data.get("cardLast4") or data.get("last4") or ""
        card_type = data.get("cardType") or data.get("scheme") or ""

        if card_token:
            SavedCard.objects.update_or_create(
                dev=payment.dev,
                customer_email=payment.customer_email,
                defaults={
                    "card_token": card_token,
                    "card_last4": str(card_last4)[-4:],
                    "card_type": card_type,
                },
            )
