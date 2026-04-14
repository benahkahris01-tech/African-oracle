/* ═══════════════════════════════════════════════════════════════
   THE AFRICAN ORACLE — app.js  v2
   All columns from the Google Sheet displayed correctly.
   PE shown as plain number (not with "x").
   Margins shown as percentages.
   All sheet columns: beginEps, endEps, earningsGrowth, pe, peg,
   divYield, initMargin, finalMargin, marginGrowth, debtEquity,
   moat, finStrength, predictability, intrinsicValue, signal.
═══════════════════════════════════════════════════════════════ */

// ── PASTE YOUR APPS SCRIPT WEB APP URL HERE ─────────────────
// Deploy doGet() in Apps Script then paste the URL below.
// Example: https://script.google.com/macros/s/AKfy.../exec
var API_URL = "https://script.google.com/macros/s/AKfycbzUDs26aD7RaaVDdL7rUAVRZ83XlDK9dfI9zFcx-SvZXZD_2rnJXdbGSF2fNFNe37GbxQ/exec";
// ────────────────────────────────────────────────────────────

var allStocks   = [];
var filtered    = [];
var currentSort = { col: "ticker", dir: "asc" };

// Columns that can be toggled — key matches data-col on th and td
var visibleCols = {
  beginEps:       true,
  endEps:         true,
  earningsGrowth: true,
  pe:             true,
  peg:            true,
  divYield:       true,
  initMargin:     true,
  finalMargin:    true,
  marginGrowth:   true,
  debtEquity:     true,
  moat:           true,
  finStrength:    true,
  predictability: true,
  intrinsicValue: true,
  signal:         true
};

var filters = {
  search:   "",
  exchange: "all",
  moat:     "all",
  strength: "all",
  predict:  "all",
  sector:   "all"
};

// ── Boot ─────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", function () {
  fetchData();
  bindFilters();
  bindColumnToggles();
});

// ── Fetch ─────────────────────────────────────────────────────
function fetchData() {
  if (!API_URL || API_URL === "PASTE_YOUR_APPS_SCRIPT_URL_HERE") {
    showError("No API URL set. Open js/app.js and paste your Apps Script Web App URL."); 
    return;
  }
  fetch(API_URL)
    .then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    })
    .then(function (json) {
      if (!json || !json.data) throw new Error("Empty or invalid response from API");
      allStocks = Array.isArray(json.data) ? json.data : [json.data];
      populateSectorFilter();
      updateHeroStats();
      applyFiltersAndRender();
      show("stockTable");
      hide("loadingState");
    })
    .catch(function (err) {
      console.error("API fetch error:", err);
      showError("Could not load data: " + err.message +
        ". Make sure your Apps Script is deployed as a Web App with access set to Anyone.");
    });
}

// ── Sector dropdown ───────────────────────────────────────────
function populateSectorFilter() {
  var seen = {};
  allStocks.forEach(function (s) { if (s.sector) seen[s.sector] = true; });
  var select = document.getElementById("sectorFilter");
  Object.keys(seen).sort().forEach(function (sec) {
    var opt = document.createElement("option");
    opt.value = sec;
    opt.textContent = sec;
    select.appendChild(opt);
  });
}

// ── Hero stats ────────────────────────────────────────────────
function updateHeroStats() {
  var nse  = allStocks.filter(function (s) { return s.country === "Kenya"; }).length;
  var jse  = allStocks.filter(function (s) { return s.country === "S. Africa"; }).length;
  var wide = allStocks.filter(function (s) { return s.moat === "Wide"; }).length;
  setText("totalCount", allStocks.length);
  setText("nseCount",   nse);
  setText("jseCount",   jse);
  setText("wideCount",  wide);
}

// ── Column toggles ────────────────────────────────────────────
function bindColumnToggles() {
  document.querySelectorAll(".col-check input").forEach(function (cb) {
    cb.addEventListener("change", function () {
      var col = this.dataset.col;
      visibleCols[col] = this.checked;
      applyColumnVisibility();
    });
  });
  applyColumnVisibility();
}

function applyColumnVisibility() {
  Object.keys(visibleCols).forEach(function (col) {
    var show = visibleCols[col];
    // Header cells
    document.querySelectorAll("th.tc[data-col='" + col + "']").forEach(function (el) {
      el.style.display = show ? "" : "none";
    });
    // Body cells — use data-col on td
    document.querySelectorAll("td[data-col='" + col + "']").forEach(function (el) {
      el.style.display = show ? "" : "none";
    });
  });
}

// ── Bind all filters ──────────────────────────────────────────
function bindFilters() {
  document.getElementById("searchInput").addEventListener("input", function () {
    filters.search = this.value.toLowerCase().trim();
    applyFiltersAndRender();
  });
  bindPillGroup("exchangeFilter", function (v) { filters.exchange = v; applyFiltersAndRender(); });
  bindPillGroup("moatFilter",     function (v) { filters.moat     = v; applyFiltersAndRender(); });
  bindPillGroup("strengthFilter", function (v) { filters.strength = v; applyFiltersAndRender(); });
  bindPillGroup("predictFilter",  function (v) { filters.predict  = v; applyFiltersAndRender(); });
  document.getElementById("sectorFilter").addEventListener("change", function () {
    filters.sector = this.value; applyFiltersAndRender();
  });
  document.getElementById("sortSelect").addEventListener("change", function () {
    var parts = this.value.split("_");
    currentSort.col = parts[0];
    currentSort.dir = parts[1] || "asc";
    applyFiltersAndRender();
  });
  // Sortable header clicks
  document.querySelectorAll("th.th-sortable").forEach(function (th) {
    th.addEventListener("click", function () {
      var col = this.dataset.sort;
      if (!col) return;
      if (currentSort.col === col) {
        currentSort.dir = currentSort.dir === "asc" ? "desc" : "asc";
      } else {
        currentSort.col = col;
        currentSort.dir = "asc";
      }
      document.querySelectorAll("th.th-sortable").forEach(function (t) {
        t.classList.remove("asc", "desc");
      });
      this.classList.add(currentSort.dir);
      applyFiltersAndRender();
    });
  });
}

function bindPillGroup(id, cb) {
  var grp = document.getElementById(id);
  if (!grp) return;
  grp.querySelectorAll(".pill").forEach(function (btn) {
    btn.addEventListener("click", function () {
      grp.querySelectorAll(".pill").forEach(function (b) { b.classList.remove("active"); });
      this.classList.add("active");
      cb(this.dataset.value);
    });
  });
}

// ── Filter + Sort + Render ────────────────────────────────────
function applyFiltersAndRender() {
  filtered = allStocks.filter(function (s) {
    if (filters.search) {
      var q = filters.search;
      if (!s.ticker.toLowerCase().includes(q) && !s.name.toLowerCase().includes(q)) return false;
    }
    if (filters.exchange !== "all" && s.country      !== filters.exchange) return false;
    if (filters.moat     !== "all" && s.moat         !== filters.moat)     return false;
    if (filters.strength !== "all" && s.finStrength  !== filters.strength)  return false;
    if (filters.predict  !== "all" && s.predictability !== filters.predict) return false;
    if (filters.sector   !== "all" && s.sector        !== filters.sector)   return false;
    return true;
  });

  filtered.sort(function (a, b) {
    var col = currentSort.col;
    var dir = currentSort.dir === "asc" ? 1 : -1;
    var av  = numOrNull(a[col]);
    var bv  = numOrNull(b[col]);
    if (av === null && bv === null) return String(a[col] || "").localeCompare(String(b[col] || "")) * dir;
    if (av === null) return 1;
    if (bv === null) return -1;
    return (av - bv) * dir;
  });

  renderTable(filtered);
  setText("resultCount", filtered.length + " of " + allStocks.length + " companies");
}

// ── Render rows ───────────────────────────────────────────────
function renderTable(stocks) {
  var tbody = document.getElementById("tableBody");
  tbody.innerHTML = "";

  if (stocks.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="20" style="text-align:center;padding:48px;color:var(--muted)">No companies match your filters.</td></tr>';
    return;
  }

  stocks.forEach(function (s) {
    var cur  = s.currency || (s.country === "Kenya" ? "KES" : "ZAR");
    var iv   = numOrNull(s.intrinsicValue);
    var pr   = numOrNull(s.price);
    var sig  = getSignal(s);

    var tr = document.createElement("tr");

    // ── Fixed columns (always visible) ──────────────────────────
    tr.innerHTML =
      // Ticker
      '<td><span class="cell-ticker">' + esc(s.ticker) + '</span></td>' +

      // Company name
      '<td><span class="cell-name" title="' + esc(s.name) + '">' + esc(s.name) + '</span></td>' +

      // Exchange badge
      '<td>' + exchBadge(s.country) + '</td>' +

      // Price — formatted with currency, no "x"
      '<td class="num-col">' + fmtPrice(s.price, cur) + '</td>' +

      // ── Toggleable columns ────────────────────────────────────

      // Beginning EPS (raw number, local currency)
      '<td class="num-col tc" data-col="beginEps">' + fmtNum(s.beginEps, 2, cur + " ") + '</td>' +

      // Ending EPS (raw number, local currency)
      '<td class="num-col tc" data-col="endEps">' + fmtNum(s.endEps, 2, cur + " ") + '</td>' +

      // EPS Growth % — from formula in sheet
      '<td class="num-col tc" data-col="earningsGrowth">' + fmtGrowthPct(s.earningsGrowth) + '</td>' +

      // P/E — plain number, no "x", colour coded
      '<td class="num-col tc" data-col="pe">' + fmtPE(s.pe) + '</td>' +

      // PEG — plain decimal
      '<td class="num-col tc" data-col="peg">' + fmtPEG(s.peg) + '</td>' +

      // Div Yield — as percentage
      '<td class="num-col tc" data-col="divYield">' + fmtPct(s.divYield) + '</td>' +

      // Initial Net Margin — as percentage
      '<td class="num-col tc" data-col="initMargin">' + fmtPct(s.initMargin) + '</td>' +

      // Final Net Margin — as percentage
      '<td class="num-col tc" data-col="finalMargin">' + fmtPct(s.finalMargin) + '</td>' +

      // Margin Growth % — from formula in sheet
      '<td class="num-col tc" data-col="marginGrowth">' + fmtGrowthPct(s.marginGrowth) + '</td>' +

      // Debt/Equity — plain decimal
      '<td class="num-col tc" data-col="debtEquity">' + fmtDE(s.debtEquity) + '</td>' +

      // Moat badge
      '<td class="tc" data-col="moat">' + moatBadge(s.moat) + '</td>' +

      // Financial Strength badge
      '<td class="tc" data-col="finStrength">' + strengthBadge(s.finStrength) + '</td>' +

      // Predictability badge
      '<td class="tc" data-col="predictability">' + predictBadge(s.predictability) + '</td>' +

      // Intrinsic Value — formatted with currency
      // Also shows margin of safety vs current price
      '<td class="num-col tc" data-col="intrinsicValue">' + fmtIV(iv, pr, cur) + '</td>' +

      // Signal
      '<td class="tc" data-col="signal">' + signalBadge(sig) + '</td>';

    // Navigate to detail page on row click
    tr.addEventListener("click", function () {
      window.location.href =
        "stock.html?ticker=" + encodeURIComponent(s.ticker) +
        "&country="          + encodeURIComponent(s.country);
    });

    tbody.appendChild(tr);
  });

  // Re-apply column visibility after render
  applyColumnVisibility();
}

// ── Signal logic ──────────────────────────────────────────────
function getSignal(s) {
  var pe     = numOrNull(s.pe);
  var peg    = numOrNull(s.peg);
  var growth = numOrNull(s.earningsGrowth);
  var div    = numOrNull(s.divYield);
  var moat   = s.moat        || "";
  var str    = s.finStrength || "";

  // Avoid: losses or very weak
  if (pe !== null && pe <= 0)            return "avoid";
  if (str === "Weak" && moat === "None") return "avoid";
  if (growth !== null && growth < -5)    return "avoid";

  // Score across dimensions
  var score = 0;
  if (moat === "Wide")                          score += 2;
  if (moat === "Narrow")                        score += 1;
  if (str  === "Strong")                        score += 2;
  if (str  === "Adequate")                      score += 1;
  if (peg  !== null && peg > 0 && peg < 1)     score += 2;
  if (pe   !== null && pe  > 0 && pe  < 12)    score += 2;
  if (pe   !== null && pe  >= 12 && pe < 20)   score += 1;
  if (growth !== null && growth > 15)           score += 2;
  if (growth !== null && growth > 5)            score += 1;
  if (div    !== null && div > 0.05)            score += 1;

  if (score >= 7) return "buy";
  if (score >= 4) return "watch";
  if (score >= 1) return "neutral";
  return "avoid";
}

// ── Formatting functions ──────────────────────────────────────

// Generic number with prefix and fixed decimals
function fmtNum(val, dp, prefix) {
  var n = numOrNull(val);
  if (n === null) return '<span class="n-na">—</span>';
  var p = prefix || "";
  var cls = n < 0 ? "n-bad" : "";
  return '<span class="' + cls + '">' + p + n.toFixed(dp || 2) + '</span>';
}

// Price with currency symbol — no "x"
function fmtPrice(val, cur) {
  var n = numOrNull(val);
  if (n === null || n === 0) return '<span class="n-na">—</span>';
  var sym = cur === "ZAR" ? "R" : "KES";
  return '<span>' + sym + " " + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '</span>';
}

// P/E — plain number, no "x", colour coded
// Low PE (< 10) = green, 10-20 = neutral, > 20 = amber, ≤ 0 = dash
function fmtPE(val) {
  var n = numOrNull(val);
  if (n === null || n <= 0) return '<span class="n-na">—</span>';
  var cls = n < 10 ? "n-good" : n <= 20 ? "" : "n-warn";
  return '<span class="' + cls + '">' + n.toFixed(1) + '</span>';
}

// PEG — plain decimal, colour coded
// < 1 = green (undervalued signal), 1-2 = neutral, > 2 = amber
function fmtPEG(val) {
  var n = numOrNull(val);
  if (n === null || n <= 0) return '<span class="n-na">—</span>';
  var cls = n < 1 ? "n-good" : n <= 2 ? "" : "n-warn";
  return '<span class="' + cls + '">' + n.toFixed(2) + '</span>';
}

// Percentage from decimal (e.g. 0.18 → 18.0%)
function fmtPct(val) {
  var n = numOrNull(val);
  if (n === null) return '<span class="n-na">—</span>';
  var pct = n * 100;
  // Div yield: ≥ 5% green, ≥ 2% neutral, < 2% muted
  // Margins: ≥ 15% green, ≥ 5% neutral, < 5% amber, negative red
  var cls = pct < 0 ? "n-bad" : pct >= 15 ? "n-good" : pct >= 5 ? "" : pct >= 2 ? "" : "n-warn";
  return '<span class="' + cls + '">' + pct.toFixed(1) + '%</span>';
}

// Growth % (already a % value from the sheet formula, not a decimal)
function fmtGrowthPct(val) {
  var n = numOrNull(val);
  if (n === null) return '<span class="n-na">—</span>';
  var cls = n > 15 ? "n-good" : n > 0 ? "" : "n-bad";
  var sign = n > 0 ? "+" : "";
  return '<span class="' + cls + '">' + sign + n.toFixed(1) + '%</span>';
}

// Debt/Equity — plain decimal
// For non-banks: < 0.5 green, 0.5-1.5 neutral, > 1.5 amber
// For banks naturally high so just show plain
function fmtDE(val) {
  var n = numOrNull(val);
  if (n === null) return '<span class="n-na">—</span>';
  var cls = n < 0.5 ? "n-good" : n < 1.5 ? "" : "n-warn";
  return '<span class="' + cls + '">' + n.toFixed(2) + '</span>';
}

// Intrinsic Value with margin of safety indicator
function fmtIV(iv, price, cur) {
  if (iv === null || iv <= 0) return '<span class="n-na">—</span>';
  var sym = cur === "ZAR" ? "R" : "KES";
  var html = '<span>' + sym + " " + iv.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + '</span>';
  // Show margin of safety if we have current price
  if (price !== null && price > 0) {
    var mos = ((iv - price) / iv * 100);
    if (mos > 5) {
      html += ' <span class="n-good" style="font-size:9px">▲' + mos.toFixed(0) + '%</span>';
    } else if (mos < -5) {
      html += ' <span class="n-bad" style="font-size:9px">▼' + Math.abs(mos).toFixed(0) + '%</span>';
    }
  }
  return html;
}

// ── Badge helpers ─────────────────────────────────────────────
function exchBadge(country) {
  if (country === "Kenya")     return '<span class="cell-exch exch-nse">NSE</span>';
  if (country === "S. Africa") return '<span class="cell-exch exch-jse">JSE</span>';
  return "";
}
function moatBadge(val) {
  if (!val) return '<span class="n-na">—</span>';
  var m = { "Wide": "badge-wide", "Narrow": "badge-narrow", "None": "badge-none" };
  return '<span class="badge ' + (m[val] || "") + '">' + val + '</span>';
}
function strengthBadge(val) {
  if (!val) return '<span class="n-na">—</span>';
  var m = { "Strong": "badge-strong", "Adequate": "badge-adequate", "Weak": "badge-weak" };
  return '<span class="badge ' + (m[val] || "") + '">' + val + '</span>';
}
function predictBadge(val) {
  if (!val) return '<span class="n-na">—</span>';
  var m = { "High": "badge-high", "Medium": "badge-medium", "Low": "badge-low" };
  return '<span class="badge ' + (m[val] || "") + '">' + val + '</span>';
}
function signalBadge(sig) {
  var labels  = { buy: "● Buy", watch: "◐ Watch", avoid: "○ Avoid", neutral: "– Neutral" };
  var classes = { buy: "signal-buy", watch: "signal-watch", avoid: "signal-avoid", neutral: "signal-neutral" };
  return '<span class="signal ' + (classes[sig] || "") + '">' + (labels[sig] || sig) + '</span>';
}

// ── Utilities ─────────────────────────────────────────────────
function numOrNull(val) { var n = parseFloat(val); return isNaN(n) ? null : n; }
function esc(s) {
  return String(s || "")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
function show(id)      { var el = document.getElementById(id); if (el) el.classList.remove("hidden"); }
function hide(id)      { var el = document.getElementById(id); if (el) el.classList.add("hidden"); }
function setText(id,v) { var el = document.getElementById(id); if (el) el.textContent = v; }
function showError(msg) {
  hide("loadingState");
  var el = document.getElementById("errorState");
  document.getElementById("errorMsg").textContent = "⚠ " + msg;
  el.classList.remove("hidden");
}