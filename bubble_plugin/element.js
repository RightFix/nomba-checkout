// ============================================================
// Nomba Checkout - Bubble Plugin ELEMENT
// ============================================================
// Paste the initialize() content into the "Initialize" box
// and the update() content into the "Update" box in the
// Bubble plugin editor under the Element tab.
//
// Element Properties (define these in Bubble plugin editor):
//   amount         (number)   — payment amount in Naira
//   payment_ref    (text)     — unique ID per transaction
//   customer_email (text)
//   customer_name  (text)
//   currency       (text)     — default "NGN"
//
// Element States (define these in Bubble plugin editor):
//   payment_status (text)     — pending | success | failed | transferred
//   error_message  (text)
//
// Element Events (define these in Bubble plugin editor):
//   payment_success
//   payment_failed
//
// Plugin Keys (set by the dev in their plugin settings):
//   backend_url    — e.g. https://your-app.onrender.com
//   plugin_secret  — must match PLUGIN_API_SECRET on backend
//   dev_id         — the dev's UUID from registration
// ============================================================


// ── INITIALIZE ────────────────────────────────────────────────────────────────
// Paste everything inside this function into Bubble's Initialize box.

function initialize(instance, context) {

  // ── inject styles once ──────────────────────────────────────────────────────
  if (!document.getElementById("nc-styles")) {
    const style = document.createElement("style");
    style.id = "nc-styles";
    style.textContent = `
      .nc-wrap * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      .nc-wrap { width: 100%; background: #fff; border-radius: 16px; overflow: hidden; }

      /* screens */
      .nc-screen { display: none; padding: 24px; }
      .nc-screen.active { display: block; }

      /* header */
      .nc-header { text-align: center; margin-bottom: 24px; }
      .nc-header .nc-amount { font-size: 28px; font-weight: 700; color: #1A1A2E; letter-spacing: -0.5px; }
      .nc-header .nc-label  { font-size: 13px; color: #6B7280; margin-top: 2px; }

      /* method tabs */
      .nc-tabs { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 24px; }
      .nc-tab  { padding: 12px 8px; border: 2px solid #E5E7EB; border-radius: 10px;
                 text-align: center; cursor: pointer; transition: all .15s;
                 font-size: 14px; font-weight: 600; color: #6B7280; background: #fff; }
      .nc-tab:hover  { border-color: #0EA371; color: #0EA371; }
      .nc-tab.active { border-color: #0EA371; background: #F0FDF8; color: #0EA371; }
      .nc-tab .nc-tab-icon { font-size: 22px; display: block; margin-bottom: 4px; }

      /* form fields */
      .nc-field  { margin-bottom: 16px; }
      .nc-field label { display: block; font-size: 12px; font-weight: 600;
                        color: #374151; margin-bottom: 6px; letter-spacing: .04em;
                        text-transform: uppercase; }
      .nc-field input  { width: 100%; padding: 13px 14px; border: 1.5px solid #E5E7EB;
                         border-radius: 10px; font-size: 16px; color: #1A1A2E;
                         background: #FAFAFA; outline: none; transition: border-color .15s; }
      .nc-field input:focus { border-color: #0EA371; background: #fff; }
      .nc-field input.error { border-color: #DC2626; }
      .nc-field input::placeholder { color: #9CA3AF; }

      /* card row */
      .nc-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

      /* card type badge */
      .nc-card-row { position: relative; }
      .nc-card-brand { position: absolute; right: 14px; top: 50%; transform: translateY(-50%);
                       font-size: 11px; font-weight: 700; color: #6B7280;
                       background: #F3F4F6; padding: 2px 7px; border-radius: 4px; }

      /* checkbox */
      .nc-check { display: flex; align-items: center; gap: 10px; cursor: pointer;
                  font-size: 14px; color: #374151; margin-bottom: 20px; }
      .nc-check input[type=checkbox] { width: 18px; height: 18px; accent-color: #0EA371;
                                       cursor: pointer; flex-shrink: 0; }

      /* primary button */
      .nc-btn { width: 100%; padding: 15px; border: none; border-radius: 12px;
                background: #0EA371; color: #fff; font-size: 16px; font-weight: 700;
                cursor: pointer; transition: background .15s, transform .1s;
                display: flex; align-items: center; justify-content: center; gap: 8px; }
      .nc-btn:hover:not(:disabled)  { background: #0B8A5E; }
      .nc-btn:active:not(:disabled) { transform: scale(.98); }
      .nc-btn:disabled { background: #9CA3AF; cursor: not-allowed; }
      .nc-btn.nc-btn-ghost { background: transparent; color: #6B7280;
                             border: 1.5px solid #E5E7EB; margin-top: 10px; }
      .nc-btn.nc-btn-ghost:hover:not(:disabled) { border-color: #0EA371; color: #0EA371; background: transparent; }

      /* spinner */
      .nc-spinner { width: 20px; height: 20px; border: 2.5px solid rgba(255,255,255,.4);
                    border-top-color: #fff; border-radius: 50%; animation: nc-spin .7s linear infinite; }
      @keyframes nc-spin { to { transform: rotate(360deg); } }

      /* saved card pill */
      .nc-saved-card { border: 1.5px solid #0EA371; border-radius: 12px;
                       padding: 16px; margin-bottom: 16px; background: #F0FDF8; }
      .nc-saved-card .nc-sc-top { display: flex; align-items: center; gap: 12px; }
      .nc-saved-card .nc-sc-icon { font-size: 28px; }
      .nc-saved-card .nc-sc-info { flex: 1; }
      .nc-saved-card .nc-sc-name { font-size: 14px; font-weight: 600; color: #1A1A2E; }
      .nc-saved-card .nc-sc-num  { font-size: 13px; color: #6B7280; }

      /* virtual account box */
      .nc-va-box { background: #F0FDF8; border: 1.5px solid #0EA371;
                   border-radius: 12px; padding: 20px; margin-bottom: 20px; }
      .nc-va-row { display: flex; justify-content: space-between; align-items: center;
                   padding: 8px 0; border-bottom: 1px solid #D1FAE5; }
      .nc-va-row:last-child { border-bottom: none; }
      .nc-va-row .nc-va-k { font-size: 12px; color: #6B7280; font-weight: 500; }
      .nc-va-row .nc-va-v { font-size: 15px; font-weight: 700; color: #1A1A2E; }
      .nc-va-row .nc-va-copy { font-size: 12px; color: #0EA371; cursor: pointer;
                                font-weight: 600; padding: 2px 6px; }
      .nc-va-note { font-size: 13px; color: #6B7280; text-align: center; margin-bottom: 16px; }

      /* otp boxes */
      .nc-otp-wrap { display: flex; gap: 10px; justify-content: center; margin-bottom: 20px; }
      .nc-otp-inp  { width: 48px; height: 56px; border: 1.5px solid #E5E7EB;
                     border-radius: 10px; font-size: 22px; font-weight: 700;
                     text-align: center; color: #1A1A2E; background: #FAFAFA;
                     outline: none; transition: border-color .15s; }
      .nc-otp-inp:focus { border-color: #0EA371; background: #fff; }

      /* status screens */
      .nc-status-wrap { text-align: center; padding: 32px 24px; }
      .nc-status-icon { font-size: 56px; margin-bottom: 16px; }
      .nc-status-title { font-size: 20px; font-weight: 700; color: #1A1A2E; margin-bottom: 8px; }
      .nc-status-sub   { font-size: 14px; color: #6B7280; max-width: 260px; margin: 0 auto 24px; }

      /* polling bar */
      .nc-poll-bar { height: 3px; background: #E5E7EB; border-radius: 2px; overflow: hidden; margin-bottom: 20px; }
      .nc-poll-fill { height: 100%; background: #0EA371; border-radius: 2px;
                      animation: nc-poll 1.8s ease-in-out infinite; }
      @keyframes nc-poll { 0%{width:0%} 50%{width:80%} 100%{width:0%} }

      /* error bar */
      .nc-err { background: #FEF2F2; border: 1px solid #FECACA; border-radius: 8px;
                padding: 10px 14px; font-size: 13px; color: #DC2626;
                margin-bottom: 16px; display: none; }
      .nc-err.show { display: block; }

      /* 3DS iframe */
      .nc-3ds-frame { width: 100%; height: 420px; border: none; border-radius: 10px; }

      /* powered by */
      .nc-powered { text-align: center; font-size: 11px; color: #9CA3AF;
                    padding: 12px 0 4px; }
      .nc-powered span { color: #0EA371; font-weight: 600; }

      @media (max-width: 380px) {
        .nc-screen { padding: 18px; }
        .nc-otp-inp { width: 40px; height: 50px; font-size: 18px; }
        .nc-header .nc-amount { font-size: 24px; }
      }
    `;
    document.head.appendChild(style);
  }

  // ── build HTML skeleton ─────────────────────────────────────────────────────
  instance.canvas.html(`
    <div class="nc-wrap">

      <!-- METHOD SELECTION -->
      <div class="nc-screen active" id="nc-method">
        <div class="nc-header">
          <div class="nc-amount" id="nc-disp-amount">₦0.00</div>
          <div class="nc-label">Select payment method</div>
        </div>
        <div class="nc-tabs">
          <div class="nc-tab" id="nc-tab-card">
            <span class="nc-tab-icon">💳</span>Card
          </div>
          <div class="nc-tab" id="nc-tab-transfer">
            <span class="nc-tab-icon">🏦</span>Transfer
          </div>
        </div>
        <div class="nc-powered">Secured by <span>Nomba</span></div>
      </div>

      <!-- SAVED CARD PROMPT -->
      <div class="nc-screen" id="nc-savedcard">
        <div class="nc-header">
          <div class="nc-amount" id="nc-disp-amount-2">₦0.00</div>
          <div class="nc-label">Complete your payment</div>
        </div>
        <div class="nc-saved-card">
          <div class="nc-sc-top">
            <div class="nc-sc-icon">💳</div>
            <div class="nc-sc-info">
              <div class="nc-sc-name" id="nc-sc-type">Visa</div>
              <div class="nc-sc-num"  id="nc-sc-num">•••• •••• •••• ----</div>
            </div>
          </div>
        </div>
        <div class="nc-err" id="nc-saved-err"></div>
        <button class="nc-btn" id="nc-pay-saved">
          <span id="nc-pay-saved-label">Pay ₦0.00</span>
        </button>
        <button class="nc-btn nc-btn-ghost" id="nc-use-new-card">Use a different card</button>
        <div class="nc-powered">Secured by <span>Nomba</span></div>
      </div>

      <!-- CARD FORM -->
      <div class="nc-screen" id="nc-cardform">
        <div class="nc-header">
          <div class="nc-amount" id="nc-disp-amount-3">₦0.00</div>
          <div class="nc-label">Enter card details</div>
        </div>
        <div class="nc-err" id="nc-card-err"></div>
        <div class="nc-field nc-card-row">
          <label>Card Number</label>
          <input id="nc-card-num" inputmode="numeric" maxlength="19" placeholder="0000 0000 0000 0000">
          <span class="nc-card-brand" id="nc-brand"></span>
        </div>
        <div class="nc-field">
          <label>Cardholder Name</label>
          <input id="nc-card-name" placeholder="Name on card" autocomplete="cc-name">
        </div>
        <div class="nc-row">
          <div class="nc-field">
            <label>Expiry</label>
            <input id="nc-card-exp" inputmode="numeric" maxlength="5" placeholder="MM/YY" autocomplete="cc-exp">
          </div>
          <div class="nc-field">
            <label>CVV</label>
            <input id="nc-card-cvv" inputmode="numeric" maxlength="4" placeholder="•••" type="password" autocomplete="cc-csc">
          </div>
        </div>
        <label class="nc-check">
          <input type="checkbox" id="nc-save-check">
          Save card for faster payment next time
        </label>
        <button class="nc-btn" id="nc-pay-card">
          <span id="nc-pay-card-label">Pay ₦0.00</span>
        </button>
        <button class="nc-btn nc-btn-ghost" id="nc-back-method">← Back</button>
        <div class="nc-powered">Secured by <span>Nomba</span></div>
      </div>

      <!-- OTP SCREEN -->
      <div class="nc-screen" id="nc-otp">
        <div class="nc-header">
          <div class="nc-amount" id="nc-disp-amount-4">₦0.00</div>
          <div class="nc-label" id="nc-otp-label">Enter the OTP sent to your phone</div>
        </div>
        <div class="nc-err" id="nc-otp-err"></div>
        <div class="nc-otp-wrap" id="nc-otp-boxes"></div>
        <button class="nc-btn" id="nc-submit-otp">
          <span id="nc-submit-otp-label">Verify Payment</span>
        </button>
        <button class="nc-btn nc-btn-ghost" id="nc-resend-otp">Resend OTP</button>
        <div class="nc-powered">Secured by <span>Nomba</span></div>
      </div>

      <!-- 3DS SCREEN -->
      <div class="nc-screen" id="nc-3ds">
        <div class="nc-header">
          <div class="nc-amount" id="nc-disp-amount-5">₦0.00</div>
          <div class="nc-label">Complete bank authentication</div>
        </div>
        <iframe class="nc-3ds-frame" id="nc-3ds-frame" src="about:blank"></iframe>
        <div class="nc-powered">Secured by <span>Nomba</span></div>
      </div>

      <!-- TRANSFER SCREEN -->
      <div class="nc-screen" id="nc-transfer">
        <div class="nc-header">
          <div class="nc-amount" id="nc-disp-amount-6">₦0.00</div>
          <div class="nc-label">Transfer the exact amount to</div>
        </div>
        <div class="nc-va-box">
          <div class="nc-va-row">
            <span class="nc-va-k">Bank</span>
            <span class="nc-va-v" id="nc-va-bank">—</span>
          </div>
          <div class="nc-va-row">
            <span class="nc-va-k">Account Number</span>
            <span style="display:flex;align-items:center;gap:4px">
              <span class="nc-va-v" id="nc-va-num">—</span>
              <span class="nc-va-copy" id="nc-copy-acct">Copy</span>
            </span>
          </div>
          <div class="nc-va-row">
            <span class="nc-va-k">Account Name</span>
            <span class="nc-va-v" id="nc-va-name">—</span>
          </div>
          <div class="nc-va-row">
            <span class="nc-va-k">Amount</span>
            <span class="nc-va-v" id="nc-va-amount">—</span>
          </div>
        </div>
        <p class="nc-va-note">⚠️ Transfer the exact amount. Do not close this screen.</p>
        <div class="nc-poll-bar"><div class="nc-poll-fill"></div></div>
        <div class="nc-err" id="nc-transfer-err"></div>
        <button class="nc-btn nc-btn-ghost" id="nc-back-method-2">← Change method</button>
        <div class="nc-powered">Secured by <span>Nomba</span></div>
      </div>

      <!-- SUCCESS SCREEN -->
      <div class="nc-screen" id="nc-success">
        <div class="nc-status-wrap">
          <div class="nc-status-icon">✅</div>
          <div class="nc-status-title">Payment Successful</div>
          <div class="nc-status-sub" id="nc-success-msg">Your payment has been confirmed.</div>
        </div>
        <div class="nc-powered">Secured by <span>Nomba</span></div>
      </div>

      <!-- FAILED SCREEN -->
      <div class="nc-screen" id="nc-failed">
        <div class="nc-status-wrap">
          <div class="nc-status-icon">❌</div>
          <div class="nc-status-title">Payment Failed</div>
          <div class="nc-status-sub" id="nc-failed-msg">Something went wrong. Please try again.</div>
        </div>
        <button class="nc-btn" id="nc-try-again" style="margin:0 24px 24px;width:calc(100% - 48px)">Try Again</button>
        <div class="nc-powered">Secured by <span>Nomba</span></div>
      </div>

    </div>
  `);

  // ── state ──────────────────────────────────────────────────────────────────
  const state = {
    amount: 0, paymentRef: "", customerEmail: "", customerName: "",
    currency: "NGN", devId: "", backendUrl: "", pluginSecret: "",
    paymentInitiated: false, transactionId: "",
    savedCardId: "", savedCardLast4: "", savedCardType: "",
    pollTimer: null,
  };

  // ── helpers ────────────────────────────────────────────────────────────────
  const $ = sel => instance.canvas[0].querySelector(sel);

  function fmtAmount(amount, currency) {
    const sym = currency === "NGN" ? "₦" : currency + " ";
    return sym + Number(amount).toLocaleString("en-NG", { minimumFractionDigits: 2 });
  }

  function show(screenId) {
    instance.canvas[0].querySelectorAll(".nc-screen").forEach(s => s.classList.remove("active"));
    const el = $(`#${screenId}`);
    if (el) el.classList.add("active");
  }

  function showErr(errId, msg) {
    const el = $(`#${errId}`);
    if (!el) return;
    el.textContent = msg;
    el.classList.toggle("show", !!msg);
  }

  function setLoading(btnId, labelId, loading, labelText) {
    const btn = $(`#${btnId}`), lbl = $(`#${labelId}`);
    if (!btn) return;
    btn.disabled = loading;
    lbl.innerHTML = loading
      ? '<div class="nc-spinner"></div>'
      : labelText;
  }

  function updateAmountDisplays() {
    const f = fmtAmount(state.amount, state.currency);
    ["nc-disp-amount","nc-disp-amount-2","nc-disp-amount-3",
     "nc-disp-amount-4","nc-disp-amount-5","nc-disp-amount-6"]
      .forEach(id => { const el = $(`#${id}`); if (el) el.textContent = f; });
    // pay button labels
    const payLabel = `Pay ${f}`;
    [["nc-pay-saved-label", payLabel], ["nc-pay-card-label", payLabel]].forEach(([id, txt]) => {
      const el = $(`#${id}`); if (el && !el.closest(".nc-btn").disabled) el.textContent = txt;
    });
  }

  // ── API calls ──────────────────────────────────────────────────────────────
  async function api(method, path, body) {
    const url = state.backendUrl.replace(/\/$/, "") + "/api/" + path;
    const opts = {
      method,
      headers: { "Content-Type": "application/json", "X-Plugin-Secret": state.pluginSecret },
    };
    if (body) opts.body = JSON.stringify(body);
    const res  = await fetch(url, opts);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  }

  async function ensurePaymentInitiated() {
    if (state.paymentInitiated) return;
    await api("POST", "payment/initiate/", {
      dev_id: state.devId, payment_ref: state.paymentRef,
      amount: state.amount, customer_email: state.customerEmail,
      customer_name: state.customerName, method: "card",
      currency: state.currency,
    });
    state.paymentInitiated = true;
  }

  // ── card formatting ────────────────────────────────────────────────────────
  function detectBrand(num) {
    const n = num.replace(/\s/g, "");
    if (/^4/.test(n))  return "VISA";
    if (/^5[1-5]/.test(n) || /^2(2[2-9][1-9]|[3-6]\d{2}|7([01]\d|20))/.test(n)) return "MC";
    if (/^3[47]/.test(n)) return "AMEX";
    return "";
  }

  const cardNumEl = $(`#nc-card-num`);
  if (cardNumEl) {
    cardNumEl.addEventListener("input", e => {
      let v = e.target.value.replace(/\D/g, "").slice(0, 16);
      e.target.value = v.replace(/(.{4})/g, "$1 ").trim();
      const brand = detectBrand(v);
      const brandEl = $(`#nc-brand`);
      if (brandEl) brandEl.textContent = brand;
    });
  }

  const expEl = $(`#nc-card-exp`);
  if (expEl) {
    expEl.addEventListener("input", e => {
      let v = e.target.value.replace(/\D/g, "").slice(0, 4);
      if (v.length > 2) v = v.slice(0,2) + "/" + v.slice(2);
      e.target.value = v;
    });
  }

  // ── OTP boxes ──────────────────────────────────────────────────────────────
  const OTP_LEN = 6;
  const otpWrap = $(`#nc-otp-boxes`);
  if (otpWrap) {
    for (let i = 0; i < OTP_LEN; i++) {
      const inp = document.createElement("input");
      inp.className = "nc-otp-inp";
      inp.maxLength = 1;
      inp.inputMode = "numeric";
      inp.setAttribute("data-idx", i);
      inp.addEventListener("input", e => {
        if (e.target.value && i < OTP_LEN - 1)
          otpWrap.children[i + 1].focus();
      });
      inp.addEventListener("keydown", e => {
        if (e.key === "Backspace" && !e.target.value && i > 0)
          otpWrap.children[i - 1].focus();
      });
      otpWrap.appendChild(inp);
    }
  }

  function getOTP() {
    return Array.from(otpWrap.children).map(i => i.value).join("");
  }

  // ── encrypt card details (Nomba expects encrypted payload) ─────────────────
  // Nomba provides a public key for RSA encryption of card data.
  // Replace _encryptCard with Nomba's actual encryption library call.
  // See: https://developer.nomba.com for the encryption SDK.
  function _encryptCard(cardData, encKey) {
    // TODO: integrate Nomba's card encryption library here.
    // The card data must be encrypted with the key Nomba provides
    // before being sent to your backend.
    // For sandbox testing, Nomba accepts a plain JSON string.
    return JSON.stringify(cardData);
  }

  function buildCardPayload() {
    const num  = ($(`#nc-card-num`)?.value  || "").replace(/\s/g, "");
    const name = $(`#nc-card-name`)?.value  || "";
    const exp  = $(`#nc-card-exp`)?.value   || "";
    const cvv  = $(`#nc-card-cvv`)?.value   || "";
    const [mm, yy] = exp.split("/");
    return _encryptCard({ cardNumber: num, cardName: name, expiryMonth: mm, expiryYear: "20" + yy, cvv }, "");
  }

  function validateCard() {
    const num  = ($(`#nc-card-num`)?.value  || "").replace(/\s/g, "");
    const name = ($(`#nc-card-name`)?.value || "").trim();
    const exp  = $(`#nc-card-exp`)?.value   || "";
    const cvv  = $(`#nc-card-cvv`)?.value   || "";
    if (num.length < 16)     return "Enter a valid 16-digit card number.";
    if (!name)               return "Enter the cardholder name.";
    if (!/^\d{2}\/\d{2}$/.test(exp)) return "Enter a valid expiry (MM/YY).";
    if (cvv.length < 3)     return "Enter a valid CVV.";
    return null;
  }

  // ── polling ────────────────────────────────────────────────────────────────
  function startPolling() {
    let attempts = 0;
    const MAX = 60; // ~5 minutes at 5s intervals
    state.pollTimer = setInterval(async () => {
      attempts++;
      try {
        const result = await api("GET", `payment/${encodeURIComponent(state.paymentRef)}/`);
        if (result.status === "success" || result.status === "transferred") {
          clearInterval(state.pollTimer);
          showSuccess();
        } else if (result.status === "failed") {
          clearInterval(state.pollTimer);
          showFailed("Payment failed. Please try again.");
        }
      } catch (_) { /* network hiccup — keep polling */ }
      if (attempts >= MAX) {
        clearInterval(state.pollTimer);
        showErr("nc-transfer-err", "Payment not confirmed yet. Check your payment status later.");
      }
    }, 5000);
  }

  // ── success / failed ───────────────────────────────────────────────────────
  function showSuccess() {
    const msg = $(`#nc-success-msg`);
    if (msg) msg.textContent = `Payment of ${fmtAmount(state.amount, state.currency)} confirmed.`;
    show("nc-success");
    instance.publishState("payment_status", "success");
    instance.triggerEvent("payment_success");
  }

  function showFailed(msg) {
    const el = $(`#nc-failed-msg`); if (el) el.textContent = msg;
    show("nc-failed");
    instance.publishState("payment_status", "failed");
    instance.publishState("error_message", msg);
    instance.triggerEvent("payment_failed");
  }

  // ── method selection ───────────────────────────────────────────────────────
  async function handleMethodSelect(method) {
    $(`#nc-tab-card`).classList.toggle("active", method === "card");
    $(`#nc-tab-transfer`).classList.toggle("active", method === "transfer");

    if (method === "card") {
      // check for saved card
      try {
        const cards = await api("GET",
          `payment/saved-cards/?dev_id=${state.devId}&customer_email=${encodeURIComponent(state.customerEmail)}`
        );
        if (cards.length > 0) {
          const card = cards[0];
          state.savedCardId   = card.id;
          state.savedCardLast4 = card.card_last4;
          state.savedCardType  = card.card_type;
          $(`#nc-sc-type`).textContent = card.card_type || "Card";
          $(`#nc-sc-num`).textContent  = `•••• •••• •••• ${card.card_last4}`;
          $(`#nc-pay-saved-label`).textContent = `Pay ${fmtAmount(state.amount, state.currency)}`;
          show("nc-savedcard");
          return;
        }
      } catch (_) { /* no saved card — go straight to card form */ }
      show("nc-cardform");

    } else {
      // transfer — initiate and create virtual account
      try {
        await ensurePaymentInitiated();
        const va = await api("POST", "transfer/virtual-account/", { payment_ref: state.paymentRef });
        $(`#nc-va-bank`).textContent   = va.bank_name      || "—";
        $(`#nc-va-num`).textContent    = va.account_number || "—";
        $(`#nc-va-name`).textContent   = va.account_name   || "—";
        $(`#nc-va-amount`).textContent = fmtAmount(state.amount, state.currency);
        show("nc-transfer");
        startPolling();
      } catch (err) {
        showErr("nc-transfer-err", err.message);
      }
    }
  }

  $(`#nc-tab-card`).addEventListener("click", () => handleMethodSelect("card"));
  $(`#nc-tab-transfer`).addEventListener("click", () => handleMethodSelect("transfer"));
  $(`#nc-back-method`).addEventListener("click", () => show("nc-method"));
  $(`#nc-back-method-2`).addEventListener("click", () => {
    clearInterval(state.pollTimer);
    show("nc-method");
  });
  $(`#nc-use-new-card`).addEventListener("click", () => show("nc-cardform"));

  // ── pay with saved card ────────────────────────────────────────────────────
  $(`#nc-pay-saved`).addEventListener("click", async () => {
    setLoading("nc-pay-saved", "nc-pay-saved-label", true, "");
    showErr("nc-saved-err", "");
    try {
      await ensurePaymentInitiated();
      const result = await api("POST", "card/tokenized/", {
        payment_ref: state.paymentRef, dev_id: state.devId,
        customer_email: state.customerEmail,
      });
      if (result.completed) showSuccess();
      else showFailed(result.message || "Payment did not complete.");
    } catch (err) {
      showErr("nc-saved-err", err.message);
      setLoading("nc-pay-saved", "nc-pay-saved-label", false,
        `Pay ${fmtAmount(state.amount, state.currency)}`);
    }
  });

  // ── pay with card form ─────────────────────────────────────────────────────
  $(`#nc-pay-card`).addEventListener("click", async () => {
    showErr("nc-card-err", "");
    const valErr = validateCard();
    if (valErr) { showErr("nc-card-err", valErr); return; }

    setLoading("nc-pay-card", "nc-pay-card-label", true, "");
    const saveCard = $(`#nc-save-check`)?.checked || false;

    try {
      await ensurePaymentInitiated();
      const result = await api("POST", "card/submit/", {
        payment_ref: state.paymentRef,
        card_details: buildCardPayload(),
        key: "", save_card: saveCard,
      });

      state.transactionId = result.transaction_id || "";

      if (result.completed) {
        showSuccess();
      } else if (result.requires_otp) {
        $(`#nc-otp-label`).textContent = "Enter the OTP sent to your phone";
        show("nc-otp");
        otpWrap.children[0].focus();
      } else if (result.requires_3ds && result.secure_auth_url) {
        $(`#nc-3ds-frame`).src = result.secure_auth_url;
        show("nc-3ds");
        // Poll for completion while iframe loads
        startPolling();
      } else {
        showFailed(result.message || "Payment did not complete.");
      }
    } catch (err) {
      showErr("nc-card-err", err.message);
    }
    setLoading("nc-pay-card", "nc-pay-card-label", false,
      `Pay ${fmtAmount(state.amount, state.currency)}`);
  });

  // ── OTP submit ─────────────────────────────────────────────────────────────
  $(`#nc-submit-otp`).addEventListener("click", async () => {
    const otp = getOTP();
    if (otp.length < OTP_LEN) { showErr("nc-otp-err", "Enter the complete OTP."); return; }
    showErr("nc-otp-err", "");
    setLoading("nc-submit-otp", "nc-submit-otp-label", true, "");
    try {
      const result = await api("POST", "card/otp/", { payment_ref: state.paymentRef, otp });
      if (result.completed) showSuccess();
      else showFailed(result.message || "OTP verification failed.");
    } catch (err) {
      showErr("nc-otp-err", err.message);
      setLoading("nc-submit-otp", "nc-submit-otp-label", false, "Verify Payment");
    }
  });

  $(`#nc-resend-otp`).addEventListener("click", async () => {
    try {
      await api("POST", "card/otp/resend/", { payment_ref: state.paymentRef });
      showErr("nc-otp-err", ""); // clear error
      $(`#nc-otp-label`).textContent = "New OTP sent to your phone";
    } catch (err) {
      showErr("nc-otp-err", err.message);
    }
  });

  // ── copy account number ────────────────────────────────────────────────────
  $(`#nc-copy-acct`).addEventListener("click", () => {
    const num = $(`#nc-va-num`)?.textContent || "";
    navigator.clipboard?.writeText(num).then(() => {
      $(`#nc-copy-acct`).textContent = "Copied!";
      setTimeout(() => { $(`#nc-copy-acct`).textContent = "Copy"; }, 1500);
    });
  });

  // ── try again ──────────────────────────────────────────────────────────────
  $(`#nc-try-again`).addEventListener("click", () => {
    state.paymentInitiated = false;
    state.transactionId = "";
    show("nc-method");
  });

  // ── expose state ref so update() can access it ─────────────────────────────
  instance._ncState = state;
}


// ── UPDATE ────────────────────────────────────────────────────────────────────
// Paste everything inside this function into Bubble's Update box.

function update(instance, properties, context) {
  const s = instance._ncState;
  if (!s) return;

  s.amount        = properties.amount        || 0;
  s.paymentRef    = properties.payment_ref   || "";
  s.customerEmail = properties.customer_email || "";
  s.customerName  = properties.customer_name  || "";
  s.currency      = properties.currency       || "NGN";
  s.devId         = context.keys["dev_id"]     || "";
  s.backendUrl    = context.keys["backend_url"] || "";
  s.pluginSecret  = context.keys["plugin_secret"] || "";

  // refresh amount display everywhere
  const fmtAmt = s.currency === "NGN"
    ? "₦" + Number(s.amount).toLocaleString("en-NG", { minimumFractionDigits: 2 })
    : s.currency + " " + Number(s.amount).toFixed(2);

  instance.canvas[0].querySelectorAll(
    "#nc-disp-amount,#nc-disp-amount-2,#nc-disp-amount-3," +
    "#nc-disp-amount-4,#nc-disp-amount-5,#nc-disp-amount-6"
  ).forEach(el => el.textContent = fmtAmt);

  const labels = ["#nc-pay-saved-label", "#nc-pay-card-label"];
  labels.forEach(sel => {
    const el = instance.canvas[0].querySelector(sel);
    const btn = el?.closest(".nc-btn");
    if (el && btn && !btn.disabled) el.textContent = `Pay ${fmtAmt}`;
  });
}
