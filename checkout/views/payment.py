from __future__ import annotations

import logging

from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from checkout.models import Payment, SavedCard
from checkout.serializers import (
    InitiatePaymentSerializer,
    PaymentStatusSerializer,
    SavedCardSerializer,
)

log = logging.getLogger(__name__)


class InitiatePaymentView(APIView):
    """
    POST /api/payment/initiate/

    First call on every checkout. Creates a Payment record that ties the
    customer, the dev, and the amount together. Returns the payment_ref
    that every subsequent card/transfer call needs.
    """
    # permission_classes = [IsPluginRequest]

    def post(self, request: Request) -> Response:
        ser = InitiatePaymentSerializer(data=request.data)
        if not ser.is_valid():
            return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)

        data = ser.validated_data

        payment, created = Payment.objects.get_or_create(
            defaults={
                "dev":            data["dev_id"],
                "amount":         data["amount"],
                "currency":       data["currency"],
                "customer_email": data["customer_email"],
                "customer_name":  data["customer_name"],
                "method":         data["method"],
                "status":         Payment.Status.PENDING,
            },
        )

        return Response(
            PaymentStatusSerializer(payment).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class PaymentStatusView(APIView):
    """
    GET /api/payment/<payment_ref>/
    Poll payment status. The Bubble plugin calls this after card/transfer
    to show the customer success or failure.
    """

    def get(self, request: Request, payment_ref: str) -> Response:
        try:
            payment = Payment.objects.get(
                payment_ref=payment_ref
            )
        except Payment.DoesNotExist:
            return Response(
                {"error": f"Payment '{payment_ref}' not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(PaymentStatusSerializer(payment).data)


class SavedCardsView(APIView):
    """
    GET /api/payment/saved-cards/?dev_id=<uuid>&customer_email=<email>
    Returns any tokenised card for this customer + dev combination.
    Called at checkout open to show "use saved card?" prompt.
    """

    def get(self, request: Request) -> Response:
        dev_id         = request.query_params.get("dev_id")
        customer_email = request.query_params.get("customer_email")

        if not dev_id or not customer_email:
            return Response(
                {"error": "dev_id and customer_email are required query params."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        cards = SavedCard.objects.filter(
            dev_id=dev_id,
            customer_email=customer_email,
        )
        return Response(SavedCardSerializer(cards, many=True).data)
