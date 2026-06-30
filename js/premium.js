/* ═══════════════════════════════════════════════════════════════
   premium.js — Shared Premium Gate Module
   
   Load this on every page that has premium features.
   It exposes:
     isPremium()              → true/false
     getPremiumInfo()         → { email, tier, expiry, daysLeft }
     requirePremium(el, msg)  → shows lock overlay if not premium
     verifyAndStore(token, onSuccess, onError)
     showTokenModal()         → shows token entry popup
     premiumLogout()          → clears session
   
   STORAGE:
     localStorage   "oracle_premium_token"   — persists across sessions
     sessionStorage "oracle_premium_session" — 30min cache avoids API call
═══════════════════════════════════════════════════════════════ */

var PREMIUM_TOKEN_KEY   = "oracle_premium_token";
var PREMIUM_SESSION_KEY = "oracle_premium_session";
var PREMIUM_SESSION_TTL = 30 * 60 * 1000; // 30 minutes

var _premiumSession = null;

// ── Auto-init on load ─────────────────────────────────────────
// Wrapped in try-catch so ANY error here never blocks the rest
// of the page. On VS Code Live Server the fetch will fail with
// a CORS error — this must be silently swallowed, never crash.
(function initPremium() {
  try {
    // 1. Try 30-min session cache first — no network call needed
    var c = sessionStorage.getItem(PREMIUM_SESSION_KEY);
    if (c) {
      var p = JSON.parse(c);
      if (p && p.ts && (Date.now() - p.ts < PREMIUM_SESSION_TTL) && p.valid) {
        _premiumSession = p;
        return; // valid cache — done
      }
    }
  } catch (e) { /* sessionStorage unavailable — continue */ }

  try {
    // 2. Only attempt token validation if:
    //    a. We are NOT on localhost / Live Server (would get CORS error)
    //    b. API_URL is configured
    //    c. A token exists in localStorage
    var isLocalhost = (
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1" ||
      window.location.protocol === "file:"
    );

    if (isLocalhost) {
      // On Live Server — skip network call entirely
      // User can still verify tokens manually via the token form
      return;
    }

    var apiReady = (
      typeof API_URL !== "undefined" &&
      API_URL &&
      API_URL !== "PASTE_YOUR_APPS_SCRIPT_URL_HERE"
    );
    if (!apiReady) return;

    var t = null;
    try { t = localStorage.getItem(PREMIUM_TOKEN_KEY); } catch (e) {}
    if (t) _validateToken(t, false);

  } catch (e) {
    // Silent fail — never block page functionality
    console.log("premium.js init skipped:", e.message);
  }
})();

// ── Public functions ──────────────────────────────────────────

function isPremium() {
  return !!(_premiumSession && _premiumSession.valid);
}

function getPremiumInfo() {
  return isPremium() ? _premiumSession : null;
}

function verifyAndStore(token, onSuccess, onError) {
  token = String(token || "").trim().toUpperCase();
  if (!token) { if (onError) onError("Please enter your token."); return; }
  _validateToken(token, true, onSuccess, onError);
}

function premiumLogout() {
  try { localStorage.removeItem(PREMIUM_TOKEN_KEY); } catch (e) {}
  try { sessionStorage.removeItem(PREMIUM_SESSION_KEY); } catch (e) {}
  _premiumSession = null;
  window.location.reload();
}

// Wraps a DOM element with a blurred lock overlay if user is not premium
function requirePremium(el, msg) {
  if (isPremium() || !el) return;
  var message = msg || "Subscribe to The African Oracle Premium to access this feature.";

  var overlay = document.createElement("div");
  overlay.className = "prem-lock-overlay";
  overlay.innerHTML =
    '<div class="prem-lock-box">' +
      '<div class="prem-lock-icon">◈</div>' +
      '<div class="prem-lock-title">Premium Feature</div>' +
      '<p class="prem-lock-msg">' + _escP(message) + '</p>' +
      '<a href="premium.html" class="prem-lock-btn">View Plans →</a>' +
      '<div class="prem-lock-sub">' +
        'Already subscribed? <a href="#" class="prem-enter-link">Enter your token</a>' +
      '</div>' +
    '</div>';

  el.style.position = "relative";
  el.style.minHeight = "180px";
  el.appendChild(overlay);

  overlay.querySelector(".prem-enter-link").addEventListener("click", function (e) {
    e.preventDefault();
    showTokenModal();
  });
}

// Shows the token entry modal — can be triggered from anywhere
function showTokenModal() {
  var old = document.getElementById("premModal");
  if (old) old.remove();

  var m = document.createElement("div");
  m.id = "premModal";
  m.className = "prem-modal-wrap";
  m.innerHTML =
    '<div class="prem-modal">' +
      '<div class="prem-modal-title">Enter your access token</div>' +
      '<p class="prem-modal-desc">Your token was emailed after subscribing.<br/>' +
        'Format: <code style="color:var(--gold-light)">ORC-XXXX-XXXX-XXXX-XXXX</code></p>' +
      '<input id="premTokenInput" class="prem-token-input" type="text" ' +
             'placeholder="ORC-XXXX-XXXX-XXXX-XXXX" autocomplete="off" />' +
      '<div id="premTokenErr" class="prem-token-err hidden"></div>' +
      '<div class="prem-modal-actions">' +
        '<button id="premTokenOk"  class="prem-ok-btn">Verify</button>' +
        '<button id="premTokenX"   class="prem-cancel-btn">Cancel</button>' +
      '</div>' +
      '<div class="prem-modal-foot">No token? <a href="premium.html">Subscribe →</a></div>' +
    '</div>';

  document.body.appendChild(m);

  var inp = document.getElementById("premTokenInput");
  var err = document.getElementById("premTokenErr");
  var ok  = document.getElementById("premTokenOk");

  inp.focus();

  document.getElementById("premTokenX").onclick = function () { m.remove(); };
  m.onclick = function (e) { if (e.target === m) m.remove(); };

  ok.onclick = function () {
    var token = inp.value.trim().toUpperCase();
    if (!token) { _showErr(err, "Please enter your token."); return; }
    ok.textContent = "Verifying…";
    ok.disabled = true;
    err.classList.add("hidden");

    verifyAndStore(token,
      function () { m.remove(); window.location.reload(); },
      function (msg) {
        ok.textContent = "Verify";
        ok.disabled = false;
        _showErr(err, msg);
      }
    );
  };

  inp.onkeydown = function (e) { if (e.key === "Enter") ok.click(); };
}

// ── Internal ──────────────────────────────────────────────────
function _validateToken(token, store, onSuccess, onError) {
  // Guard: API must be configured
  if (typeof API_URL === "undefined" || !API_URL ||
      API_URL === "PASTE_YOUR_APPS_SCRIPT_URL_HERE") {
    if (onError) onError("API not configured.");
    return;
  }

  // Guard: do not attempt fetch on localhost — will CORS fail
  var isLocalhost = (
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1" ||
    window.location.protocol === "file:"
  );
  if (isLocalhost) {
    if (onError) onError(
      "Token verification does not work on localhost. " +
      "Push to your live site at africanoracle.info and verify there."
    );
    return;
  }

  try {
    fetch(API_URL + "?action=verify&token=" + encodeURIComponent(token))
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (res.valid) {
          _premiumSession = {
            valid:    true,
            email:    res.email    || "",
            tier:     res.tier     || "monthly",
            expiry:   res.expiry   || "",
            daysLeft: res.daysLeft || 0,
            ts:       Date.now()
          };
          if (store) {
            try { localStorage.setItem(PREMIUM_TOKEN_KEY, token); } catch (e) {}
          }
          try {
            sessionStorage.setItem(PREMIUM_SESSION_KEY, JSON.stringify(_premiumSession));
          } catch (e) {}
          if (onSuccess) onSuccess(_premiumSession);
        } else {
          _premiumSession = { valid: false };
          if (store) {
            try { localStorage.removeItem(PREMIUM_TOKEN_KEY); } catch (e) {}
            try { sessionStorage.removeItem(PREMIUM_SESSION_KEY); } catch (e) {}
          }
          if (onError) onError(res.reason || "Invalid token.");
        }
      })
      .catch(function (e) {
        console.error("premium.js fetch error:", e);
        if (onError) onError("Network error — please check your connection.");
      });
  } catch (e) {
    console.error("premium.js _validateToken error:", e);
    if (onError) onError("Unexpected error: " + e.message);
  }
}

function _showErr(el, msg) {
  el.textContent = "⚠ " + msg;
  el.classList.remove("hidden");
}

function _escP(s) {
  return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}