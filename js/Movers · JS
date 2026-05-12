/* ═══════════════════════════════════════════════════════════════
   movers.js — Top & Worst Performers page
   Self-contained. Uses API_URL from app.js (loaded first).
   Uses sessionStorage cache shared with app.js and stock.js
   so data is never fetched twice in the same session.
═══════════════════════════════════════════════════════════════ */

// How many rows to show per table
var ROWS_PER_TABLE = 10;

// Current exchange filter — "all", "Kenya", "S. Africa"
var currentExchange = "all";

// Full dataset once loaded
var allData = [];

// ── Boot ──────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", function () {
  if (!document.getElementById("mvMain")) return;

  // Bind exchange toggle buttons
  document.querySelectorAll(".mv-toggle-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      document.querySelectorAll(".mv-toggle-btn").forEach(function (b) {
        b.classList.remove("active");
      });
      this.classList.add("active");
      currentExchange = this.dataset.exchange;
      renderAll(allData);
    });
  });

  loadData();
});

// ── Load data — shared sessionStorage cache ───────────────────
function loadData() {
  // API_URL declared in app.js which loads before this file
  if (typeof API_URL === "undefined" ||
      !API_URL ||
      API_URL === "https://script.google.com/macros/s/AKfycbzUDs26aD7RaaVDdL7rUAVRZ83XlDK9dfI9zFcx-SvZXZD_2rnJXdbGSF2fNFNe37GbxQ/exec") {
    showMvError("API URL not configured in js/app.js.");
    return;
  }

  // Check sessionStorage first — same key as screener and stock page
  var APP_VERSION = (typeof APP_VERSION !== "undefined") ? APP_VERSION : "1";
  var CACHE_KEY   = "oracle_data_" + APP_VERSION;
  var CACHE_TTL   = 10 * 60 * 1000; // 10 minutes

  try {
    var cached = sessionStorage.getItem(CACHE_KEY);
    if (cached) {
      var parsed = JSON.parse(cached);
      if (parsed && parsed.ts && (Date.now() - parsed.ts < CACHE_TTL) && parsed.data) {
        allData = parsed.data;
        renderAll(allData);
        return;
      }
    }
  } catch (e) { /* fall through */ }

  // Cache miss — fetch fresh
  fetch(API_URL)
    .then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then(function (json) {
      if (!json || !json.data) throw new Error("Empty API response");
      allData = Array.isArray(json.data) ? json.data : [];

      // Store for other pages in same session
      try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({
          ts:   Date.now(),
          data: allData
        }));
      } catch (e) { /* storage full */ }

      renderAll(allData);
    })
    .catch(function (err) {
      console.error("movers.js fetch error:", err);
      showMvError("Could not load data: " + err.message);
    });
}

// ── Render all seven tables ───────────────────────────────────
function renderAll(data) {
  // Filter by exchange if needed
  var pool = data.filter(function (s) {
    if (currentExchange === "all")       return true;
    if (currentExchange === "Kenya")     return s.country === "Kenya";
    if (currentExchange === "S. Africa") return s.country === "S. Africa";
    return true;
  });

  // Only include stocks with a valid price
  var withPrice = pool.filter(function (s) {
    return numOrNull(s.price) !== null && numOrNull(s.price) > 0;
  });

  // 1. Highest price
  renderTable(
    "topPriceBody",
    sortDesc(withPrice, "price").slice(0, ROWS_PER_TABLE),
    ["price", "pe", "divYield", "signal"]
  );

  // 2. Lowest price — only profitable companies (pe > 0) to avoid junk
  var profitable = withPrice.filter(function (s) {
    return numOrNull(s.pe) !== null && numOrNull(s.pe) > 0;
  });
  renderTable(
    "worstPriceBody",
    sortAsc(profitable, "price").slice(0, ROWS_PER_TABLE),
    ["price", "pe", "earningsGrowth", "signal"]
  );

  // 3. Highest dividend yield — only positive yields
  var withDiv = pool.filter(function (s) {
    var d = numOrNull(s.divYield);
    return d !== null && d > 0;
  });
  renderTable(
    "topDivBody",
    sortDesc(withDiv, "divYield").slice(0, ROWS_PER_TABLE),
    ["divYield", "price", "pe", "finStrength"]
  );

  // 4. Best EPS growth — only positive growth
  var withGrowth = pool.filter(function (s) {
    return numOrNull(s.earningsGrowth) !== null;
  });
  renderTable(
    "topGrowthBody",
    sortDesc(withGrowth, "earningsGrowth").slice(0, ROWS_PER_TABLE),
    ["earningsGrowth", "beginEps", "endEps", "moat"]
  );

  // 5. Worst EPS growth — declining or negative
  renderTable(
    "worstGrowthBody",
    sortAsc(withGrowth, "earningsGrowth").slice(0, ROWS_PER_TABLE),
    ["earningsGrowth", "beginEps", "endEps", "signal"]
  );

  // 6. Best value — lowest positive PEG (under 2 only, to avoid noise)
  var withPEG = pool.filter(function (s) {
    var p = numOrNull(s.peg);
    return p !== null && p > 0 && p < 2;
  });
  renderTable(
    "topValueBody",
    sortAsc(withPEG, "peg").slice(0, ROWS_PER_TABLE),
    ["peg", "pe", "earningsGrowth", "moat"]
  );

  // 7. Most expensive — highest PEG (only positive, cap at 50 to avoid noise)
  var expensivePEG = pool.filter(function (s) {
    var p = numOrNull(s.peg);
    return p !== null && p > 0 && p < 50;
  });
  renderTable(
    "worstValueBody",
    sortDesc(expensivePEG, "peg").slice(0, ROWS_PER_TABLE),
    ["peg", "pe", "price", "signal"]
  );

  hide("mvLoading");
  show("mvMain");
}

// ── Render one table body ─────────────────────────────────────
function renderTable(bodyId, stocks, cols) {
  var tbody = document.getElementById(bodyId);
  if (!tbody) return;

  if (!stocks.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="mv-empty">No data available for current filter.</td></tr>';
    return;
  }

  var html = "";
  for (var i = 0; i < stocks.length; i++) {
    var s    = stocks[i];
    var rank = i + 1;
    var cur  = s.currency || (s.country === "Kenya" ? "KES" : "ZAR");
    var href = "stock.html?ticker=" + encodeURIComponent(s.ticker) +
               "&country="          + encodeURIComponent(s.country);
    var rankCls = rank === 1 ? "rank-1" : rank === 2 ? "rank-2" : rank === 3 ? "rank-3" : "";

    html += '<tr data-href="' + href + '">';

    // Rank
    html += '<td class="rank-col"><span class="' + rankCls + '">' + rank + '</span></td>';

    // Ticker
    html += '<td><span class="cell-ticker">' + esc(s.ticker) + '</span></td>';

    // Company name
    html += '<td><span class="cell-name" title="' + esc(s.name) + '">' + esc(s.name) + '</span></td>';

    // Exchange badge
    html += '<td>' + exchBadge(s.country) + '</td>';

    // Dynamic columns
    for (var c = 0; c < cols.length; c++) {
      html += '<td class="num-col">' + renderCol(cols[c], s, cur) + '</td>';
    }

    html += '</tr>';
  }

  tbody.innerHTML = html;

  // Row click — navigate to stock detail page
  tbody.onclick = function (e) {
    var tr = e.target.closest("tr[data-href]");
    if (tr) window.location.href = tr.dataset.href;
  };
}

// ── Render a single column value ─────────────────────────────
function renderCol(col, s, cur) {
  var sym = cur === "ZAR" ? "R" : "KES ";

  switch (col) {
    case "price":
      var p = numOrNull(s.price);
      if (p === null || p === 0) return na();
      return sym + p.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    case "pe":
      var pe = numOrNull(s.pe);
      if (pe === null || pe <= 0) return na();
      var peCls = pe < 10 ? "n-good" : pe <= 20 ? "" : "n-warn";
      return '<span class="' + peCls + '">' + pe.toFixed(1) + '</span>';

    case "peg":
      var peg = numOrNull(s.peg);
      if (peg === null || peg <= 0) return na();
      var pegCls = peg < 1 ? "n-good" : peg < 2 ? "" : "n-warn";
      return '<span class="' + pegCls + '">' + peg.toFixed(2) + '</span>';

    case "divYield":
      var d = numOrNull(s.divYield);
      if (d === null) return na();
      var pct = (d * 100).toFixed(1);
      var dCls = pct >= 5 ? "n-good" : pct >= 2 ? "" : "n-warn";
      return '<span class="' + dCls + '">' + pct + '%</span>';

    case "earningsGrowth":
      var g = numOrNull(s.earningsGrowth);
      if (g === null) return na();
      var gCls  = g > 15 ? "n-good" : g > 0 ? "" : "n-bad";
      var gSign = g > 0 ? "+" : "";
      return '<span class="' + gCls + '">' + gSign + g.toFixed(1) + '%</span>';

    case "beginEps":
      var bEps = numOrNull(s.beginEps);
      if (bEps === null) return na();
      return sym + bEps.toFixed(2);

    case "endEps":
      var eEps = numOrNull(s.endEps);
      if (eEps === null) return na();
      var eCls = eEps > 0 ? "n-good" : "n-bad";
      return '<span class="' + eCls + '">' + sym + eEps.toFixed(2) + '</span>';

    case "moat":
      var mBadge = { "Wide": "badge-wide", "Narrow": "badge-narrow", "None": "badge-none" };
      if (!s.moat) return na();
      return '<span class="badge ' + (mBadge[s.moat] || "") + '">' + s.moat + '</span>';

    case "finStrength":
      var fBadge = { "Strong": "badge-strong", "Adequate": "badge-adequate", "Weak": "badge-weak" };
      if (!s.finStrength) return na();
      return '<span class="badge ' + (fBadge[s.finStrength] || "") + '">' + s.finStrength + '</span>';

    case "signal":
      var sig    = getSignal(s);
      var sLbl   = { buy: "● Buy", watch: "◐ Watch", avoid: "○ Avoid", neutral: "– Neutral" };
      var sCls   = { buy: "signal-buy", watch: "signal-watch", avoid: "signal-avoid", neutral: "signal-neutral" };
      return '<span class="signal ' + (sCls[sig] || "") + '">' + (sLbl[sig] || sig) + '</span>';

    default:
      return na();
  }
}

// ── Signal — identical logic to app.js and stock.js ──────────
function getSignal(s) {
  var pe     = numOrNull(s.pe);
  var peg    = numOrNull(s.peg);
  var growth = numOrNull(s.earningsGrowth);
  var div    = numOrNull(s.divYield);
  var moat   = s.moat        || "";
  var str    = s.finStrength || "";

  if (pe !== null && pe <= 0)            return "avoid";
  if (str === "Weak" && moat === "None") return "avoid";
  if (growth !== null && growth < -5)    return "avoid";

  var score = 0;
  if (moat === "Wide")                        score += 2;
  if (moat === "Narrow")                      score += 1;
  if (str  === "Strong")                      score += 2;
  if (str  === "Adequate")                    score += 1;
  if (peg  !== null && peg  > 0 && peg < 1)  score += 2;
  if (pe   !== null && pe   > 0 && pe  < 12) score += 2;
  if (pe   !== null && pe   >= 12 && pe < 20) score += 1;
  if (growth !== null && growth > 15)         score += 2;
  if (growth !== null && growth > 5)          score += 1;
  if (div    !== null && div > 0.05)          score += 1;

  if (score >= 7) return "buy";
  if (score >= 4) return "watch";
  if (score >= 1) return "neutral";
  return "avoid";
}

// ── Sort helpers ──────────────────────────────────────────────
function sortDesc(arr, key) {
  return arr.slice().sort(function (a, b) {
    var av = numOrNull(a[key]);
    var bv = numOrNull(b[key]);
    if (av === null) return 1;
    if (bv === null) return -1;
    return bv - av;
  });
}
function sortAsc(arr, key) {
  return arr.slice().sort(function (a, b) {
    var av = numOrNull(a[key]);
    var bv = numOrNull(b[key]);
    if (av === null) return 1;
    if (bv === null) return -1;
    return av - bv;
  });
}

// ── Shared utilities — self-contained ─────────────────────────
function numOrNull(v) { var n = parseFloat(v); return isNaN(n) ? null : n; }
function na()  { return '<span class="n-na">—</span>'; }
function esc(s) {
  return String(s || "")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
function show(id) { var el = document.getElementById(id); if (el) el.classList.remove("hidden"); }
function hide(id) { var el = document.getElementById(id); if (el) el.classList.add("hidden"); }

function exchBadge(country) {
  if (country === "Kenya")     return '<span class="cell-exch exch-nse">NSE</span>';
  if (country === "S. Africa") return '<span class="cell-exch exch-jse">JSE</span>';
  return "";
}

function showMvError(msg) {
  console.error("movers.js:", msg);
  hide("mvLoading");
  var el = document.getElementById("mvError");
  if (el) { el.querySelector("p").textContent = "⚠ " + msg; el.classList.remove("hidden"); }
}