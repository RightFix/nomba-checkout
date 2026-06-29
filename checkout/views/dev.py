from __future__ import annotations

import logging

from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from nomba import NombaAPIError

from checkout.models import Dev
from checkout.permissions import IsPluginRequest
from checkout.serializers import DevLookupSerializer, DevRegisterSerializer, DevSerializer
from services.banks import get_banks
from services.nomba import get_client

log = logging.getLogger(__name__)


class BankListView(APIView):
    """
    GET /api/banks/
    Returns the list of Nigerian banks with codes for the dev
    registration dropdown. No auth required — this is public data.
    """
    permission_classes = []

    def get(self, request: Request) -> Response:
        return Response(get_banks())


class DevLookupView(APIView):
    """
    POST /api/dev/lookup/
    Look up an account name from Nomba before the dev confirms registration.
    The Bubble plugin calls this when the dev finishes typing their account number.
    """
    permission_classes = [IsPluginRequest]

    def post(self, request: Request) -> Response:
        ser = DevLookupSerializer(data=request.data)
        if not ser.is_valid():
            return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)

        data = ser.validated_data
        nomba = get_client()

        try:
            result = nomba.transfers.perform_bank_account_lookup(
                account_number=data["account_number"],
                bank_code=data["bank_code"],
            )
            lookup_data = result.get("data", result)
            account_name = (
                lookup_data.get("accountName")
                or lookup_data.get("account_name")
                or ""
            )
            if not account_name:
                return Response(
                    {"error": "Could not find an account with that number and bank."},
                    status=status.HTTP_404_NOT_FOUND,
                )
            return Response({
                "account_number": data["account_number"],
                "account_name":   account_name,
                "bank_code":      data["bank_code"],
            })
        except NombaAPIError as exc:
            log.error("Account lookup failed: %s", exc)
            return Response(
                {"error": "Account lookup failed. Check the account number and bank."},
                status=status.HTTP_502_BAD_GATEWAY,
            )


class DevRegisterView(APIView):
    """
    POST /api/dev/register/
    Create (or return existing) Dev profile after the dev confirms their
    account name. Returns dev_id which Bubble stores as a plugin setting.
    """
    permission_classes = [IsPluginRequest]

    def post(self, request: Request) -> Response:
        ser = DevRegisterSerializer(data=request.data)
        if not ser.is_valid():
            return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)

        data = ser.validated_data

        dev, created = Dev.objects.update_or_create(
            account_number=data["account_number"],
            defaults={
                "account_name": data["account_name"],
                "bank_code":    data["bank_code"],
                "bank_name":    data["bank_name"],
                "is_active":    True,
            },
        )

        return Response(
            DevSerializer(dev).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )
