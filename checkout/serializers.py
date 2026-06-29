from rest_framework import serializers
from .models import Dev, Payment, SavedCard, VirtualAccountSession


class DevLookupSerializer(serializers.Serializer):
    """Used to look up an account name before registration."""
    account_number = serializers.CharField(max_length=20)
    bank_code      = serializers.CharField(max_length=16)


class DevRegisterSerializer(serializers.Serializer):
    """Used to create a Dev profile after the dev confirms their account name."""
    account_number = serializers.CharField(max_length=20)
    account_name   = serializers.CharField(max_length=255)
    bank_code      = serializers.CharField(max_length=16)
    bank_name      = serializers.CharField(max_length=128)


class DevSerializer(serializers.ModelSerializer):
    class Meta:
        model = Dev
        fields = ["id", "account_number", "account_name", "bank_name", "created_at"]


class InitiatePaymentSerializer(serializers.Serializer):
    dev_id         = serializers.UUIDField()
    payment_ref    = serializers.CharField(max_length=128)
    amount         = serializers.DecimalField(max_digits=14, decimal_places=2)
    customer_email = serializers.EmailField()
    customer_name  = serializers.CharField(max_length=255, default="")
    method         = serializers.ChoiceField(choices=["card", "transfer"])
    currency       = serializers.CharField(max_length=8, default="NGN")


class SubmitCardSerializer(serializers.Serializer):
    payment_ref  = serializers.CharField(max_length=128)
    card_details = serializers.CharField()
    key          = serializers.CharField(default="")
    save_card    = serializers.BooleanField(default=False)


class TokenizedCardPaySerializer(serializers.Serializer):
    payment_ref    = serializers.CharField(max_length=128)
    dev_id         = serializers.UUIDField()
    customer_email = serializers.EmailField()


class SubmitOTPSerializer(serializers.Serializer):
    payment_ref = serializers.CharField(max_length=128)
    otp         = serializers.CharField(max_length=16)


class PaymentStatusSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = [
            "id", "payment_ref", "amount", "currency",
            "method", "status", "customer_email", "created_at", "updated_at",
        ]


class VirtualAccountSerializer(serializers.ModelSerializer):
    payment_ref = serializers.CharField(source="payment.payment_ref")
    amount      = serializers.DecimalField(source="payment.amount",
                                           max_digits=14, decimal_places=2)

    class Meta:
        model = VirtualAccountSession
        fields = [
            "account_number", "account_name", "bank_name",
            "payment_ref", "amount", "status",
        ]


class SavedCardSerializer(serializers.ModelSerializer):
    class Meta:
        model = SavedCard
        fields = ["id", "card_last4", "card_type", "created_at"]
