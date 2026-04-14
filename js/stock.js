/* ═══════════════════════════════════════════════════════════════
   stock.js — individual company detail page
   Reads ?ticker=SCOM&country=Kenya from URL
   Fetches all stocks from API (same as screener), finds the match
═══════════════════════════════════════════════════════════════ */

document.addEventListener("DOMContentLoaded", function () {
  var params  = new URLSearchParams(window.location.search);
  var ticker  = (params.get("ticker")  || "").toUpperCase().trim();
  var country = (params.get("country") || "").trim();

  if (!ticker) { showDetailError(); return; }

  if (!API_URL || API_URL === "PASTE_YOUR_APPS_SCRIPT_URL_HERE") {
    showDetailError(); return;
  }

  fetch(API_URL)
    .then(function (r) { return r.json(); })
    .then(function (json) {
      var list = Array.isArray(json.data) ? json.data : [];
      var stock = null;
      for (var i = 0; i < list.length; i++) {
        if (list[i].ticker === ticker) { stock = list[i]; break; }
      }
      if (!stock) { showDetailError(); return; }
      renderDetail(stock);
    })
    .catch(function () { showDetailError(); });
});

function showDetailError() {
  hide("detailLoading");
  show("detailError");
}

function renderDetail(s) {
  hide("detailLoading");

  var cur  = s.currency || (s.country === "Kenya" ? "KES" : "ZAR");
  var sym  = cur === "ZAR" ? "R" : "KES ";
  var pr   = numOrNull(s.price);
  var iv   = numOrNull(s.intrinsicValue);
  var sig  = getSignal(s);

  // Page meta
  document.getElementById("pageTitle").textContent =
    s.ticker + " — " + s.name + " | The African Oracle";
  document.getElementById("pageDesc").setAttribute("content",
    "Analysis of " + s.name + " (" + s.ticker + ") — P/E, EPS, moat, intrinsic value and more.");

  // Hero
  setText("dTicker", s.ticker);
  var exchEl = document.getElementById("dExch");
  exchEl.textContent = s.country === "Kenya" ? "NSE" : "JSE";
  exchEl.className   = "detail-exch-badge " + (s.country === "Kenya" ? "nse" : "jse");
  setText("dName", s.name);
  setText("dSector", s.sector);
  setText("dCountry", s.country);
  setText("dCurrency", cur);
  document.getElementById("dPrice").textContent =
    pr !== null ? sym + pr.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2}) : "—";

  // Signal
  var sigLabels = { buy:"● Buy", watch:"◐ Watch", avoid:"○ Avoid", neutral:"– Neutral" };
  var sigClasses = { buy:"d-signal-buy", watch:"d-signal-watch", avoid:"d-signal-avoid", neutral:"d-signal-neutral" };
  var sigEl = document.createElement("div");
  sigEl.className = "d-signal " + (sigClasses[sig] || "d-signal-neutral");
  sigEl.textContent = sigLabels[sig] || sig;
  document.getElementById("dSignal").appendChild(sigEl);

  // Intrinsic value row
  if (iv !== null && iv > 0 && pr !== null && pr > 0) {
    var mos = ((iv - pr) / iv * 100).toFixed(0);
    var mosClass = mos > 0 ? "iv-good" : "iv-bad";
    var mosText  = mos > 0 ? "▲ " + mos + "% margin of safety" : "▼ " + Math.abs(mos) + "% above intrinsic value";
    document.getElementById("dIVRow").innerHTML =
      "Intrinsic Value: " + sym + Math.round(iv).toLocaleString() +
      " &nbsp;<span class='" + mosClass + "'>" + mosText + "</span>";
  }

  // ── KEY METRICS GRID ────────────────────────────────────────────────────
  var pe  = numOrNull(s.pe);
  var peg = numOrNull(s.peg);
  var div = numOrNull(s.divYield);
  var gr  = numOrNull(s.earningsGrowth);
  var de  = numOrNull(s.debtEquity);

  var metrics = [
    {
      label: "P/E Ratio",
      tip: "Price ÷ Earnings Per Share. Lower often means cheaper relative to profits.",
      val: pe !== null && pe > 0 ? pe.toFixed(1) : "—",
      cls: pe !== null && pe > 0 ? (pe < 10 ? "mv-good" : pe < 20 ? "" : "mv-warn") : "mv-na",
      note: "Price ÷ EPS"
    },
    {
      label: "PEG Ratio",
      tip: "P/E ÷ EPS Growth Rate. Under 1.0 signals potential undervaluation.",
      val: peg !== null && peg > 0 ? peg.toFixed(2) : "—",
      cls: peg !== null && peg > 0 ? (peg < 1 ? "mv-good" : peg < 2 ? "" : "mv-warn") : "mv-na",
      note: "P/E ÷ Growth Rate"
    },
    {
      label: "Div Yield",
      tip: "Annual dividend as % of share price. Higher means more income paid out.",
      val: div !== null ? (div * 100).toFixed(1) + "%" : "—",
      cls: div !== null ? (div >= 0.05 ? "mv-good" : div >= 0.02 ? "" : "mv-na") : "mv-na",
      note: "Annual DPS ÷ Price"
    },
    {
      label: "EPS Growth",
      tip: "How much earnings per share grew over 5 years. Higher is better.",
      val: gr !== null ? (gr > 0 ? "+" : "") + gr.toFixed(1) + "%" : "—",
      cls: gr !== null ? (gr > 15 ? "mv-good" : gr > 0 ? "" : "mv-bad") : "mv-na",
      note: "5-year EPS change"
    },
    {
      label: "Debt / Equity",
      tip: "Total debt divided by shareholder equity. Banks naturally run higher D/E.",
      val: de !== null ? de.toFixed(2) : "—",
      cls: de !== null ? (de < 0.5 ? "mv-good" : de < 1.5 ? "" : "mv-warn") : "mv-na",
      note: "Leverage ratio"
    },
    {
      label: "Intrinsic Value",
      tip: "Estimated fair value = EPS × P/E. Compare to current price.",
      val: iv !== null && iv > 0 ? sym + Math.round(iv).toLocaleString() : "—",
      cls: iv !== null && iv > 0 && pr !== null ? (iv > pr ? "mv-good" : "mv-warn") : "mv-na",
      note: iv !== null && pr !== null && iv > 0
        ? (iv > pr ? "Trading below fair value" : "Trading above fair value")
        : "EPS × P/E"
    }
  ];

  var grid = document.getElementById("metricsGrid");
  metrics.forEach(function (m) {
    var card = document.createElement("div");
    card.className = "metric-card";
    card.innerHTML =
      "<div class='metric-label'>" + m.label +
        " <span class='info-tip' title='" + m.tip + "'>?</span></div>" +
      "<div class='metric-value " + m.cls + "'>" + m.val + "</div>" +
      "<div class='metric-note'>" + m.note + "</div>";
    grid.appendChild(card);
  });

  // ── EPS JOURNEY ─────────────────────────────────────────────────────────
  var bEps = numOrNull(s.beginEps);
  var eEps = numOrNull(s.endEps);
  var tEps = numOrNull(s.eps);

  setText("eBegin", bEps !== null ? sym + bEps.toFixed(2) : "—");
  setText("eEnd",   eEps !== null ? sym + eEps.toFixed(2) : "—");
  setText("eTTM",   tEps !== null ? sym + tEps.toFixed(2) : "—");

  if (bEps !== null && eEps !== null && bEps !== 0) {
    var growthPct = ((eEps - bEps) / Math.abs(bEps) * 100).toFixed(0);
    var isPos     = parseFloat(growthPct) >= 0;
    document.getElementById("eArrowFill").style.width = "100%";
    document.getElementById("eArrowFill").className =
      "eps-arrow-fill " + (isPos ? "eps-fill-good" : "eps-fill-bad");
    var chip = document.getElementById("eGrowthChip");
    chip.textContent  = (isPos ? "+" : "") + growthPct + "% growth";
    chip.className    = "eps-growth-chip " + (isPos ? "chip-good" : "chip-bad");
  }

  // ── MARGIN BARS ──────────────────────────────────────────────────────────
  var iM  = numOrNull(s.initMargin);
  var fM  = numOrNull(s.finalMargin);
  var iMp = iM !== null ? (iM * 100).toFixed(1) : null;
  var fMp = fM !== null ? (fM * 100).toFixed(1) : null;

  if (iM !== null) {
    document.getElementById("barInit").style.width = Math.min(Math.max(iM * 100, 0), 100) + "%";
    setText("txtInit", iMp + "%");
  }
  if (fM !== null) {
    document.getElementById("barFinal").style.width = Math.min(Math.max(fM * 100, 0), 100) + "%";
    setText("txtFinal", fMp + "%");
  }
  if (iM !== null && fM !== null) {
    var verdictEl = document.getElementById("marginVerdict");
    var diff = fM - iM;
    if (Math.abs(diff) < 0.005) {
      verdictEl.textContent = "Margins have been stable over 5 years.";
      verdictEl.className = "margin-verdict verdict-flat";
    } else if (diff > 0) {
      verdictEl.textContent = "Margins improved by " + (diff * 100).toFixed(1) + "pp — the company is becoming more efficient.";
      verdictEl.className = "margin-verdict verdict-good";
    } else {
      verdictEl.textContent = "Margins declined by " + (Math.abs(diff) * 100).toFixed(1) + "pp — cost pressure or competition may be increasing.";
      verdictEl.className = "margin-verdict verdict-bad";
    }
  }

  // ── QUALITY SCORES ───────────────────────────────────────────────────────
  var scores = [
    {
      icon: s.moat === "Wide" ? "🏰" : s.moat === "Narrow" ? "🛡" : "⚠",
      name: "Economic Moat",
      val: s.moat || "—",
      cls: s.moat === "Wide" ? "sv-wide" : s.moat === "Narrow" ? "sv-narrow" : "sv-none",
      desc: s.moat === "Wide"
        ? "Durable competitive advantage expected to last 10+ years."
        : s.moat === "Narrow"
        ? "Some competitive advantage but vulnerable within 10 years."
        : "No significant competitive moat — easily competed away."
    },
    {
      icon: s.finStrength === "Strong" ? "💪" : s.finStrength === "Adequate" ? "🤝" : "⚡",
      name: "Financial Strength",
      val: s.finStrength || "—",
      cls: s.finStrength === "Strong" ? "sv-strong" : s.finStrength === "Adequate" ? "sv-adequate" : "sv-weak",
      desc: s.finStrength === "Strong"
        ? "Low debt, high margins, consistently profitable."
        : s.finStrength === "Adequate"
        ? "Moderate leverage and reasonable profitability."
        : "High debt, thin margins or recent losses. Higher risk."
    },
    {
      icon: s.predictability === "High" ? "📈" : s.predictability === "Medium" ? "〰" : "🎲",
      name: "Predictability",
      val: s.predictability || "—",
      cls: s.predictability === "High" ? "sv-high" : s.predictability === "Medium" ? "sv-medium" : "sv-low",
      desc: s.predictability === "High"
        ? "Steady, growing earnings over 5 years — easy to plan around."
        : s.predictability === "Medium"
        ? "Mostly positive earnings with some volatility."
        : "Erratic or loss-making earnings — higher uncertainty."
    }
  ];

  var sGrid = document.getElementById("scoresGrid");
  scores.forEach(function (sc) {
    var card = document.createElement("div");
    card.className = "score-card";
    card.innerHTML =
      "<div class='score-icon'>" + sc.icon + "</div>" +
      "<div class='score-name'>" + sc.name + "</div>" +
      "<div class='score-value " + sc.cls + "'>" + sc.val + "</div>" +
      "<div class='score-desc'>" + sc.desc + "</div>";
    sGrid.appendChild(card);
  });

  // ── HOW TO BUY ───────────────────────────────────────────────────────────
  setText("buyName", s.name);

  var brokers = s.country === "Kenya"
    ? [
        {
          name: "SBG Securities",
          desc: "Standard Bank Kenya's brokerage arm. Regulated by CMA Kenya. Suitable for NSE equities.",
          url:  "https://sbgsecurities.co.ke",
          cta:  "Open Account"
        },
        {
          name: "NCBA Securities",
          desc: "Full-service stockbroker regulated by CMA Kenya. Integrated with NCBA banking.",
          url:  "https://ncbasecurities.com",
          cta:  "Open Account"
        },
        {
          name: "Absa Securities Kenya",
          desc: "Stockbroking arm of Absa Bank Kenya. Offers research and online trading.",
          url:  "https://www.absabank.co.ke/business/investments/securities",
          cta:  "Open Account"
        }
      ]
    : [
        {
          name: "EasyEquities",
          desc: "South Africa's leading low-cost online broker. Fractional shares available. Great for beginners.",
          url:  "https://www.easyequities.co.za",
          cta:  "Open Account"
        },
        {
          name: "Satrix",
          desc: "ETF and direct equity investing platform by Sanlam. Well-regulated JSE broker.",
          url:  "https://www.satrix.co.za",
          cta:  "Open Account"
        },
        {
          name: "Standard Bank Online Share Trading",
          desc: "Full JSE access with research tools. Ideal for active investors.",
          url:  "https://www.standardbank.co.za/southafrica/personal/products-and-services/invest-and-save/trading-accounts",
          cta:  "Open Account"
        }
      ];

  var bGrid = document.getElementById("brokerGrid");
  brokers.forEach(function (b) {
    var card = document.createElement("div");
    card.className = "broker-card";
    card.innerHTML =
      "<div class='broker-name'>" + b.name + "</div>" +
      "<div class='broker-desc'>" + b.desc + "</div>" +
      "<a href='" + b.url + "' target='_blank' rel='noopener noreferrer' class='broker-btn'>" +
        b.cta + " →</a>";
    bGrid.appendChild(card);
  });

  // Show the page
  show("detailWrap");
}

// ── Signal (same logic as app.js) ────────────────────────────────────────────
function getSignal(s) {
  var pe  = numOrNull(s.pe);
  var peg = numOrNull(s.peg);
  var gr  = numOrNull(s.earningsGrowth);
  var div = numOrNull(s.divYield);
  var moat = s.moat || "";
  var str  = s.finStrength || "";

  if (pe !== null && pe <= 0)            return "avoid";
  if (str === "Weak" && moat === "None") return "avoid";
  if (gr  !== null && gr < -5)           return "avoid";

  var score = 0;
  if (moat === "Wide")                        score += 2;
  if (moat === "Narrow")                      score += 1;
  if (str  === "Strong")                      score += 2;
  if (str  === "Adequate")                    score += 1;
  if (peg  !== null && peg > 0 && peg < 1)   score += 2;
  if (pe   !== null && pe  > 0 && pe  < 12)  score += 2;
  if (pe   !== null && pe  >= 12 && pe < 20) score += 1;
  if (gr   !== null && gr  > 15)             score += 2;
  if (gr   !== null && gr  > 5)              score += 1;
  if (div  !== null && div > 0.05)           score += 1;

  if (score >= 7) return "buy";
  if (score >= 4) return "watch";
  if (score >= 1) return "neutral";
  return "avoid";
}

// ── Shared utilities ──────────────────────────────────────────────────────────
function numOrNull(v) { var n = parseFloat(v); return isNaN(n) ? null : n; }
function show(id) { var el = document.getElementById(id); if (el) el.classList.remove("hidden"); }
function hide(id) { var el = document.getElementById(id); if (el) el.classList.add("hidden"); }
function setText(id, v) { var el = document.getElementById(id); if (el) el.textContent = v; }