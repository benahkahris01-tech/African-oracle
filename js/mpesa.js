/* ═══════════════════════════════════════════════════════════════
   mpesa.js — M-PESA Daraja STK Push Integration
   
   SETUP:
   1. Go to developer.safaricom.co.ke → My Apps → Create App
   2. Select M-PESA Express (Lipa na M-PESA Online)
   3. Copy Consumer Key and Consumer Secret into Apps Script v17
   4. Set DARAJA_SHORTCODE to your till number
   5. Get your Passkey from the Daraja portal
   6. Set DARAJA_ENV to "live" once testing is done
   
   FLOW:
   User clicks Subscribe →
   showMpesaForm(planId) collects email + phone →
   submitMpesaPayment() calls your Apps Script doPost →
   Apps Script calls Safaricom STK push API →
   User receives STK push on phone →
   User enters M-PESA PIN →
   Safaricom calls Apps Script doPost callback →
   Apps Script generates token + emails user →
   User is redirected to payment-success.html
   
   POLLING:
   After STK push is sent, we poll every 5 seconds for
   up to 2 minutes to check if the callback was received.
   If confirmed → redirect to success page.
   If timeout → show manual confirmation instructions.
═══════════════════════════════════════════════════════════════ */

// ── Plan config ───────────────────────────────────────────────
var MPESA_PLANS = {
  monthly: { label:"Monthly Plan", amount:800,  period:"monthly", months:1  },
  annual:  { label:"Annual Plan",  amount:7200, period:"annual",  months:12 }
};

// ── Inject modal CSS once — works on any page ─────────────────
// This means the modal is self-contained and does not depend
// on stock.css or premium.css being loaded on the current page
(function injectMpesaCSS() {
  if (document.getElementById("mpesa-modal-css")) return;
  var style = document.createElement("style");
  style.id  = "mpesa-modal-css";
  style.textContent = [
    "@keyframes mpesaFadeIn{from{opacity:0}to{opacity:1}}",
    "@keyframes mpesaSlideUp{from{opacity:0;transform:translateY(24px) scale(0.97)}to{opacity:1;transform:translateY(0) scale(1)}}",
    "@keyframes mpesaSpin{to{transform:rotate(360deg)}}",
    "@keyframes mpesaPulse{0%,100%{opacity:1}50%{opacity:0.5}}",

    ".mpesa-modal-wrap{position:fixed;inset:0;z-index:9999;background:rgba(8,8,8,0.82);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:20px;animation:mpesaFadeIn 0.2s ease-out;}",

    ".mpesa-modal{background:linear-gradient(180deg,#1C1C1C 0%,#161616 100%);border:1px solid rgba(255,255,255,0.08);border-radius:16px;width:100%;max-width:400px;position:relative;overflow:hidden;box-shadow:0 32px 80px rgba(0,0,0,0.5),0 0 0 1px rgba(255,255,255,0.04);animation:mpesaSlideUp 0.3s cubic-bezier(0.16,1,0.3,1);}",

    ".mpesa-close{position:absolute;top:14px;right:14px;width:28px;height:28px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.08);border:none;border-radius:50%;color:rgba(255,255,255,0.7);font-size:14px;cursor:pointer;line-height:1;z-index:10;transition:all 0.15s;}",
    ".mpesa-close:hover{background:rgba(255,255,255,0.16);color:#fff;transform:rotate(90deg);}",

    ".mpesa-header{background:linear-gradient(135deg,#00C853 0%,#00A651 60%,#008C44 100%);padding:28px 28px 24px;text-align:center;position:relative;overflow:hidden;}",
    ".mpesa-header::before{content:'';position:absolute;top:-50%;right:-20%;width:180px;height:180px;background:rgba(255,255,255,0.08);border-radius:50%;}",
    ".mpesa-header::after{content:'';position:absolute;bottom:-60%;left:-10%;width:140px;height:140px;background:rgba(255,255,255,0.06);border-radius:50%;}",
    ".mpesa-logo{font-size:20px;font-weight:800;color:#fff;letter-spacing:0.08em;margin-bottom:10px;position:relative;font-family:-apple-system,'DM Sans',sans-serif;}",
    ".mpesa-plan-name{font-size:11px;color:rgba(255,255,255,0.78);margin-bottom:6px;position:relative;font-weight:500;letter-spacing:0.02em;}",
    ".mpesa-amount{font-size:26px;font-weight:700;color:#fff;position:relative;letter-spacing:-0.01em;}",

    ".mpesa-body{padding:26px 28px 22px;}",
    ".mpesa-step{}",
    ".mpesa-instruction{font-size:13px;color:#9A9A9A;margin-bottom:20px;line-height:1.65;text-align:center;}",

    ".mpesa-form-group{margin-bottom:16px;}",
    ".mpesa-label{display:block;font-size:10px;text-transform:uppercase;letter-spacing:0.1em;color:#777;margin-bottom:7px;font-weight:600;}",
    ".mpesa-input{width:100%;background:rgba(255,255,255,0.04);border:1.5px solid rgba(255,255,255,0.08);border-radius:10px;color:#EDEDED;font-size:15px;padding:13px 14px;outline:none;transition:all 0.15s;box-sizing:border-box;font-family:-apple-system,'DM Sans',sans-serif;}",
    ".mpesa-input:focus{border-color:#00A651;background:rgba(0,166,81,0.06);box-shadow:0 0 0 3px rgba(0,166,81,0.12);}",
    ".mpesa-input::placeholder{color:#555;}",
    ".mpesa-hint{font-size:11px;color:#666;margin-top:6px;line-height:1.4;}",

    ".mpesa-error{background:rgba(220,68,55,0.1);color:#F08070;border:1px solid rgba(220,68,55,0.25);border-radius:10px;padding:11px 14px;font-size:12.5px;margin-bottom:14px;line-height:1.5;animation:mpesaSlideUp 0.2s ease-out;}",

    ".mpesa-submit-btn{width:100%;background:linear-gradient(135deg,#00C853,#00A651);color:#fff;font-size:15px;font-weight:700;padding:15px;border:none;border-radius:11px;cursor:pointer;transition:all 0.18s;margin-bottom:14px;letter-spacing:0.01em;box-shadow:0 4px 14px rgba(0,166,81,0.3);}",
    ".mpesa-submit-btn:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 6px 20px rgba(0,166,81,0.4);}",
    ".mpesa-submit-btn:active:not(:disabled){transform:translateY(0);}",
    ".mpesa-submit-btn:disabled{background:#2A2A2A;color:#666;cursor:default;box-shadow:none;}",

    ".mpesa-secure{font-size:11px;color:#666;text-align:center;display:flex;align-items:center;justify-content:center;gap:5px;}",

    ".mpesa-pending-icon{font-size:46px;text-align:center;margin-bottom:14px;animation:mpesaPulse 2s ease-in-out infinite;}",
    ".mpesa-pending-title{font-size:21px;font-weight:700;color:#F5F5F5;text-align:center;margin-bottom:12px;letter-spacing:-0.01em;}",
    ".mpesa-pending-msg{font-size:13.5px;color:#ABABAB;text-align:center;margin-bottom:8px;line-height:1.65;}",
    ".mpesa-pending-msg strong{color:#00C853;}",

    ".mpesa-polling{display:flex;align-items:center;justify-content:center;gap:11px;margin:22px 0 6px;color:#999;font-size:13px;background:rgba(255,255,255,0.03);border-radius:10px;padding:13px;}",
    ".mpesa-spinner{width:18px;height:18px;border:2.5px solid rgba(0,166,81,0.2);border-top-color:#00A651;border-radius:50%;animation:mpesaSpin 0.8s linear infinite;flex-shrink:0;}",

    ".mpesa-manual-btn{width:100%;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:#C0C0C0;font-size:13px;padding:12px;border-radius:10px;cursor:pointer;margin-top:10px;transition:all 0.15s;}",
    ".mpesa-manual-btn:hover{background:rgba(255,255,255,0.08);border-color:rgba(255,255,255,0.16);}",

    ".mpesa-footer{padding:14px 28px;border-top:1px solid rgba(255,255,255,0.06);font-size:11.5px;color:#666;text-align:center;}",
    ".mpesa-footer a{color:#C9A84C;text-decoration:none;}",
    ".mpesa-footer a:hover{text-decoration:underline;}",

    ".hidden{display:none!important;}",

    "@media (max-width:420px){.mpesa-modal{max-width:100%;border-radius:16px;}.mpesa-header{padding:24px 22px 20px;}.mpesa-body{padding:22px 22px 18px;}}"
  ].join("");
  document.head.appendChild(style);
})();

// ── Generate unique transaction reference ─────────────────────
function mpesaTxRef(planId) {
  var ts   = Date.now().toString(36).toUpperCase();
  var rand = Math.random().toString(36).substr(2,4).toUpperCase();
  return "ORC-" + planId.toUpperCase().charAt(0) + "-" + ts + "-" + rand;
}

// ── Show M-PESA payment form modal ───────────────────────────
function showMpesaForm(planId) {
  var plan = MPESA_PLANS[planId];
  if (!plan) return;

  var old = document.getElementById("mpesaModal");
  if (old) old.remove();

  var modal = document.createElement("div");
  modal.id  = "mpesaModal";
  modal.className = "mpesa-modal-wrap";
  modal.innerHTML =
    '<div class="mpesa-modal">' +
      '<button class="mpesa-close" id="mpesaClose">✕</button>' +
      '<div class="mpesa-header">' +
        '<div class="mpesa-logo">M-PESA</div>' +
        '<div class="mpesa-plan-name">' + plan.label + '</div>' +
        '<div class="mpesa-amount">KES ' + plan.amount.toLocaleString() + ' / ' + plan.period + '</div>' +
      '</div>' +
      '<div class="mpesa-body" id="mpesaBody">' +
        '<div class="mpesa-step" id="mpesaStepForm">' +
          '<p class="mpesa-instruction">Enter your details below. You will receive an M-PESA payment request on your phone.</p>' +
          '<div class="mpesa-form-group">' +
            '<label class="mpesa-label">Email address</label>' +
            '<input type="email" id="mpesaEmail" class="mpesa-input" placeholder="your@email.com" />' +
            '<p class="mpesa-hint">Your access token will be sent here</p>' +
          '</div>' +
          '<div class="mpesa-form-group">' +
            '<label class="mpesa-label">M-PESA phone number</label>' +
            '<input type="tel" id="mpesaPhone" class="mpesa-input" placeholder="07XXXXXXXX" />' +
            '<p class="mpesa-hint">Must be registered for M-PESA</p>' +
          '</div>' +
          '<div id="mpesaFormError" class="mpesa-error hidden"></div>' +
          '<button id="mpesaSubmit" class="mpesa-submit-btn">' +
            'Send M-PESA Request — KES ' + plan.amount.toLocaleString() +
          '</button>' +
          '<p class="mpesa-secure">🔒 Secured by Safaricom M-PESA</p>' +
        '</div>' +

        '<div class="mpesa-step hidden" id="mpesaStepPending">' +
          '<div class="mpesa-pending-icon">📱</div>' +
          '<div class="mpesa-pending-title">Check your phone</div>' +
          '<p class="mpesa-pending-msg">We have sent an M-PESA payment request to <strong id="mpesaDisplayPhone"></strong>.</p>' +
          '<p class="mpesa-pending-msg">Enter your M-PESA PIN to complete payment.</p>' +
          '<div class="mpesa-polling">' +
            '<div class="mpesa-spinner"></div>' +
            '<span id="mpesaPollingMsg">Waiting for payment confirmation…</span>' +
          '</div>' +
          '<div id="mpesaPollingError" class="mpesa-error hidden" style="margin-top:14px;"></div>' +
          '<button id="mpesaManualBtn" class="mpesa-manual-btn hidden">I have paid — send my token</button>' +
        '</div>' +
      '</div>' +
      '<div class="mpesa-footer">' +
        '<p>Having trouble? <a href="contact.html">Contact us</a> with your M-PESA transaction code.</p>' +
      '</div>' +
    '</div>';

  document.body.appendChild(modal);

  document.getElementById("mpesaClose").onclick = function () { modal.remove(); };
  modal.onclick = function (e) { if (e.target === modal) modal.remove(); };

  document.getElementById("mpesaEmail").addEventListener("keydown", function (e) {
    if (e.key === "Enter") document.getElementById("mpesaPhone").focus();
  });
  document.getElementById("mpesaPhone").addEventListener("keydown", function (e) {
    if (e.key === "Enter") document.getElementById("mpesaSubmit").click();
  });
  document.getElementById("mpesaSubmit").onclick = function () {
    submitMpesaPayment(planId);
  };
}

// ── Submit STK push request ────────────────────────────────────
function submitMpesaPayment(planId) {
  var plan     = MPESA_PLANS[planId];
  var email    = (document.getElementById("mpesaEmail").value || "").trim();
  var phone    = (document.getElementById("mpesaPhone").value || "").trim();
  var errorEl  = document.getElementById("mpesaFormError");
  var submitBtn = document.getElementById("mpesaSubmit");

  // Validate
  if (!email || !email.includes("@")) {
    showMpesaError(errorEl, "Please enter a valid email address.");
    return;
  }
  if (!phone || phone.length < 9) {
    showMpesaError(errorEl, "Please enter a valid M-PESA phone number.");
    return;
  }

  // Format phone to 254XXXXXXXXX
  var formattedPhone = phone;
  if (formattedPhone.startsWith("07") || formattedPhone.startsWith("01")) {
    formattedPhone = "254" + formattedPhone.slice(1);
  } else if (formattedPhone.startsWith("+254")) {
    formattedPhone = formattedPhone.slice(1);
  } else if (!formattedPhone.startsWith("254")) {
    formattedPhone = "254" + formattedPhone;
  }

  var txRef = mpesaTxRef(planId);

  // Disable button, show loading
  submitBtn.textContent = "Sending request…";
  submitBtn.disabled    = true;
  errorEl.classList.add("hidden");

  // Call Apps Script doPost to initiate STK push
  // Using application/x-www-form-urlencoded as Content-Type
  // because Apps Script doPost handles it more reliably than JSON
  fetch(API_URL, {
    method:  "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body:    JSON.stringify({
      action: "initiate_mpesa",
      phone:  formattedPhone,
      amount: plan.amount,
      email:  email,
      tier:   plan.period,
      txRef:  txRef
    })
  })
  .then(function (r) { return r.json(); })
  .then(function (result) {
    if (result.success) {
      document.getElementById("mpesaStepForm").classList.add("hidden");
      document.getElementById("mpesaStepPending").classList.remove("hidden");
      document.getElementById("mpesaDisplayPhone").textContent = phone;
      startPolling(txRef, email, planId);
    } else {
      submitBtn.textContent = "Send M-PESA Request — KES " + plan.amount.toLocaleString();
      submitBtn.disabled    = false;
      // Show the specific error from Daraja so you can diagnose
      var errMsg = result.error || "STK push failed.";
      // Common Daraja errors explained in plain English
      if (errMsg.indexOf("Invalid Access Token") > -1) {
        errMsg = "Daraja API error: Consumer Key or Secret is wrong. Check Apps Script.";
      } else if (errMsg.indexOf("Bad Request") > -1 || errMsg.indexOf("400") > -1) {
        errMsg = "Daraja error: Check your Till Number and Passkey in Apps Script.";
      } else if (errMsg.indexOf("Unauthorized") > -1 || errMsg.indexOf("401") > -1) {
        errMsg = "Daraja error: Consumer Key/Secret rejected. Verify on developer.safaricom.co.ke.";
      } else if (errMsg.indexOf("token") > -1) {
        errMsg = "Daraja token error: Your Consumer Key or Secret may be incorrect.";
      }
      showMpesaError(errorEl, errMsg);
    }
  })
  .catch(function (err) {
    console.error("M-PESA initiation error:", err);
    submitBtn.textContent = "Send M-PESA Request — KES " + plan.amount.toLocaleString();
    submitBtn.disabled    = false;
    showMpesaError(errorEl, "Network error. Check your internet connection and try again.");
  });
}

// ── Poll for payment confirmation ──────────────────────────────
// Polls Apps Script every 5 seconds for up to 2 minutes
function startPolling(txRef, email, planId) {
  var maxAttempts = 24; // 2 minutes at 5s intervals
  var attempts    = 0;
  var pollingMsg  = document.getElementById("mpesaPollingMsg");
  var pollingErr  = document.getElementById("mpesaPollingError");
  var manualBtn   = document.getElementById("mpesaManualBtn");

  var interval = setInterval(function () {
    attempts++;

    // Update polling message
    var secondsLeft = (maxAttempts - attempts) * 5;
    if (pollingMsg) {
      pollingMsg.textContent = "Waiting for payment confirmation… (" + secondsLeft + "s)";
    }

    // Check payment status
    fetch(API_URL + "?action=check_payment&txRef=" + encodeURIComponent(txRef))
      .then(function (r) { return r.json(); })
      .then(function (result) {
        if (result.status === "confirmed") {
          clearInterval(interval);
          // Payment confirmed — redirect to success page
          window.location.href =
            "payment-success.html?email=" + encodeURIComponent(email) +
            "&plan=" + encodeURIComponent(planId);

        } else if (result.status === "failed") {
          clearInterval(interval);
          if (pollingErr) {
            pollingErr.textContent = "Payment was not completed. Please try again.";
            pollingErr.classList.remove("hidden");
          }
          if (manualBtn) manualBtn.classList.remove("hidden");
        }
        // status "pending" or "not_found" → keep polling
      })
      .catch(function () { /* network error — keep polling */ });

    // Timeout after maxAttempts
    if (attempts >= maxAttempts) {
      clearInterval(interval);
      if (pollingMsg) pollingMsg.textContent = "Confirmation timed out.";
      if (pollingErr) {
        pollingErr.textContent =
          "We could not automatically confirm your payment. " +
          "If M-PESA deducted the amount, please contact us with your M-PESA code " +
          "and we will activate your token within 1 hour.";
        pollingErr.classList.remove("hidden");
      }
      if (manualBtn) {
        manualBtn.classList.remove("hidden");
        manualBtn.onclick = function () {
          window.location.href =
            "contact.html?subject=manual-token&email=" + encodeURIComponent(email) +
            "&plan=" + encodeURIComponent(planId) +
            "&ref=" + encodeURIComponent(txRef);
        };
      }
    }
  }, 5000); // poll every 5 seconds
}

// ── Error helper ──────────────────────────────────────────────
function showMpesaError(el, msg) {
  if (!el) return;
  el.textContent = "⚠ " + msg;
  el.classList.remove("hidden");
}