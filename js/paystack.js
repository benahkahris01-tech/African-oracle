/* ═══════════════════════════════════════════════════════════════
   paystack.js — Paystack Payment Integration
   
   STATUS: Ready to activate. Dormant until PAYSTACK_PUBLIC_KEY
   is filled in. When key is empty the Paystack button is hidden
   and M-PESA remains the only active option.
   
   ACTIVATION STEPS (when Paystack approves your account):
   1. Log in to dashboard.paystack.com
   2. Settings → API Keys & Webhooks
   3. Copy your LIVE Public Key (starts with pk_live_)
   4. Paste it into PAYSTACK_PUBLIC_KEY below
   5. Copy your LIVE Secret Key (starts with sk_live_)
   6. Add it to Apps Script Script Properties as PAYSTACK_SECRET
   7. In Apps Script doPost, the paystackWebhook() function
      will start handling Paystack callbacks automatically
   8. Run: bash deploy.sh "activate Paystack payments"
   
   WEBHOOK URL to paste in Paystack dashboard:
   Settings → API Keys & Webhooks → Webhook URL:
   → Your Apps Script Web App URL (same as API_URL in app.js)
   
   SUPPORTED PAYMENT METHODS:
   Kenya  → Card (Visa, Mastercard), M-PESA via Paystack
   SA     → Card (Visa, Mastercard, Amex), EFT (FNB, Standard Bank,
             Capitec, Absa), instant pay
   
   FEES (deducted from what you receive — no upfront cost):
   Kenya local   → 1.5% per transaction
   SA / card     → 2.9% + ZAR 1 per transaction
═══════════════════════════════════════════════════════════════ */

// ── YOUR PAYSTACK PUBLIC KEY ──────────────────────────────────
// Leave empty string until Paystack approves your account.
// The moment you paste your live key here, Paystack buttons
// appear automatically — no other changes needed anywhere.
var PAYSTACK_PUBLIC_KEY = "";
// Example when live: "pk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

// ── Plan config ───────────────────────────────────────────────
var PAYSTACK_PLANS = {
  monthly: {
    label:   "African Oracle Premium — Monthly",
    amountKES: 800,
    amountZAR: 101.25,
    period:  "monthly",
    months:  1
  },
  annual: {
    label:   "African Oracle Premium — Annual",
    amountKES: 7200,
    amountZAR: 911.25,
    period:  "annual",
    months:  12
  }
};

// ── Inject modal CSS once — self-contained, works on any page ─
// Does not depend on premium.css being loaded — this was the
// bug causing the modal to render at the bottom of the page
// instead of as a centered popup.
(function injectPaystackCSS() {
  if (document.getElementById("paystack-modal-css")) return;
  var style = document.createElement("style");
  style.id  = "paystack-modal-css";
  style.textContent = [
    "@keyframes psFadeIn{from{opacity:0}to{opacity:1}}",
    "@keyframes psSlideUp{from{opacity:0;transform:translateY(24px) scale(0.97)}to{opacity:1;transform:translateY(0) scale(1)}}",

    ".paystack-modal-wrap{position:fixed;inset:0;z-index:9999;background:rgba(8,8,8,0.82);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:20px;animation:psFadeIn 0.2s ease-out;}",

    ".paystack-modal{background:linear-gradient(180deg,#1C1C1C 0%,#161616 100%);border:1px solid rgba(255,255,255,0.08);border-radius:16px;width:100%;max-width:400px;position:relative;overflow:hidden;box-shadow:0 32px 80px rgba(0,0,0,0.5),0 0 0 1px rgba(255,255,255,0.04);animation:psSlideUp 0.3s cubic-bezier(0.16,1,0.3,1);}",

    ".paystack-close{position:absolute;top:14px;right:14px;width:28px;height:28px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.08);border:none;border-radius:50%;color:rgba(255,255,255,0.7);font-size:14px;cursor:pointer;line-height:1;z-index:10;transition:all 0.15s;}",
    ".paystack-close:hover{background:rgba(255,255,255,0.16);color:#fff;transform:rotate(90deg);}",

    ".paystack-header{background:linear-gradient(135deg,#00C3F5 0%,#0BA4DB 55%,#0077B6 100%);padding:28px 28px 24px;text-align:center;position:relative;overflow:hidden;}",
    ".paystack-header::before{content:'';position:absolute;top:-50%;right:-20%;width:180px;height:180px;background:rgba(255,255,255,0.08);border-radius:50%;}",
    ".paystack-header::after{content:'';position:absolute;bottom:-60%;left:-10%;width:140px;height:140px;background:rgba(255,255,255,0.06);border-radius:50%;}",
    ".paystack-logo{font-size:17px;font-weight:800;color:#fff;letter-spacing:0.01em;margin-bottom:10px;position:relative;font-family:-apple-system,'DM Sans',sans-serif;}",
    ".paystack-plan-name{font-size:11px;color:rgba(255,255,255,0.78);margin-bottom:6px;position:relative;font-weight:500;}",
    ".paystack-amount{font-size:26px;font-weight:700;color:#fff;position:relative;letter-spacing:-0.01em;}",

    ".paystack-body{padding:26px 28px 22px;}",
    ".paystack-instruction{font-size:13px;color:#9A9A9A;margin-bottom:20px;line-height:1.65;text-align:center;}",

    ".paystack-form-group{margin-bottom:16px;}",
    ".paystack-label{display:block;font-size:10px;text-transform:uppercase;letter-spacing:0.1em;color:#777;margin-bottom:7px;font-weight:600;}",
    ".paystack-input{width:100%;background:rgba(255,255,255,0.04);border:1.5px solid rgba(255,255,255,0.08);border-radius:10px;color:#EDEDED;font-size:15px;padding:13px 14px;outline:none;transition:all 0.15s;box-sizing:border-box;font-family:-apple-system,'DM Sans',sans-serif;}",
    ".paystack-input:focus{border-color:#0BA4DB;background:rgba(11,164,219,0.06);box-shadow:0 0 0 3px rgba(11,164,219,0.12);}",
    ".paystack-input::placeholder{color:#555;}",
    ".paystack-hint{font-size:11px;color:#666;margin-top:6px;line-height:1.4;}",

    ".paystack-error{background:rgba(220,68,55,0.1);color:#F08070;border:1px solid rgba(220,68,55,0.25);border-radius:10px;padding:11px 14px;font-size:12.5px;margin-bottom:14px;line-height:1.5;animation:psSlideUp 0.2s ease-out;}",

    ".paystack-submit-btn{width:100%;background:linear-gradient(135deg,#00C3F5,#0BA4DB);color:#fff;font-size:15px;font-weight:700;padding:15px;border:none;border-radius:11px;cursor:pointer;transition:all 0.18s;margin-bottom:14px;letter-spacing:0.01em;box-shadow:0 4px 14px rgba(11,164,219,0.3);}",
    ".paystack-submit-btn:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 6px 20px rgba(11,164,219,0.4);}",
    ".paystack-submit-btn:active:not(:disabled){transform:translateY(0);}",
    ".paystack-submit-btn:disabled{background:#2A2A2A;color:#666;cursor:default;box-shadow:none;}",

    ".paystack-secure{font-size:11px;color:#666;text-align:center;display:flex;align-items:center;justify-content:center;gap:5px;}",

    ".paystack-footer{padding:14px 28px;border-top:1px solid rgba(255,255,255,0.06);font-size:11.5px;color:#666;text-align:center;}",
    ".paystack-footer a{color:#C9A84C;text-decoration:none;}",
    ".paystack-footer a:hover{text-decoration:underline;}",

    ".hidden{display:none!important;}",

    "@media (max-width:420px){.paystack-modal{max-width:100%;border-radius:16px;}.paystack-header{padding:24px 22px 20px;}.paystack-body{padding:22px 22px 18px;}}"
  ].join("");
  document.head.appendChild(style);
})();

// ── Is Paystack ready to use? ─────────────────────────────────
// Called by premium.html to decide whether to show Paystack buttons
function isPaystackReady() {
  return PAYSTACK_PUBLIC_KEY &&
         PAYSTACK_PUBLIC_KEY !== "" &&
         PAYSTACK_PUBLIC_KEY.indexOf("pk_live_") === 0;
}

// ── Detect user currency ──────────────────────────────────────
// Kenya → KES, South Africa → ZAR, default → KES
function detectPaystackCurrency() {
  var tz = "";
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (e) {}
  if (tz.indexOf("Johannesburg") > -1 || tz.indexOf("South_Africa") > -1) return "ZAR";
  return "KES";
}

// ── Generate unique transaction reference ─────────────────────
function paystackTxRef(planId) {
  var ts   = Date.now().toString(36).toUpperCase();
  var rand = Math.random().toString(36).substr(2, 4).toUpperCase();
  return "ORC-PS-" + planId.toUpperCase().charAt(0) + "-" + ts + "-" + rand;
}

// ── Show Paystack payment form ────────────────────────────────
function showPaystackForm(planId) {
  if (!isPaystackReady()) {
    alert("Paystack payments are coming soon. Please use M-PESA for now.");
    return;
  }

  var plan     = PAYSTACK_PLANS[planId];
  var currency = detectPaystackCurrency();
  var amount   = currency === "ZAR" ? plan.amountZAR : plan.amountKES;
  // Paystack requires amount in smallest currency unit
  // KES and ZAR are both in their base unit already (no kobo/cents)
  var amountInKobo = amount * 100;

  // Remove existing modal if open
  var old = document.getElementById("paystackModal");
  if (old) old.remove();

  var modal = document.createElement("div");
  modal.id  = "paystackModal";
  modal.className = "paystack-modal-wrap";
  modal.innerHTML =
    '<div class="paystack-modal">' +
      '<button class="paystack-close" id="paystackClose">✕</button>' +
      '<div class="paystack-header">' +
        '<div class="paystack-logo">◈ The African Oracle</div>' +
        '<div class="paystack-plan-name">' + plan.label + '</div>' +
        '<div class="paystack-amount">' +
          (currency === "ZAR" ? "R" : "KES ") + amount.toLocaleString() +
          ' / ' + plan.period +
        '</div>' +
      '</div>' +
      '<div class="paystack-body">' +
        '<p class="paystack-instruction">' +
          (currency === "ZAR"
            ? "Pay by card (Visa, Mastercard, Amex) or EFT from your South African bank."
            : "Pay by card (Visa, Mastercard) or M-PESA via the secure Paystack checkout.") +
        '</p>' +
        '<div class="paystack-form-group">' +
          '<label class="paystack-label">Email address</label>' +
          '<input type="email" id="paystackEmail" class="paystack-input" ' +
                 'placeholder="your@email.com" />' +
          '<p class="paystack-hint">Your access token will be sent here after payment</p>' +
        '</div>' +
        '<div id="paystackFormError" class="paystack-error hidden"></div>' +
        '<button id="paystackSubmit" class="paystack-submit-btn">' +
          'Pay ' + (currency === "ZAR" ? "R" : "KES ") + amount.toLocaleString() + ' →' +
        '</button>' +
        '<p class="paystack-secure">🔒 Secured by Paystack · Backed by Stripe</p>' +
      '</div>' +
      '<div class="paystack-footer">' +
        '<p>Questions? <a href="contact.html">Contact us</a></p>' +
      '</div>' +
    '</div>';

  document.body.appendChild(modal);

  document.getElementById("paystackClose").onclick = function () { modal.remove(); };
  modal.onclick = function (e) { if (e.target === modal) modal.remove(); };
  document.getElementById("paystackEmail").addEventListener("keydown", function (e) {
    if (e.key === "Enter") document.getElementById("paystackSubmit").click();
  });

  document.getElementById("paystackSubmit").onclick = function () {
    initiatePaystackPayment(planId, currency, amount, amountInKobo);
  };
}

// ── Initiate Paystack inline checkout ─────────────────────────
function initiatePaystackPayment(planId, currency, amount, amountInKobo) {
  var email     = (document.getElementById("paystackEmail").value || "").trim();
  var errorEl   = document.getElementById("paystackFormError");
  var submitBtn = document.getElementById("paystackSubmit");
  var plan      = PAYSTACK_PLANS[planId];

  if (!email || !email.includes("@")) {
    errorEl.textContent = "⚠ Please enter a valid email address.";
    errorEl.classList.remove("hidden");
    return;
  }

  errorEl.classList.add("hidden");
  submitBtn.textContent = "Opening checkout…";
  submitBtn.disabled    = true;

  var txRef = paystackTxRef(planId);

  // Remove modal — Paystack opens its own overlay
  var modal = document.getElementById("paystackModal");
  if (modal) modal.remove();

  // Paystack inline checkout
  // Paystack.js is loaded from CDN when this function is first called
  loadPaystackScript(function () {
    var handler = PaystackPop.setup({
      key:       PAYSTACK_PUBLIC_KEY,
      email:     email,
      amount:    amountInKobo,
      currency:  currency,
      ref:       txRef,
      label:     plan.label,
      metadata: {
        custom_fields: [
          { display_name:"Plan",   variable_name:"plan",   value: planId  },
          { display_name:"Period", variable_name:"period", value: plan.period },
          { display_name:"Source", variable_name:"source", value: "africanoracle.info" }
        ]
      },
      onSuccess: function (transaction) {
        handlePaystackSuccess(transaction, email, planId, txRef);
      },
      onCancel: function () {
        showPaystackMessage(
          "Payment cancelled. Click Subscribe again when you are ready.",
          "warn"
        );
      }
    });
    handler.openIframe();
  });
}

// ── Handle successful Paystack payment ────────────────────────
function handlePaystackSuccess(transaction, email, planId, txRef) {
  showPaystackMessage(
    "✓ Payment confirmed! Generating your access token…",
    "success"
  );

  // Notify Apps Script webhook to generate token and send email
  if (typeof API_URL === "undefined" || !API_URL ||
      API_URL === "PASTE_YOUR_APPS_SCRIPT_URL_HERE") {
    showPaystackMessage(
      "Payment received but API not configured. Please contact us with reference: " +
      transaction.reference,
      "warn"
    );
    return;
  }

  fetch(API_URL, {
    method:  "POST",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify({
      action:    "paystack_success",
      email:     email,
      planId:    planId,
      reference: transaction.reference,
      txRef:     txRef,
      status:    transaction.status
    })
  })
  .then(function (r) { return r.json(); })
  .then(function (result) {
    if (result.success) {
      window.location.href =
        "payment-success.html?email=" + encodeURIComponent(email) +
        "&plan=" + encodeURIComponent(planId) +
        "&method=paystack";
    } else {
      showPaystackMessage(
        "Payment received but token generation failed. " +
        "Please contact us with reference: " + transaction.reference +
        " and we will send your token within 1 hour.",
        "warn"
      );
    }
  })
  .catch(function () {
    showPaystackMessage(
      "Payment confirmed but could not auto-generate token. " +
      "Please email us your M-PESA reference: " + transaction.reference,
      "warn"
    );
  });
}

// ── Load Paystack.js from CDN on demand ───────────────────────
// Only loads when user clicks Subscribe — not on page load
var _paystackScriptLoaded = false;
function loadPaystackScript(callback) {
  if (_paystackScriptLoaded && typeof PaystackPop !== "undefined") {
    callback();
    return;
  }
  var script    = document.createElement("script");
  script.src    = "https://js.paystack.co/v1/inline.js";
  script.async  = true;
  script.onload = function () {
    _paystackScriptLoaded = true;
    callback();
  };
  script.onerror = function () {
    showPaystackMessage(
      "Could not load Paystack. Check your internet connection and try again.",
      "error"
    );
  };
  document.head.appendChild(script);
}

// ── Status message helper ─────────────────────────────────────
function showPaystackMessage(msg, type) {
  var existing = document.getElementById("paystackStatusMsg");
  if (!existing) {
    existing    = document.createElement("div");
    existing.id = "paystackStatusMsg";
    var inner   = document.querySelector(".prem-page-inner") || document.body;
    inner.insertBefore(existing, inner.firstChild);
  }
  existing.innerHTML  = msg;
  existing.className  = "payment-message payment-message-" + type;
  existing.scrollIntoView({ behavior: "smooth", block: "center" });
}