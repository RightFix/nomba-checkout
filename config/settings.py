from pathlib import Path
import dj_database_url
from decouple import config, Csv

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY   = config("SECRET_KEY")
DEBUG        = config("DEBUG", default=False, cast=bool)
ALLOWED_HOSTS = config("ALLOWED_HOSTS", default="*", cast=Csv())

INSTALLED_APPS = [
    "django.contrib.contenttypes",
    "django.contrib.auth",
    "corsheaders",
    "rest_framework",
    "checkout",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF      = "config.urls"
WSGI_APPLICATION  = "config.wsgi.application"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
LANGUAGE_CODE     = "en-us"
TIME_ZONE         = "UTC"
USE_TZ            = True

DATABASES = {
    "default": dj_database_url.config(
        default=f"sqlite:///{BASE_DIR / 'db.sqlite3'}",
        conn_max_age=600,
        conn_health_checks=True,
    )
}

# ── My Nomba credentials (all customer money flows through my account) ────────
NOMBA_CLIENT_ID     = config("NOMBA_CLIENT_ID")
NOMBA_CLIENT_SECRET = config("NOMBA_CLIENT_SECRET")
NOMBA_ACCOUNT_ID    = config("NOMBA_ACCOUNT_ID")
NOMBA_SANDBOX       = config("NOMBA_SANDBOX", default=True, cast=bool)
NOMBA_WEBHOOK_KEY   = config("NOMBA_WEBHOOK_KEY", default="")

# ── Secret the Bubble plugin uses to call my backend ─────────────────────────
# This is MY secret. Every dev's plugin uses the same backend URL + this key.
# The dev is identified by their dev_id (UUID), not by a separate secret.
PLUGIN_API_SECRET = config("PLUGIN_API_SECRET")

# ── CORS — Bubble's domains ───────────────────────────────────────────────────
CORS_ALLOWED_ORIGIN_REGEXES = [
    r"^https://.*\.bubbleapps\.io$",
    r"^https://.*\.bubble\.io$",
]
CORS_ALLOW_ALL_ORIGINS = config("CORS_ALLOW_ALL", default=False, cast=bool)

# ── Security ──────────────────────────────────────────────────────────────────
SECURE_SSL_REDIRECT            = not DEBUG
SECURE_HSTS_SECONDS            = 31536000 if not DEBUG else 0
SECURE_HSTS_INCLUDE_SUBDOMAINS = not DEBUG
SECURE_HSTS_PRELOAD            = not DEBUG
SECURE_PROXY_SSL_HEADER        = ("HTTP_X_FORWARDED_PROTO", "https")

# ── DRF ──────────────────────────────────────────────────────────────────────
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [],
    "DEFAULT_PERMISSION_CLASSES":     [],
    "DEFAULT_RENDERER_CLASSES":       ["rest_framework.renderers.JSONRenderer"],
    "DEFAULT_THROTTLE_CLASSES":       ["rest_framework.throttling.AnonRateThrottle"],
    "DEFAULT_THROTTLE_RATES":         {"anon": "60/minute"},
}
