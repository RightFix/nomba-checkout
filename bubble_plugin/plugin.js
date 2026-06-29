// ============================================================
// Nomba Checkout — Bubble Plugin
// ============================================================
// Plugin settings (set by the dev in their Bubble editor):
//   backend_url     — e.g. "https://your-app.onrender.com"
//   plugin_secret   — must match PLUGIN_API_SECRET on your backend
//   dev_id          — the dev's UUID (set after registration)
//
// Actions (wire these into your Bubble workflows):
//   1.  get_banks              — populate bank dropdown during dev setup
//   2.  lookup_account         — show account name for confirmation
//   3.  register_dev           — create dev profile, returns dev_id
//   4.  initiate_payment       — start a checkout session
//   5.  get_saved_cards        — check for returning customer's saved card
//   6.  submit_card            — submit encrypted card details
//   7.  submit_otp             — submit OTP after card
//   8.  resend_otp             — resend OTP
//   9.  pay_with_saved_card    — one-click charge for returning customer
//   10. create_virtual_account — generate transfer account number
//   11. check_payment_status   — poll payment result
// ============================================================

// ── shared helpers ────────────────────────────────────────────────────────────

function _base(context) {
  return {
    url:    (context.keys["backend_url"] || "").replace(/\/$/, ""),
    secret: context.keys["plugin_secret"] || "",
    devId:  context.keys["dev_id"] || "",
  };
}

async function _post(path, body, context) {
  const { url, secret } = _base(context);
  const res = await fetch(`${url}/api/${path}`, {
    method: "POST",
    headers: {
      "Content-Type":   "application/json",
      "X-Plugin-Secret": secret,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

async function _get(path, params, context) {
  const { url, secret } = _base(context);
  const qs  = params ? "?" + new URLSearchParams(params).toString() : "";
  const res = await fetch(`${url}/api/${path}${qs}`, {
    headers: { "X-Plugin-Secret": secret },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}


// ── 1. Get bank list ──────────────────────────────────────────────────────────
// No inputs.
// Outputs:
//   banks (list of {name, code}) — bind to a dropdown's option list

function action_get_banks(properties, context) {
  context.async(async (resolve) => {
    try {
      const { url } = _base(context);
      const res  = await fetch(`${url}/api/banks/`);
      const data = await res.json();
      resolve({ banks: data, error: "" });
    } catch (err) {
      resolve({ banks: [], error: err.message });
    }
  });
}


// ── 2. Look up account name ───────────────────────────────────────────────────
// Inputs:
//   account_number (text)
//   bank_code      (text)  — from the bank dropdown value
// Outputs:
//   account_name   (text)  — show this to the dev for confirmation
//   error          (text)

function action_lookup_account(properties, context) {
  context.async(async (resolve) => {
    try {
      const result = await _post("dev/lookup/", {
        account_number: properties.account_number,
        bank_code:      properties.bank_code,
      }, context);
      resolve({ account_name: result.account_name, error: "" });
    } catch (err) {
      resolve({ account_name: "", error: err.message });
    }
  });
}


// ── 3. Register dev ───────────────────────────────────────────────────────────
// Called after the dev confirms their account name.
// Inputs:
//   account_number (text)
//   account_name   (text)  — confirmed name from action_lookup_account
//   bank_code      (text)
//   bank_name      (text)
// Outputs:
//   dev_id  (text)  — save this to Bubble App Data, set as plugin key "dev_id"
//   error   (text)

function action_register_dev(properties, context) {
  context.async(async (resolve) => {
    try {
      const result = await _post("dev/register/", {
        account_number: properties.account_number,
        account_name:   properties.account_name,
        bank_code:      properties.bank_code,
        bank_name:      properties.bank_name,
      }, context);
      resolve({ dev_id: result.id, error: "" });
    } catch (err) {
      resolve({ dev_id: "", error: err.message });
    }
  });
}


// ── 4. Initiate payment ───────────────────────────────────────────────────────
// First call on every checkout. Call this before showing the card form
// or transfer screen. Amount must already be known.
// Inputs:
//   payment_ref    (text)   unique per transaction — use Bubble's "Create unique ID"
//   amount         (number)
//   customer_email (text)
//   customer_name  (text)
//   method         (text)   "card" or "transfer"
//   currency       (text)   default "NGN"
// Outputs:
//   payment_ref    (text)
//   status         (text)
//   error          (text)

function action_initiate_payment(properties, context) {
  context.async(async (resolve) => {
    try {
      const { devId } = _base(context);
      const result = await _post("payment/initiate/", {
        dev_id:         devId,
        payment_ref:    properties.payment_ref,
        amount:         properties.amount,
        customer_email: properties.customer_email,
        customer_name:  properties.customer_name || "",
        method:         properties.method,
        currency:       properties.currency || "NGN",
      }, context);
      resolve({ payment_ref: result.payment_ref, status: result.status, error: "" });
    } catch (err) {
      resolve({ payment_ref: "", status: "", error: err.message });
    }
  });
}


// ── 5. Get saved cards ────────────────────────────────────────────────────────
// Check if this customer has a saved card for this dev's app.
// Call this when the checkout page loads to decide whether to show
// "Use saved card?" or go straight to the card form.
// Inputs:
//   customer_email (text)
// Outputs:
//   has_saved_card  (yes/no)
//   card_last4      (text)
//   card_type       (text)
//   saved_card_id   (text)
//   error           (text)

function action_get_saved_cards(properties, context) {
  context.async(async (resolve) => {
    try {
      const { devId } = _base(context);
      const cards = await _get("payment/saved-cards/", {
        dev_id:         devId,
        customer_email: properties.customer_email,
      }, context);

      const card = cards[0] || null;
      resolve({
        has_saved_card: !!card,
        card_last4:     card ? card.card_last4  : "",
        card_type:      card ? card.card_type   : "",
        saved_card_id:  card ? card.id          : "",
        error:          "",
      });
    } catch (err) {
      resolve({ has_saved_card: false, card_last4: "", card_type: "", saved_card_id: "", error: err.message });
    }
  });
}


// ── 6. Submit card ────────────────────────────────────────────────────────────
// Inputs:
//   payment_ref  (text)
//   card_details (text)   — Nomba-encrypted card blob
//   key          (text)   — encryption key (usually empty)
//   save_card    (yes/no) — offer "Save card for next time?"
// Outputs:
//   requires_otp    (yes/no)
//   requires_3ds    (yes/no)
//   secure_auth_url (text)   — redirect here if requires_3ds
//   transaction_id  (text)
//   completed       (yes/no)
//   message         (text)
//   error           (text)

function action_submit_card(properties, context) {
  context.async(async (resolve) => {
    try {
      const result = await _post("card/submit/", {
        payment_ref:  properties.payment_ref,
        card_details: properties.card_details,
        key:          properties.key || "",
        save_card:    properties.save_card || false,
      }, context);
      resolve({
        requires_otp:    result.requires_otp,
        requires_3ds:    result.requires_3ds,
        secure_auth_url: result.secure_auth_url || "",
        transaction_id:  result.transaction_id  || "",
        completed:       result.completed,
        message:         result.message || "",
        error:           "",
      });
    } catch (err) {
      resolve({
        requires_otp: false, requires_3ds: false,
        secure_auth_url: "", transaction_id: "",
        completed: false, message: "", error: err.message,
      });
    }
  });
}


// ── 7. Submit OTP ─────────────────────────────────────────────────────────────
// Inputs:
//   payment_ref (text)
//   otp         (text)
// Outputs:
//   completed (yes/no)
//   message   (text)
//   error     (text)

function action_submit_otp(properties, context) {
  context.async(async (resolve) => {
    try {
      const result = await _post("card/otp/", {
        payment_ref: properties.payment_ref,
        otp:         properties.otp,
      }, context);
      resolve({ completed: result.completed, message: result.message || "", error: "" });
    } catch (err) {
      resolve({ completed: false, message: "", error: err.message });
    }
  });
}


// ── 8. Resend OTP ─────────────────────────────────────────────────────────────
// Inputs:
//   payment_ref (text)
// Outputs:
//   success (yes/no)
//   error   (text)

function action_resend_otp(properties, context) {
  context.async(async (resolve) => {
    try {
      await _post("card/otp/resend/", { payment_ref: properties.payment_ref }, context);
      resolve({ success: true, error: "" });
    } catch (err) {
      resolve({ success: false, error: err.message });
    }
  });
}


// ── 9. Pay with saved card ────────────────────────────────────────────────────
// One-click charge for a returning customer who chose "Use saved card".
// Show a confirmation screen before calling this.
// Inputs:
//   payment_ref    (text)
//   customer_email (text)
// Outputs:
//   completed (yes/no)
//   error     (text)

function action_pay_with_saved_card(properties, context) {
  context.async(async (resolve) => {
    try {
      const { devId } = _base(context);
      const result = await _post("card/tokenized/", {
        payment_ref:    properties.payment_ref,
        dev_id:         devId,
        customer_email: properties.customer_email,
      }, context);
      resolve({ completed: result.completed, error: "" });
    } catch (err) {
      resolve({ completed: false, error: err.message });
    }
  });
}


// ── 10. Create virtual account ────────────────────────────────────────────────
// Creates a one-time account number the customer sends money to.
// Call this when the customer selects "Transfer" as payment method.
// Inputs:
//   payment_ref (text)
// Outputs:
//   account_number (text)   — show this to the customer
//   account_name   (text)
//   bank_name      (text)
//   amount         (number) — remind the customer of the exact amount
//   error          (text)

function action_create_virtual_account(properties, context) {
  context.async(async (resolve) => {
    try {
      const result = await _post("transfer/virtual-account/", {
        payment_ref: properties.payment_ref,
      }, context);
      resolve({
        account_number: result.account_number,
        account_name:   result.account_name,
        bank_name:      result.bank_name,
        amount:         result.amount,
        error:          "",
      });
    } catch (err) {
      resolve({ account_number: "", account_name: "", bank_name: "", amount: 0, error: err.message });
    }
  });
}


// ── 11. Check payment status ──────────────────────────────────────────────────
// Poll this after card/OTP completion or while waiting for a transfer.
// For transfers, poll every 5–10 seconds until status !== "pending".
// Inputs:
//   payment_ref (text)
// Outputs:
//   status  (text)   "pending" | "success" | "failed" | "transferred"
//   method  (text)   "card" | "transfer"
//   error   (text)

function action_check_payment_status(properties, context) {
  context.async(async (resolve) => {
    try {
      const result = await _get(
        `payment/${encodeURIComponent(properties.payment_ref)}/`,
        null,
        context
      );
      resolve({ status: result.status, method: result.method, error: "" });
    } catch (err) {
      resolve({ status: "", method: "", error: err.message });
    }
  });
}
