"""
Nigerian bank list. Used to populate the bank selection dropdown in the
Bubble plugin during dev registration.

The /api/banks/ endpoint serves this list, falling back to the hardcoded
list below if the Nomba API is unavailable.
"""
from __future__ import annotations

import logging
from functools import lru_cache

log = logging.getLogger(__name__)

BANKS: list[dict] = [
    {"name": "Access Bank",               "code": "044"},
    {"name": "Citibank Nigeria",          "code": "023"},
    {"name": "Ecobank Nigeria",           "code": "050"},
    {"name": "Fidelity Bank",             "code": "070"},
    {"name": "First Bank of Nigeria",     "code": "011"},
    {"name": "First City Monument Bank",  "code": "214"},
    {"name": "Globus Bank",               "code": "00103"},
    {"name": "Guaranty Trust Bank",       "code": "058"},
    {"name": "Heritage Bank",             "code": "030"},
    {"name": "Keystone Bank",             "code": "082"},
    {"name": "Kuda Bank",                 "code": "090267"},
    {"name": "Opay",                      "code": "100004"},
    {"name": "Palmpay",                   "code": "100033"},
    {"name": "Polaris Bank",              "code": "076"},
    {"name": "Providus Bank",             "code": "101"},
    {"name": "Stanbic IBTC Bank",         "code": "221"},
    {"name": "Standard Chartered Bank",   "code": "068"},
    {"name": "Sterling Bank",             "code": "232"},
    {"name": "SunTrust Bank",             "code": "100"},
    {"name": "Titan Trust Bank",          "code": "102"},
    {"name": "Union Bank of Nigeria",     "code": "032"},
    {"name": "United Bank for Africa",    "code": "033"},
    {"name": "Unity Bank",                "code": "215"},
    {"name": "VFD Microfinance Bank",     "code": "090110"},
    {"name": "Wema Bank",                 "code": "035"},
    {"name": "Zenith Bank",               "code": "057"},
]


@lru_cache(maxsize=1)
def get_banks() -> list[dict]:
    """
    Try to fetch the live bank list from Nomba. Falls back to the hardcoded
    list above if the API call fails. Result is cached for the process lifetime.
    """
    try:
        from services.nomba import get_client
        nomba = get_client()
        result = nomba.transfers.fetch_bank_codes_and_names()
        banks_data = result.get("data", {})
        # Nomba returns banks nested differently; adapt as needed
        if isinstance(banks_data, list) and banks_data:
            return [
                {"name": b.get("bankName", b.get("name", "")),
                 "code": b.get("bankCode", b.get("code", ""))}
                for b in banks_data
                if b.get("bankCode") or b.get("code")
            ]
    except Exception as exc:
        log.warning("Could not fetch banks from Nomba, using hardcoded list: %s", exc)

    return BANKS
