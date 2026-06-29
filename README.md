# Nomba Checkout - Bubble Plugin

A drop-in payment element for Bubble apps that enables developers to accept payments via Nomba without writing backend code. Handles card payments (with OTP/3DS), bank transfers via virtual accounts, and automatic payouts to the developer's bank account.

## Architecture

```
┌─────────────────┐     ┌─────────────────────────────┐     ┌──────────────┐
│  Bubble App     │────▶│  Django Backend (this)     │────▶│  Nomba API  │
│  (customer)     │     │  - Payment initiation      │     │  - Card     │
│                 │     │  - Card/Transfer flow       │     │  - Transfer │
│  +nomba-checkout│     │  - Webhooks                 │     │  - Payout   │
│    plugin       │     │  - Payout to dev            │     │              │
└─────────────────┘     └─────────────────────────────┘     └──────────────┘
                                  │
                                  ▼
                         ┌──────────────────┐
                         │ Developer's Bank │
                         │ Account          │
                         └──────────────────┘
```

**Payment Flow:**
1. Customer initiates payment in Bubble app
2. Backend creates Payment record, forwards to Nomba
3. Customer completes OTP/3DS or bank transfer
4. Nomba webhook fires → Backend verifies → Payouts to dev
5. Full amount transferred to dev's bank account

## Features

- **Card Payments**: Full flow with OTP verification and 3DS authentication
- **Bank Transfers**: One-time virtual account per transaction
- **Saved Cards**: Returning customers pay in one tap
- **Auto-Payout**: Immediate transfer to developer's bank after payment
- **Webhook Security**: HMAC signature verification + replay protection
- **Audit Trail**: All transactions logged for compliance

## Tech Stack

- **Backend**: Django 5.0 + Django REST Framework
- **Database**: PostgreSQL (Render) / SQLite (local)
- **Payment Processor**: Nomba API
- **Frontend**: JavaScript (Bubble plugin)

## Quick Start

### 1. Deploy Backend to Render

See [Deployment Guide](#deployment) below.

### 2. Install Bubble Plugin

1. Go to your Bubble app's plugin editor
2. Create a new plugin
3. Copy contents of `bubble_plugin/plugin.js` into **Server-Side Actions**
4. Copy contents of `bubble_plugin/element.js` into **Element Initialize** and **Element Update**
5. Set plugin keys:
   - `backend_url`: Your Render URL (e.g., `https://nomba-checkout.onrender.com`)
   - `plugin_secret`: Value of `PLUGIN_API_SECRET` env var
   - `dev_id`: Your dev UUID (see step 3)

### 3. Register as Developer

In your Bubble app:
1. Add a bank dropdown (populate from `get_banks` action)
2. User enters account number → call `lookup_account`
3. Confirm account name → call `register_dev`
4. Save returned `dev_id` as plugin key

### 4. Accept Payments

Add the `nomba-checkout` element to your page:
- Set `amount`, `payment_ref`, `customer_email`
- Listen for `payment_success` / `payment_failed` events

## API Endpoints

### Developer Setup

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/banks/` | GET | List Nigerian banks |
| `/api/dev/lookup/` | POST | Look up bank account name |
| `/api/dev/register/` | POST | Register developer profile |

### Payments

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/payment/initiate/` | POST | Start payment session |
| `/api/payment/saved-cards/` | GET | Get saved cards for customer |
| `/api/payment/<payment_ref>/` | GET | Check payment status |

### Card Flow

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/card/submit/` | POST | Submit card details |
| `/api/card/otp/` | POST | Submit OTP |
| `/api/card/otp/resend/` | POST | Resend OTP |
| `/api/card/tokenized/` | POST | Pay with saved card |

### Bank Transfer

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/transfer/virtual-account/` | POST | Create virtual account |

### Webhooks

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/webhooks/nomba/` | POST | Nomba webhook handler |

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SECRET_KEY` | Yes | Django secret key |
| `DEBUG` | Yes | Set to `False` in production |
| `ALLOWED_HOSTS` | Yes | Comma-separated hostnames |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `NOMBA_CLIENT_ID` | Yes | Your Nomba client ID |
| `NOMBA_CLIENT_SECRET` | Yes | Your Nomba client secret |
| `NOMBA_ACCOUNT_ID` | Yes | Your Nomba account ID |
| `NOMBA_SANDBOX` | Yes | `True` for testing |
| `NOMBA_WEBHOOK_KEY` | Yes | Webhook verification key |
| `PLUGIN_API_SECRET` | Yes | Secret for Bubble plugin auth |

## Deployment

### Render (Recommended)

1. **Create PostgreSQL Database**:
   - Go to Render Dashboard → New → PostgreSQL
   - Note the connection string

2. **Deploy Backend**:
   - New → Web Service
   - Connect GitHub repo
   - Configure as per `render.yaml`
   - Add environment variables

3. **Configure Nomba Webhook**:
   - In Nomba dashboard, set webhook URL:
     ```
     https://your-app.onrender.com/api/webhooks/nomba/
     ```
   - Set webhook key to `NOMBA_WEBHOOK_KEY` value

### Local Development

```bash
# Clone and setup
git clone https://github.com/RightFix/nomba-checkout.git
cd nomba-checkout

# Create virtual environment
python -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Setup environment
cp .env.example .env
# Edit .env with your values

# Run migrations
python manage.py migrate

# Start server
python manage.py runserver
```

## Project Structure

```
nomba-checkout/
├── config/
│   ├── settings.py      # Django settings
│   ├── urls.py           # URL routing
│   └── wsgi.py           # WSGI entry point
├── checkout/
│   ├── models.py         # Database models
│   ├── views.py         # API views
│   ├── serializers.py   # DRF serializers
│   ├── permissions.py   # Custom permissions
│   └── urls.py          # App URL routing
├── services/
│   ├── nomba.py         # Nomba SDK wrapper
│   ├── payout.py       # Payout to devs
│   └── banks.py        # Bank list
├── bubble_plugin/
│   ├── plugin.js       # Bubble server-side actions
│   └── element.js      # Checkout UI element
├── manage.py
└── requirements.txt
```

## Security Considerations

- **Plugin Secret**: All Bubble plugin requests authenticated via `X-Plugin-Secret` header
- **Webhook Verification**: HMAC signature validation with replay protection (5-minute window)
- **Payout Idempotency**: TransferLog prevents double-payouts
- **CORS**: Restricted to Bubble domains in production
- **HTTPS**: Forced in production via HSTS headers

## License

MIT License - See LICENSE file for details.

## Support

For issues, please open a GitHub issue at https://github.com/RightFix/nomba-checkout/issues