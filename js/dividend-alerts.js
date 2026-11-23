/* ═══════════════════════════════════════════════════════════════
   dividend-alerts.js — Dividend alerts inside the Portfolio Tracker
   PREMIUM ONLY: portfolio.js calls renderDividendAlerts() only for premium users.

   DATA   : Supabase table dividend_calendar (public dividend dates).
   MATCH  : done in the browser against the user's watchlist (localStorage
            "oracle_watchlist"). Nothing about the user is sent anywhere.
   SHARES : optional, stored only in this browser (localStorage "oracle_shares",
            e.g. {"KCB":500}). With shares entered, an alert shows the payout.
   ALERTS : (1) "Declared"  — declared in the last 14 days, books not yet closed
            (2) "Books close" — books closure is today or within the next 7 days
   Depends on (already on the page): SUPABASE_URL, SUPABASE_ANON_KEY (app.js),
   and the globals watchlist / allStocks (portfolio.js).
═══════════════════════════════════════════════════════════════ */

var DA_NEW_DAYS     = 14;
var DA_CLOSING_DAYS = 7;
var DA_SHARES_KEY   = "oracle_shares";

function da_esc(s) {
  return String(s === null || s === undefined ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function da_parseDate(s) {                 // "2026-05-20" -> local Date at midnight
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || ""));
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
}
function da_daysBetween(from, to) { return Math.round((to - from) / 86400000); }
function da_fmtDate(d) {
  return d ? d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";
}
function da_loadShares() {
  try {
    var o = JSON.parse(localStorage.getItem(DA_SHARES_KEY) || "{}");
    return (o && typeof o === "object" && !Array.isArray(o)) ? o : {};
  } catch (e) { return {}; }
}
function da_saveShares(o) {
  try { localStorage.setItem(DA_SHARES_KEY, JSON.stringify(o)); } catch (e) {}
}

// Pure function (easy to test): which dividend rows should alert this watchlist today?
function da_buildAlerts(rows, tickers, stocks, today) {
  var exchOf = {};
  (stocks || []).forEach(function (s) { exchOf[s.ticker] = (s.country === "Kenya") ? "NSE" : "JSE"; });
  var out = [];
  (rows || []).forEach(function (r) {
    if (tickers.indexOf(r.ticker) === -1) return;
    if (exchOf[r.ticker] && exchOf[r.ticker] !== r.exchange) return;   // same ticker, other exchange
    var closure = da_parseDate(r.books_closure_date);
    if (!closure) return;
    var daysToClose = da_daysBetween(today, closure);
    if (daysToClose < 0) return;                                        // books already closed
    var declared = da_parseDate(r.declared_date);
    var sinceDeclared = declared ? da_daysBetween(declared, today) : null;
    var isNew = sinceDeclared !== null && sinceDeclared >= 0 && sinceDeclared <= DA_NEW_DAYS;
    var isClosing = daysToClose <= DA_CLOSING_DAYS;
    if (!isNew && !isClosing) return;
    out.push({ row: r, closure: closure, payment: da_parseDate(r.payment_date), daysToClose: daysToClose,
               isNew: isNew, isClosing: isClosing });
  });
  out.sort(function (a, b) { return a.closure - b.closure; });
  return out;
}

function da_injectStyles() {
  if (document.getElementById("daStyles")) return;
  var st = document.createElement("style");
  st.id = "daStyles";
  st.textContent =
    ".da-row{display:flex;gap:12px;align-items:flex-start;padding:12px 0;border-bottom:1px solid rgba(255,255,255,.08)}" +
    ".da-row:last-child{border-bottom:0}" +
    ".da-tick{font-family:var(--fm,monospace);font-weight:500;min-width:64px}" +
    ".da-main{flex:1;font-size:13px;line-height:1.5}" +
    ".da-tag{display:inline-block;font-size:10px;letter-spacing:.04em;text-transform:uppercase;padding:2px 7px;border-radius:10px;margin-right:6px;border:1px solid currentColor}" +
    ".da-new{color:var(--gold,#C9A84C)}.da-close{color:var(--amber,#E0A030)}" +
    ".da-payout{font-family:var(--fm,monospace);white-space:nowrap}" +
    ".da-empty{font-size:13px;opacity:.8;padding:6px 0}" +
    ".da-shares{margin-top:14px;font-size:12px}" +
    ".da-shares summary{cursor:pointer;opacity:.85}" +
    ".da-shares-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px;margin-top:10px}" +
    ".da-shares-grid label{display:flex;justify-content:space-between;align-items:center;gap:6px}" +
    ".da-shares-grid input{width:80px;padding:4px 6px;background:transparent;color:inherit;border:1px solid rgba(255,255,255,.25);border-radius:4px;font-family:var(--fm,monospace)}";
  document.head.appendChild(st);
}

function da_render(container, alerts) {
  var shares = da_loadShares();
  var html = "";
  if (!alerts.length) {
    html += '<div class="da-empty">No dividend alerts for your watchlist right now. ' +
            'You will see a message here when a company you track declares a dividend, ' +
            'and in the week before its books close.</div>';
  }
  alerts.forEach(function (a) {
    var r = a.row, cur = r.currency || (r.exchange === "NSE" ? "KES" : "ZAR");
    var tags = "";
    if (a.isNew) tags += '<span class="da-tag da-new">Declared</span>';
    if (a.isClosing) tags += '<span class="da-tag da-close">' +
      (a.daysToClose === 0 ? "Books close today" : a.daysToClose === 1 ? "Books close tomorrow" : "Books close in " + a.daysToClose + " days") + '</span>';
    var dpsStr = (r.dps !== null && r.dps !== undefined) ? da_esc(cur) + " " + Number(r.dps).toFixed(2) + " per share" : "Amount to be confirmed";
    var typeStr = r.dividend_type ? da_esc(r.dividend_type) + " dividend" : "Dividend";
    var fy = r.financial_year ? " · " + da_esc(r.financial_year) : "";
    var qty = parseFloat(shares[r.ticker]);
    var payout = (qty > 0 && r.dps > 0)
      ? '<div class="da-payout">' + da_esc(cur) + " " + (qty * r.dps).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) +
        '<div style="font-size:11px;opacity:.7">on ' + qty.toLocaleString() + ' shares</div></div>'
      : "";
    html += '<div class="da-row">' +
      '<div class="da-tick">' + da_esc(r.ticker) + '</div>' +
      '<div class="da-main">' + tags + '<strong>' + typeStr + '</strong>' + fy + ' — ' + dpsStr +
        '<div style="opacity:.8">Last day to be on the register: <strong>' + da_fmtDate(a.closure) + '</strong>' +
        (a.payment ? ' · Payment: ' + da_fmtDate(a.payment) : '') + '</div>' +
        (r.notes ? '<div style="opacity:.7;font-size:12px">' + da_esc(r.notes) + '</div>' : '') +
      '</div>' + payout + '</div>';
  });

  // Optional shares editor (only for tickers on the watchlist)
  var inputs = "";
  (watchlist || []).forEach(function (t) {
    inputs += '<label>' + da_esc(t) + '<input type="number" min="0" step="1" inputmode="numeric" data-t="' + da_esc(t) + '" value="' +
              (shares[t] ? da_esc(shares[t]) : "") + '" placeholder="shares" /></label>';
  });
  if (inputs) {
    html += '<details class="da-shares"><summary>Add the number of shares you hold to see expected payouts (saved only in this browser)</summary>' +
            '<div class="da-shares-grid">' + inputs + '</div></details>';
  }

  container.innerHTML =
    '<div class="prem-analytics-section">' +
      '<div class="prem-analytics-header">' +
        '<span style="color:var(--gold);font-size:16px;">◈</span>' +
        '<div class="prem-analytics-title">Dividend Alerts</div>' +
        '<span class="priority-badge">⚡ Premium</span>' +
      '</div>' +
      '<div class="prem-analytics-body">' + html + '</div>' +
    '</div>';

  var grid = container.querySelector(".da-shares-grid");
  if (grid) grid.addEventListener("change", function (e) {
    var inp = e.target;
    if (!inp || !inp.dataset || !inp.dataset.t) return;
    var s = da_loadShares(), v = parseFloat(inp.value);
    if (v > 0) s[inp.dataset.t] = v; else delete s[inp.dataset.t];
    da_saveShares(s);
    da_render(container, alerts);                 // refresh payouts (keeps the editor open below)
    var d = container.querySelector(".da-shares"); if (d) d.open = true;
  });
}

// Called by portfolio.js for premium users only.
function renderDividendAlerts() {
  var container = document.getElementById("pfAlertsWrap");
  if (!container) return;
  if (!watchlist || !watchlist.length) { container.innerHTML = ""; return; }
  if (typeof SUPABASE_URL === "undefined" || !SUPABASE_URL || typeof SUPABASE_ANON_KEY === "undefined" || !SUPABASE_ANON_KEY) return;
  da_injectStyles();

  var now = new Date(), today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  var iso = today.getFullYear() + "-" + String(today.getMonth() + 1).padStart(2, "0") + "-" + String(today.getDate()).padStart(2, "0");

  fetch(SUPABASE_URL + "/rest/v1/dividend_calendar?select=*&books_closure_date=gte." + iso + "&order=books_closure_date.asc", {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: "Bearer " + SUPABASE_ANON_KEY }
  })
    .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
    .then(function (rows) {
      da_render(container, da_buildAlerts(Array.isArray(rows) ? rows : [], watchlist, allStocks, today));
    })
    .catch(function (err) { console.warn("dividend-alerts:", err); });   // fail quietly: the tracker still works
}