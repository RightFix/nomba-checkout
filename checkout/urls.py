from django.urls import path
from checkout.views.dev      import BankListView, DevLookupView, DevRegisterView
from checkout.views.payment  import InitiatePaymentView, PaymentStatusView, SavedCardsView
from checkout.views.card     import (
    CardSubmitView, CardOTPView, CardOTPResendView, TokenizedCardPayView
)
from checkout.views.transfer import CreateVirtualAccountView
from checkout.views.webhook  import NombaWebhookView

urlpatterns = [
    # ── Dev setup (called from Bubble plugin editor, one-time) ───────────────
    path("banks/",                  BankListView.as_view(),          name="bank-list"),
    path("dev/lookup/",             DevLookupView.as_view(),         name="dev-lookup"),
    path("dev/register/",           DevRegisterView.as_view(),       name="dev-register"),

    # ── Customer checkout (called at runtime from dev's Bubble app) ──────────
    path("payment/initiate/",       InitiatePaymentView.as_view(),   name="payment-initiate"),
    path("payment/saved-cards/",    SavedCardsView.as_view(),        name="saved-cards"),
    path("payment/<str:payment_ref>/", PaymentStatusView.as_view(),  name="payment-status"),

    # Card flow
    path("card/submit/",            CardSubmitView.as_view(),        name="card-submit"),
    path("card/otp/",               CardOTPView.as_view(),           name="card-otp"),
    path("card/otp/resend/",        CardOTPResendView.as_view(),     name="card-otp-resend"),
    path("card/tokenized/",         TokenizedCardPayView.as_view(),  name="card-tokenized"),

    # Transfer flow
    path("transfer/virtual-account/", CreateVirtualAccountView.as_view(), name="virtual-account"),

    # Webhook (Nomba calls this directly, no plugin secret)
    path("webhooks/nomba/",         NombaWebhookView.as_view(),      name="nomba-webhook"),
]
