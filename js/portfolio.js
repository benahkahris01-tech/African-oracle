/* ═══════════════════════════════════════════════════════════════
   portfolio.js — Watchlist & Portfolio Tracker
   
   STORAGE: localStorage key "oracle_watchlist"
   Format: array of ticker strings e.g. ["SCOM","EQTY","ABG"]
   
   DATA: enriched from the same sessionStorage API cache
   shared across screener, stock pages, calendar and movers.
   
   Self-contained — has its own esc(), numOrNull(), getSignal()
   so it does not depend on app.js running any functions.
   Only uses API_URL variable declared in app.js.
═══════════════════════════════════════════════════════════════ */

var STORAGE_KEY  = "oracle_watchlist";   // localStorage — persists across sessions
var CACHE_KEY    = "oracle_data";        // sessionStorage — shared with screener
var CACHE_TTL    = 10 * 60 * 1000;      // 10 minutes
var allStocks    = [];                   // full stock universe from API
var watchlist    = [];                   // array of ticker strings

// ── Boot ──────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", function () {
  if (!document.getElementById("pfLoading")) return;

  // Load saved watchlist from localStorage
  try {
    var saved = localStorage.getItem(STORAGE_KEY);
    watchlist = saved ? JSON.parse(saved) : [];
    if (!Array.isArray(watchlist)) watchlist = [];
  } catch (e) {
    watchlist = [];
  }

  bindSearch();
  loadStockData();
});

// ── Load stock universe ───────────────────────────────────────
function loadStockData() {
  // Try sessionStorage cache first — instant if screener already loaded
  try {
    var cached = sessionStorage.getItem(CACHE_KEY);
    if (cached) {
      var parsed = JSON.parse(cached);
      if (parsed && parsed.ts && (Date.now() - parsed.ts < CACHE_TTL) && parsed.data) {
        allStocks = Array.isArray(parsed.data) ? parsed.data : [];
        onDataReady();
        return;
      }
    }
  } catch (e) { /* fall through to fetch */ }

  // Cache miss — fetch from API
  if (typeof API_URL === "undefined" ||
      !API_URL ||
      API_URL === "PASTE_YOUR_APPS_SCRIPT_URL_HERE") {
    showError("API URL not configured in js/app.js.");
    return;
  }

  fetch(API_URL)
    .then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then(function (json) {
      if (!json || !json.data) throw new Error("Empty response");
      allStocks = Array.isArray(json.data) ? json.data : [];

      // Store for other pages in this session
      try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({
          ts:   Date.now(),
          data: allStocks
        }));
      } catch (e) { /* storage full */ }

      onDataReady();
    })
    .catch(function (err) {
      console.error("portfolio.js fetch error:", err);
      showError("Could not load data: " + err.message);
    });
}

// ── Once data is loaded ───────────────────────────────────────
function onDataReady() {
  hide("pfLoading");

  // Check premium status
  var premium = (typeof isPremium === "function") && isPremium();

  // If not premium — show gate and stop
  if (!premium) {
    showPremiumGate();
    return;
  }

  // Premium user — show status bar
  if (typeof getPremiumInfo === "function") {
    var info = getPremiumInfo();
    if (info) {
      var bar = document.getElementById("pfPremiumBar");
      if (bar) {
        bar.innerHTML =
          '<div class="premium-status-bar">' +
            '<span class="premium-status-icon">◈</span>' +
            '<span class="premium-status-text">' +
              '<strong>Premium active</strong> · ' + info.tier + ' plan · ' +
              'Expires ' + info.expiry +
              ' · <span class="priority-badge">⚡ Live data</span>' +
            '</span>' +
            '<button class="premium-sign-out" onclick="premiumLogout()">Sign out</button>' +
          '</div>';
      }
    }
  }

  // Premium user — fetch priority (live) data bypassing 6hr cache
  if (typeof API_URL !== "undefined" && API_URL &&
      API_URL !== "PASTE_YOUR_APPS_SCRIPT_URL_HERE") {
    var token = "";
    try { token = localStorage.getItem("oracle_premium_token") || ""; } catch (e) {}
    if (token) {
      fetch(API_URL + "?action=priority&token=" + encodeURIComponent(token))
        .then(function (r) { return r.json(); })
        .then(function (json) {
          if (json && json.data && !json.error) {
            allStocks = Array.isArray(json.data) ? json.data : [];
          }
          renderWatchlist();
          renderAdvancedAnalytics();
        })
        .catch(function () {
          renderWatchlist();
          renderAdvancedAnalytics();
        });
      return;
    }
  }

  renderWatchlist();
  renderAdvancedAnalytics();
}

// ── Premium gate — shown to non-subscribers ───────────────────
function showPremiumGate() {
  hide("pfSummary");
  hide("pfTableWrap");
  hide("pfEmpty");

  var gateEl = document.getElementById("pfGate");
  if (!gateEl) {
    gateEl = document.createElement("div");
    gateEl.id = "pfGate";
    var content = document.querySelector(".pf-content");
    if (content) content.insertBefore(gateEl, content.firstChild);
  }

  gateEl.innerHTML =
    '<div class="premium-gate">' +
      '<div class="premium-gate-icon">◈</div>' +
      '<div class="premium-gate-title">Portfolio Tracker — Premium Feature</div>' +
      '<div class="premium-gate-desc">' +
        'Track your NSE and JSE watchlist with live prices, buy/watch/avoid signals, ' +
        'sector breakdown, weighted P/E, dividend income projection and CSV export. ' +
        'All premium. All updated daily.' +
      '</div>' +
      '<div class="premium-gate-price">' +
        '<div class="price-option">' +
          '<div class="price-amount">KES 500</div>' +
          '<div class="price-period">per month</div>' +
        '</div>' +
        '<div class="price-divider">or</div>' +
        '<div class="price-option featured">' +
          '<div class="price-amount">KES 4,500</div>' +
          '<div class="price-period">per year <span class="price-save">Save 25%</span></div>' +
        '</div>' +
      '</div>' +
      '<a href="premium.html" class="premium-gate-btn">View Premium Plans →</a>' +
      '<div class="premium-gate-token">' +
        '<p>Already subscribed? Enter your access token below.</p>' +
        '<div class="token-input-row">' +
          '<input type="text" id="pfTokenInput" class="token-input" ' +
                 'placeholder="ORC-XXXX-XXXX-XXXX-XXXX" />' +
          '<button id="pfTokenBtn" class="token-submit-btn">Verify</button>' +
        '</div>' +
        '<div id="pfTokenErr" class="token-error hidden"></div>' +
      '</div>' +
    '</div>';

  // Bind token entry
  document.getElementById("pfTokenBtn").addEventListener("click", function () {
    var token = document.getElementById("pfTokenInput").value.trim().toUpperCase();
    var err   = document.getElementById("pfTokenErr");
    if (!token) {
      err.textContent = "Please enter your token.";
      err.classList.remove("hidden");
      return;
    }
    this.textContent = "Verifying…";
    this.disabled    = true;
    err.classList.add("hidden");

    if (typeof verifyAndStore === "function") {
      verifyAndStore(token,
        function () { window.location.reload(); },
        function (msg) {
          document.getElementById("pfTokenBtn").textContent = "Verify";
          document.getElementById("pfTokenBtn").disabled    = false;
          err.textContent = "⚠ " + msg;
          err.classList.remove("hidden");
        }
      );
    }
  });
}

// ── Render the watchlist table and summary ────────────────────
function renderWatchlist() {
  var watchStocks = [];

  // Match watchlist tickers against full stock universe
  watchlist.forEach(function (ticker) {
    for (var i = 0; i < allStocks.length; i++) {
      if (allStocks[i].ticker === ticker) {
        watchStocks.push(allStocks[i]);
        break;
      }
    }
  });

  if (watchStocks.length === 0) {
    hide("pfSummary");
    hide("pfTableWrap");
    show("pfEmpty");
    return;
  }

  hide("pfEmpty");
  show("pfSummary");
  show("pfTableWrap");

  // ── Summary stats ─────────────────────────────────────────
  var totalPE = 0, peCount = 0;
  var totalDiv = 0, divCount = 0;
  var buyCount = 0, avoidCount = 0;

  watchStocks.forEach(function (s) {
    var pe  = numOrNull(s.pe);
    var div = numOrNull(s.divYield);
    var sig = getSignal(s);
    if (pe  !== null && pe  > 0) { totalPE  += pe;  peCount++;  }
    if (div !== null && div > 0) { totalDiv += div; divCount++; }
    if (sig === "buy")   buyCount++;
    if (sig === "avoid") avoidCount++;
  });

  setText("pfCount",      watchStocks.length);
  setText("pfAvgPE",      peCount  > 0 ? (totalPE  / peCount).toFixed(1)  + "x"  : "—");
  setText("pfAvgDiv",     divCount > 0 ? ((totalDiv / divCount) * 100).toFixed(1) + "%" : "—");
  setText("pfBuyCount",   buyCount);
  setText("pfAvoidCount", avoidCount);

  // ── Table rows ────────────────────────────────────────────
  var html = "";
  watchStocks.forEach(function (s) {
    var cur = s.currency || (s.country === "Kenya" ? "KES" : "ZAR");
    var sym = cur === "ZAR" ? "R" : "KES ";
    var pr  = numOrNull(s.price);
    var pe  = numOrNull(s.pe);
    var div = numOrNull(s.divYield);
    var gr  = numOrNull(s.earningsGrowth);
    var sig = getSignal(s);
    var href = "stock.html?ticker=" + encodeURIComponent(s.ticker) +
               "&country="          + encodeURIComponent(s.country);

    // Format helpers inline
    var priceStr = pr !== null && pr > 0
      ? sym + pr.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : '<span class="n-na">—</span>';

    var peStr = pe !== null && pe > 0
      ? '<span class="' + (pe < 10 ? "n-good" : pe <= 20 ? "" : "n-warn") + '">' + pe.toFixed(1) + '</span>'
      : '<span class="n-na">—</span>';

    var divStr = div !== null
      ? '<span class="' + (div >= 0.05 ? "n-good" : "") + '">' + (div * 100).toFixed(1) + '%</span>'
      : '<span class="n-na">—</span>';

    var grStr = gr !== null
      ? '<span class="' + (gr > 15 ? "n-good" : gr > 0 ? "" : "n-bad") + '">' + (gr > 0 ? "+" : "") + gr.toFixed(1) + '%</span>'
      : '<span class="n-na">—</span>';

    var moatMap = { "Wide":"badge-wide", "Narrow":"badge-narrow", "None":"badge-none" };
    var moatStr = s.moat
      ? '<span class="badge ' + (moatMap[s.moat]||"") + '">' + s.moat + '</span>'
      : '<span class="n-na">—</span>';

    var sigLabels  = { buy:"● Buy", watch:"◐ Watch", avoid:"○ Avoid", neutral:"– Neutral" };
    var sigClasses = { buy:"signal-buy", watch:"signal-watch", avoid:"signal-avoid", neutral:"signal-neutral" };
    var sigStr = '<span class="signal ' + (sigClasses[sig]||"") + '">' + (sigLabels[sig]||"") + '</span>';

    var exchBadge = s.country === "Kenya"
      ? '<span class="cell-exch exch-nse">NSE</span>'
      : '<span class="cell-exch exch-jse">JSE</span>';

    html +=
      '<tr data-href="' + href + '">' +
        '<td><span class="cell-ticker">' + esc(s.ticker) + '</span></td>' +
        '<td><span class="cell-name" title="' + esc(s.name) + '">' + esc(s.name) + '</span></td>' +
        '<td>' + exchBadge + '</td>' +
        '<td class="num-col">' + priceStr + '</td>' +
        '<td class="num-col">' + peStr    + '</td>' +
        '<td class="num-col">' + divStr   + '</td>' +
        '<td class="num-col">' + grStr    + '</td>' +
        '<td>' + moatStr + '</td>' +
        '<td>' + sigStr  + '</td>' +
        '<td><button class="pf-remove-btn" data-ticker="' + esc(s.ticker) + '" title="Remove from watchlist">✕</button></td>' +
      '</tr>';
  });

  var tbody = document.getElementById("pfTableBody");
  tbody.innerHTML = html;

  // Row click → stock detail page (but not when clicking remove button)
  tbody.onclick = function (e) {
    // If remove button clicked — remove from watchlist
    var removeBtn = e.target.closest(".pf-remove-btn");
    if (removeBtn) {
      e.stopPropagation();
      removeFromWatchlist(removeBtn.dataset.ticker);
      return;
    }
    // Otherwise navigate to stock detail
    var tr = e.target.closest("tr[data-href]");
    if (tr) window.location.href = tr.dataset.href;
  };
}

// ── Search ────────────────────────────────────────────────────
function bindSearch() {
  var input   = document.getElementById("pfSearchInput");
  var results = document.getElementById("pfSearchResults");
  if (!input || !results) return;

  input.addEventListener("input", function () {
    var q = this.value.toLowerCase().trim();
    if (!q || q.length < 1) {
      results.classList.add("hidden");
      results.innerHTML = "";
      return;
    }

    var matches = allStocks.filter(function (s) {
      return s.ticker.toLowerCase().includes(q) ||
             s.name.toLowerCase().includes(q);
    }).slice(0, 8);

    if (matches.length === 0) {
      results.innerHTML = '<div class="pf-no-results">No companies found for "' + esc(q) + '"</div>';
      results.classList.remove("hidden");
      return;
    }

    var html = "";
    matches.forEach(function (s) {
      var cur      = s.currency || (s.country === "Kenya" ? "KES" : "ZAR");
      var sym      = cur === "ZAR" ? "R" : "KES ";
      var pr       = numOrNull(s.price);
      var priceStr = pr ? sym + pr.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—";
      var isAdded  = watchlist.indexOf(s.ticker) > -1;
      var exchBadge = s.country === "Kenya"
        ? '<span class="cell-exch exch-nse">NSE</span>'
        : '<span class="cell-exch exch-jse">JSE</span>';

      html +=
        '<div class="pf-result-item">' +
          '<div class="pf-result-left">' +
            '<div class="pf-result-ticker">' + esc(s.ticker) + ' ' + exchBadge + '</div>' +
            '<div class="pf-result-name">' + esc(s.name) + '</div>' +
          '</div>' +
          '<div class="pf-result-right">' +
            '<span style="font-family:var(--fm);font-size:11px;color:#C0C0C0;">' + priceStr + '</span>' +
            '<button class="pf-add-btn" data-ticker="' + esc(s.ticker) + '"' +
              (isAdded ? ' disabled' : '') + '>' +
              (isAdded ? '✓ Added' : '+ Add') +
            '</button>' +
          '</div>' +
        '</div>';
    });

    results.innerHTML = html;
    results.classList.remove("hidden");

    // Bind add buttons
    results.querySelectorAll(".pf-add-btn:not(:disabled)").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        addToWatchlist(this.dataset.ticker);
        this.textContent = "✓ Added";
        this.disabled = true;
      });
    });
  });

  // Hide results when clicking outside
  document.addEventListener("click", function (e) {
    if (!input.contains(e.target) && !results.contains(e.target)) {
      results.classList.add("hidden");
    }
  });
}

// ── Watchlist management ──────────────────────────────────────
function addToWatchlist(ticker) {
  if (watchlist.indexOf(ticker) > -1) return; // already in list
  watchlist.push(ticker);
  saveWatchlist();
  renderWatchlist();
}

function removeFromWatchlist(ticker) {
  watchlist = watchlist.filter(function (t) { return t !== ticker; });
  saveWatchlist();
  renderWatchlist();
}

function saveWatchlist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(watchlist));
  } catch (e) {
    console.warn("localStorage unavailable — watchlist will not persist:", e);
  }
}

// ── Advanced Analytics (Premium only) ────────────────────────
// Renders sector breakdown, weighted P/E, dividend income projection
// and CSV export button below the watchlist table
function renderAdvancedAnalytics() {
  // Only runs after renderWatchlist — get current watch stocks
  var watchStocks = [];
  watchlist.forEach(function (ticker) {
    for (var i = 0; i < allStocks.length; i++) {
      if (allStocks[i].ticker === ticker) { watchStocks.push(allStocks[i]); break; }
    }
  });

  var container = document.getElementById("pfAnalyticsWrap");
  if (!container) return;

  if (watchStocks.length === 0) {
    container.innerHTML = "";
    return;
  }

  // ── Sector breakdown ─────────────────────────────────────
  var sectors = {};
  watchStocks.forEach(function (s) {
    var sec = s.sector || "Unknown";
    sectors[sec] = (sectors[sec] || 0) + 1;
  });
  var total = watchStocks.length;
  var sectorEntries = Object.keys(sectors).map(function (k) {
    return { name: k, count: sectors[k], pct: Math.round((sectors[k] / total) * 100) };
  }).sort(function (a, b) { return b.count - a.count; });

  var sectorBarsHtml = sectorEntries.map(function (s) {
    return '<div class="sector-bar-row">' +
      '<div class="sector-bar-label">' + esc(s.name) + '</div>' +
      '<div class="sector-bar-track"><div class="sector-bar-fill" style="width:' + s.pct + '%"></div></div>' +
      '<div class="sector-bar-pct">' + s.pct + '%</div>' +
    '</div>';
  }).join("");

  // ── Weighted P/E ─────────────────────────────────────────
  var totalPE = 0, peCount = 0;
  var totalDiv = 0, divCount = 0;
  var annualDivIncome = 0; // KES or ZAR — mixed, shown per stock

  watchStocks.forEach(function (s) {
    var pe  = numOrNull(s.pe);
    var div = numOrNull(s.divYield);
    var pr  = numOrNull(s.price);

    if (pe  !== null && pe  > 0) { totalPE  += pe;  peCount++;  }
    if (div !== null && div > 0 && pr !== null && pr > 0) {
      // Estimate annual dividend income per 1000 units of local currency invested
      // div is decimal (0.045 = 4.5%), income = 1000 * div
      annualDivIncome += 1000 * div;
      totalDiv += div;
      divCount++;
    }
  });

  var weightedPE  = peCount  > 0 ? (totalPE  / peCount).toFixed(1)  : "—";
  var avgYield    = divCount > 0 ? ((totalDiv / divCount) * 100).toFixed(1) + "%" : "—";
  var projIncome  = divCount > 0 ? (annualDivIncome / divCount).toFixed(0) : "—";

  // ── Exchange split ────────────────────────────────────────
  var nseCount = watchStocks.filter(function (s) { return s.country === "Kenya"; }).length;
  var jseCount = watchStocks.length - nseCount;

  // ── Render ────────────────────────────────────────────────
  container.innerHTML =
    '<div class="prem-analytics-section">' +
      '<div class="prem-analytics-header">' +
        '<span style="color:var(--gold);font-size:16px;">◈</span>' +
        '<div class="prem-analytics-title">Advanced Portfolio Analytics</div>' +
        '<span class="priority-badge">⚡ Premium</span>' +
      '</div>' +
      '<div class="prem-analytics-body">' +

        // Summary cards
        '<div class="analytics-cards">' +
          '<div class="analytics-card">' +
            '<div class="analytics-card-label">Weighted Avg P/E</div>' +
            '<div class="analytics-card-value">' + weightedPE + (weightedPE !== "—" ? "x" : "") + '</div>' +
            '<div class="analytics-card-sub">Across portfolio</div>' +
          '</div>' +
          '<div class="analytics-card">' +
            '<div class="analytics-card-label">Avg Dividend Yield</div>' +
            '<div class="analytics-card-value">' + avgYield + '</div>' +
            '<div class="analytics-card-sub">Paying stocks only</div>' +
          '</div>' +
          '<div class="analytics-card">' +
            '<div class="analytics-card-label">Est. Annual Income</div>' +
            '<div class="analytics-card-value">' + (projIncome !== "—" ? projIncome + "%" : "—") + '</div>' +
            '<div class="analytics-card-sub">Per 100 invested</div>' +
          '</div>' +
          '<div class="analytics-card">' +
            '<div class="analytics-card-label">NSE / JSE Split</div>' +
            '<div class="analytics-card-value">' + nseCount + ' / ' + jseCount + '</div>' +
            '<div class="analytics-card-sub">Holdings by exchange</div>' +
          '</div>' +
        '</div>' +

        // Sector breakdown
        '<div class="sector-breakdown">' +
          '<div class="sector-breakdown-title">Sector Allocation</div>' +
          sectorBarsHtml +
        '</div>' +

        // CSV export
        '<button class="csv-export-btn" id="pfCsvBtn">' +
          '↓ Export Watchlist to CSV' +
        '</button>' +

      '</div>' +
    '</div>';

  // Bind CSV export
  document.getElementById("pfCsvBtn").addEventListener("click", function () {
    exportCSV(watchStocks);
  });
}

// ── CSV Export ────────────────────────────────────────────────
function exportCSV(stocks) {
  var headers = ["Ticker","Company","Exchange","Country","Price","Currency",
    "P/E","PEG","EPS Growth %","Div Yield %","Debt/Equity",
    "Init Margin %","Final Margin %","Moat","Fin Strength","Predictability",
    "Intrinsic Value","Signal"];

  var rows = stocks.map(function (s) {
    var sig = getSignal(s);
    function fmt(v,dp) {
      var n = parseFloat(v); return isNaN(n) ? "" : n.toFixed(dp||2);
    }
    function fmtPct(v) {
      var n = parseFloat(v); return isNaN(n) ? "" : (n*100).toFixed(1);
    }
    return [
      s.ticker, s.name,
      s.country === "Kenya" ? "NSE" : "JSE",
      s.country,
      fmt(s.price,2), s.currency || "",
      fmt(s.pe,1), fmt(s.peg,2),
      fmt(s.earningsGrowth,1),
      fmtPct(s.divYield),
      fmt(s.debtEquity,2),
      fmtPct(s.initMargin),
      fmtPct(s.finalMargin),
      s.moat || "", s.finStrength || "", s.predictability || "",
      fmt(s.intrinsicValue,0),
      sig
    ].map(function (v) {
      // Wrap in quotes if contains comma
      return String(v).indexOf(",") > -1 ? '"' + v + '"' : v;
    });
  });

  var csv = [headers].concat(rows).map(function (r) { return r.join(","); }).join("\n");
  var blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement("a");
  a.href      = url;
  a.download  = "african-oracle-watchlist-" + new Date().toISOString().slice(0,10) + ".csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Signal logic ──────────────────────────────────────────────
function getSignal(s) {
  var pe   = numOrNull(s.pe);
  var peg  = numOrNull(s.peg);
  var gr   = numOrNull(s.earningsGrowth);
  var div  = numOrNull(s.divYield);
  var moat = s.moat        || "";
  var str  = s.finStrength || "";

  if (pe !== null && pe <= 0)            return "avoid";
  if (str === "Weak" && moat === "None") return "avoid";
  if (gr  !== null && gr < -5)           return "avoid";

  var score = 0;
  if (moat === "Wide")                         score += 2;
  if (moat === "Narrow")                       score += 1;
  if (str  === "Strong")                       score += 2;
  if (str  === "Adequate")                     score += 1;
  if (peg  !== null && peg > 0 && peg < 1)    score += 2;
  if (pe   !== null && pe  > 0 && pe  < 12)   score += 2;
  if (pe   !== null && pe  >= 12 && pe < 20)  score += 1;
  if (gr   !== null && gr  > 15)              score += 2;
  if (gr   !== null && gr  > 5)               score += 1;
  if (div  !== null && div > 0.05)            score += 1;

  if (score >= 7) return "buy";
  if (score >= 4) return "watch";
  if (score >= 1) return "neutral";
  return "avoid";
}

// ── Utilities ─────────────────────────────────────────────────
function numOrNull(v) { var n = parseFloat(v); return isNaN(n) ? null : n; }
function esc(s) {
  return String(s || "")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
function show(id)      { var el = document.getElementById(id); if (el) el.classList.remove("hidden"); }
function hide(id)      { var el = document.getElementById(id); if (el) el.classList.add("hidden"); }
function setText(id,v) { var el = document.getElementById(id); if (el) el.textContent = v; }

function showError(msg) {
  hide("pfLoading");
  console.error("portfolio.js:", msg);
  var el = document.getElementById("pfEmpty");
  if (el) {
    el.innerHTML =
      '<div class="pf-empty-icon">⚠</div>' +
      '<h2>Could not load market data</h2>' +
      '<p>' + esc(msg) + '</p>';
    el.classList.remove("hidden");
  }
}