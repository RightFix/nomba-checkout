from __future__ import annotations

from functools import lru_cache
from nomba import Nomba


@lru_cache(maxsize=1)
def get_client() -> Nomba:
    """
    Single Nomba client for my platform account.
    All money flows through this one account:
      Customer → my Nomba account → dev's bank account
    """
    from django.conf import settings
    return Nomba(
        client_id=settings.NOMBA_CLIENT_ID,
        client_secret=settings.NOMBA_CLIENT_SECRET,
        account_id=settings.NOMBA_ACCOUNT_ID,
        sandbox=settings.NOMBA_SANDBOX,
    )
