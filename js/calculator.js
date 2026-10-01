/* ═══════════════════════════════════════════════════════════════
   calculator.js — investment return calculator (calculator.html)

   Self-contained. Optional stock autofill uses these globals from
   js/app.js (loaded first): SUPABASE_URL, SUPABASE_ANON_KEY,
   normalizeStockRow(). If any are missing, the calculator still
   works with manual entry.

   Educational illustration only — not a forecast, not advice.
═══════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  // ── Exchange defaults (all editable by the user) ──────────────────────────
  var CONFIG = {
    NSE: {
      cur: "KES", sym: "KES ", cost: 2.1, tax: 5, fractional: false,
      costHint: "NSE regulations cap total trading cost at 2.10% for trades up to KES 100,000 (brokerage plus statutory levies). Larger trades can be cheaper. Check your broker's fee schedule.",
      taxHint: "Kenya has withheld 5% on dividends paid to resident individuals (final tax). Rates are set by Finance Acts and some KRA schedules list other figures, so confirm the current rate on kra.go.ke."
    },
    JSE: {
      cur: "ZAR", sym: "R", cost: 0.4, tax: 20, fractional: true,
      costHint: "JSE platform costs vary — often roughly 0.25% to 0.5% per trade including VAT and levies. Check your platform's fee schedule.",
      taxHint: "South Africa withholds 20% dividends tax at source. Non-residents may qualify for a lower treaty rate (10% for Kenya residents) if their tax status is declared correctly."
    }
  };

  var SENSITIVITY_GROWTH = [-10, 0, 5, 10, 15];

  var STOCKS = [];
  var LABEL_MAP = {};
  var currentExchange = "NSE";

  // ── Small helpers ─────────────────────────────────────────────────────────
  function $(id) { return document.getElementById(id); }
  function numOrNull(v) { var n = parseFloat(v); return isNaN(n) ? null : n; }
  function num(id, fallback) { var n = parseFloat($(id).value); return isNaN(n) ? fallback : n; }
  function clamp(v, lo, hi) { return Math.min(Math.max(v, lo), hi); }
  function round2(n) { return Math.round(n * 100) / 100; }

  function money(n, dp) {
    var sym = CONFIG[currentExchange].sym;
    var abs = Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });
    return (n < 0 ? "-" : "") + sym + abs;
  }
  function pct(n, signed) {
    if (!isFinite(n)) return "—";
    return (signed && n > 0 ? "+" : "") + n.toFixed(1) + "%";
  }
  function setText(id, v) { var el = $(id); if (el) el.textContent = v; }
  function cls(n) { return n > 0 ? "calc-pos" : (n < 0 ? "calc-neg" : ""); }

  // ── Core model ────────────────────────────────────────────────────────────
  // Assumptions (also stated on the page):
  //  • Costs are charged on every buy and sell (including reinvestment).
  //  • Dividends are paid once a year, at year end, after tax.
  //  • Price growth and dividend growth are constant annual rates the user picks.
  //  • Uninvested cash earns nothing. No capital gains tax, inflation or FX.
  function simulate(p) {
    var fee = p.cost / 100;
    var tax = p.tax / 100;
    var unit = p.price * (1 + fee);                       // cash needed per share incl. buy cost

    var shares = p.fractional ? p.budget / unit : Math.floor(p.budget / unit);
    var shares0 = shares;
    var outlay = shares * unit;
    var cash = p.budget - outlay;                          // unspent budget
    var feesPaid = shares * p.price * fee;
    var taxPaid = 0, divGross = 0, divNet = 0, firstYearNet = 0;
    var rows = [];

    for (var t = 1; t <= p.years; t++) {
      var price = p.price * Math.pow(1 + p.growth / 100, t);
      var dps   = p.dps   * Math.pow(1 + p.dpsGrowth / 100, t - 1);
      var gross = shares * dps;
      var tx    = gross * tax;
      var net   = gross - tx;

      divGross += gross; taxPaid += tx; divNet += net;
      if (t === 1) firstYearNet = net;
      cash += net;

      if (p.reinvest && price > 0) {
        var u = price * (1 + fee);
        var buy = p.fractional ? cash / u : Math.floor(cash / u);
        if (buy > 0) {
          shares += buy;
          cash -= buy * u;
          feesPaid += buy * price * fee;
        }
      }
      rows.push({ year: t, price: price, dps: dps, net: net, shares: shares, value: shares * price + cash });
    }

    var endPrice    = p.price * Math.pow(1 + p.growth / 100, p.years);
    var sharesValue = shares * endPrice;
    var sellFee     = sharesValue * fee;
    var finalValue  = sharesValue - sellFee + cash;
    feesPaid += sellFee;

    var profit = finalValue - p.budget;
    var totalReturn = p.budget > 0 ? profit / p.budget * 100 : 0;
    var cagr = (p.budget > 0 && finalValue > 0)
      ? (Math.pow(finalValue / p.budget, 1 / p.years) - 1) * 100
      : -100;

    return {
      unit: unit, shares0: shares0, sharesEnd: shares, outlay: outlay,
      feesPaid: feesPaid, taxPaid: taxPaid, divGross: divGross, divNet: divNet,
      firstYearNet: firstYearNet, endPrice: endPrice, finalValue: finalValue,
      profit: profit, totalReturn: totalReturn, cagr: cagr,
      priceEffect: profit - divNet + feesPaid,             // profit = price effect + net dividends - costs
      yieldOnCost: outlay > 0 ? firstYearNet / outlay * 100 : 0,
      leftoverCash: p.budget - outlay,
      rows: rows
    };
  }

  function readInputs() {
    return {
      budget:     Math.max(num("inBudget", 0), 0),
      price:      Math.max(num("inPrice", 0), 0),
      dps:        Math.max(num("inDps", 0), 0),
      dpsGrowth:  clamp(num("inDpsGrowth", 0), -100, 50),
      growth:     clamp(num("inGrowth", 0), -99, 100),
      years:      Math.round(clamp(num("inYears", 5), 1, 40)),
      cost:       clamp(num("inCost", 0), 0, 20),
      tax:        clamp(num("inTax", 0), 0, 60),
      reinvest:   $("inReinvest").checked,
      fractional: $("inFractional").checked
    };
  }

  // ── Rendering ─────────────────────────────────────────────────────────────
  function card(label, value, note, valueClass) {
    return "<div class='calc-card'>" +
      "<div class='calc-card-label'>" + label + "</div>" +
      "<div class='calc-card-value " + (valueClass || "") + "'>" + value + "</div>" +
      "<div class='calc-card-note'>" + (note || "") + "</div>" +
    "</div>";
  }

  function calculate() {
    var p = readInputs();
    var resultsEl = $("calcResults");
    var msgEl = $("calcMessage");

    if (p.budget <= 0 || p.price <= 0) {
      resultsEl.classList.add("calc-hidden");
      msgEl.textContent = "Enter an amount to invest and a share price to see your illustration.";
      msgEl.classList.remove("calc-hidden");
      return;
    }

    var sim = simulate(p);

    if (sim.shares0 <= 0) {
      resultsEl.classList.add("calc-hidden");
      msgEl.textContent = "Your amount is below the cost of one share including trading costs (" +
        money(sim.unit, 2) + "). Increase the amount, or tick fractional shares if your platform supports them.";
      msgEl.classList.remove("calc-hidden");
      return;
    }
    msgEl.classList.add("calc-hidden");
    resultsEl.classList.remove("calc-hidden");

    // Headline cards
    $("calcCards").innerHTML =
      card("Estimated value after " + p.years + (p.years === 1 ? " year" : " years"),
           money(sim.finalValue, 0), "After selling costs", "") +
      card("Total return", pct(sim.totalReturn, true),
           money(sim.profit, 0) + " on " + money(p.budget, 0), cls(sim.profit)) +
      card("Annualised return", pct(sim.cagr, true), "Compound rate per year", cls(sim.cagr)) +
      card("Dividends received", money(sim.divNet, 0),
           "After " + money(sim.taxPaid, 0) + " tax withheld", "") +
      card("Yield on your cost", pct(sim.yieldOnCost, false), "Year-1 net dividends ÷ cash spent", "") +
      card("Trading costs paid", money(sim.feesPaid, 0), "Buying, reinvesting and selling", "");

    // Where the result comes from
    $("calcBreakdown").innerHTML =
      "<li><span>Shares bought</span><strong>" +
        sim.shares0.toLocaleString(undefined, { maximumFractionDigits: 4 }) + " @ " + money(p.price, 2) + "</strong></li>" +
      "<li><span>Cash left unspent at purchase</span><strong>" + money(sim.leftoverCash, 2) + "</strong></li>" +
      "<li><span>Share price movement</span><strong class='" + cls(sim.priceEffect) + "'>" + money(sim.priceEffect, 0) + "</strong></li>" +
      "<li><span>Dividends (after tax)</span><strong class='calc-pos'>" + money(sim.divNet, 0) + "</strong></li>" +
      "<li><span>Trading costs</span><strong class='calc-neg'>-" + money(sim.feesPaid, 0) + "</strong></li>" +
      "<li class='calc-total'><span>Profit / loss</span><strong class='" + cls(sim.profit) + "'>" + money(sim.profit, 0) + "</strong></li>";

    // Perspective lines
    var fee = p.cost / 100;
    var breakEven = ((1 + fee) / (1 - fee) - 1) * 100;
    var lines = [];
    lines.push("Round-trip trading costs (buy and sell) mean the share price must rise about <strong>" +
      breakEven.toFixed(1) + "%</strong> before you break even on price alone.");
    if (p.dps > 0) {
      lines.push("At " + money(p.price, 2) + " a share, a " + money(p.dps, 2) + " annual dividend is a gross yield of <strong>" +
        pct(p.dps / p.price * 100, false) + "</strong>; after " + p.tax + "% tax it is <strong>" +
        pct(p.dps * (1 - p.tax / 100) / p.price * 100, false) + "</strong>.");
    }
    lines.push("Set price growth to 0% to see a dividends-only outcome, or tick/untick reinvestment to see the effect of compounding.");
    $("calcInsights").innerHTML = "<li>" + lines.join("</li><li>") + "</li>";

    renderBars(sim.rows);
    renderYearTable(sim.rows);
    renderSensitivity(p);
  }

  function renderBars(rows) {
    var max = 0, i;
    for (i = 0; i < rows.length; i++) if (rows[i].value > max) max = rows[i].value;
    var html = "";
    for (i = 0; i < rows.length; i++) {
      var h = max > 0 ? Math.max(rows[i].value / max * 100, 2) : 2;
      html += "<div class='calc-bar-col' title='Year " + rows[i].year + ": " + money(rows[i].value, 0) + "'>" +
        "<div class='calc-bar' style='height:" + h.toFixed(1) + "%'></div>" +
        "<div class='calc-bar-label'>" + rows[i].year + "</div></div>";
    }
    $("calcBars").innerHTML = html;
  }

  function renderYearTable(rows) {
    var html = "", i;
    for (i = 0; i < rows.length; i++) {
      var r = rows[i];
      html += "<tr><td>" + r.year + "</td><td>" + money(r.price, 2) + "</td><td>" + money(r.dps, 2) +
        "</td><td>" + money(r.net, 0) + "</td><td>" +
        r.shares.toLocaleString(undefined, { maximumFractionDigits: 2 }) + "</td><td>" + money(r.value, 0) + "</td></tr>";
    }
    $("calcYearBody").innerHTML = html;
  }

  function renderSensitivity(p) {
    var html = "", i;
    for (i = 0; i < SENSITIVITY_GROWTH.length; i++) {
      var g = SENSITIVITY_GROWTH[i];
      var q = {};
      for (var k in p) { if (Object.prototype.hasOwnProperty.call(p, k)) q[k] = p[k]; }
      q.growth = g;
      var s = simulate(q);
      html += "<tr><td>" + (g > 0 ? "+" : "") + g + "% a year</td><td>" + money(s.finalValue, 0) + "</td><td class='" +
        cls(s.totalReturn) + "'>" + pct(s.totalReturn, true) + "</td><td class='" + cls(s.cagr) + "'>" + pct(s.cagr, true) + "</td></tr>";
    }
    $("calcSensBody").innerHTML = html;
  }

  // ── Exchange / stock handling ─────────────────────────────────────────────
  function applyExchange(ex) {
    currentExchange = ex;
    var c = CONFIG[ex];
    $("inExchange").value = ex;
    $("inCost").value = c.cost;
    $("inTax").value = c.tax;
    $("inFractional").checked = c.fractional;
    setText("costHint", c.costHint);
    setText("taxHint", c.taxHint);
    var labels = document.querySelectorAll(".cur-label");
    for (var i = 0; i < labels.length; i++) labels[i].textContent = c.cur;
  }

  function applyStock(s) {
    applyExchange(s.country === "Kenya" ? "NSE" : "JSE");
    var pr = numOrNull(s.price);
    var dy = numOrNull(s.divYield);          // stored as a fraction, e.g. 0.045
    if (pr !== null && pr > 0) $("inPrice").value = round2(pr);
    $("inDps").value = (pr !== null && pr > 0 && dy !== null && dy > 0) ? round2(pr * dy) : 0;
    setText("stockNote",
      s.name + " (" + s.ticker + "): price and dividend filled from our latest daily data. " +
      "Dividend per share is estimated from the current yield — adjust it if you know the declared dividend.");
    calculate();
  }

  function findStockFromInput(text) {
    if (LABEL_MAP[text]) return LABEL_MAP[text];
    var t = String(text || "").toUpperCase().trim();
    if (!t) return null;
    var hits = [];
    for (var i = 0; i < STOCKS.length; i++) if (STOCKS[i].ticker === t) hits.push(STOCKS[i]);
    return hits.length === 1 ? hits[0] : null;
  }

  function populateStocks(list) {
    STOCKS = list.filter(function (s) { return s && s.ticker && s.name; });
    STOCKS.sort(function (a, b) { return a.ticker < b.ticker ? -1 : 1; });
    var dl = $("stockList");
    dl.innerHTML = "";
    LABEL_MAP = {};
    STOCKS.forEach(function (s) {
      var label = s.ticker + " — " + s.name + " (" + (s.country === "Kenya" ? "NSE" : "JSE") + ")";
      LABEL_MAP[label] = s;
      var opt = document.createElement("option");
      opt.value = label;
      dl.appendChild(opt);
    });
    $("stockPicker").classList.remove("calc-hidden");

    // Optional deep link: calculator.html?ticker=SCOM&country=Kenya
    var params = new URLSearchParams(window.location.search);
    var qt = (params.get("ticker") || "").toUpperCase().trim();
    var qc = (params.get("country") || "").trim();
    if (qt) {
      for (var i = 0; i < STOCKS.length; i++) {
        if (STOCKS[i].ticker === qt && (!qc || STOCKS[i].country === qc)) {
          $("inStock").value = Object.keys(LABEL_MAP).filter(function (k) { return LABEL_MAP[k] === STOCKS[i]; })[0] || qt;
          applyStock(STOCKS[i]);
          break;
        }
      }
    }
  }

  function loadStocks() {
    var CACHE_KEY = "oracle_data";                       // shared with app.js / movers.js / stock.js
    var CACHE_TTL = 10 * 60 * 1000;
    try {
      var cached = JSON.parse(sessionStorage.getItem(CACHE_KEY) || "null");
      if (cached && cached.ts && cached.data && (Date.now() - cached.ts < CACHE_TTL)) {
        populateStocks(cached.data);
        return;
      }
    } catch (e) { /* fall through to fetch */ }

    if (typeof SUPABASE_URL === "undefined" || !SUPABASE_URL ||
        typeof SUPABASE_ANON_KEY === "undefined" || !SUPABASE_ANON_KEY ||
        typeof normalizeStockRow !== "function") {
      return;                                            // manual entry still works
    }

    fetch(SUPABASE_URL + "/rest/v1/stocks?select=*", {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: "Bearer " + SUPABASE_ANON_KEY }
    })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (rows) {
        var list = Array.isArray(rows) ? rows.map(normalizeStockRow) : [];
        try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: list })); } catch (e) {}
        populateStocks(list);
      })
      .catch(function (err) { console.log("Calculator: stock list unavailable —", err); });
  }

  // ── Wiring ────────────────────────────────────────────────────────────────
  document.addEventListener("DOMContentLoaded", function () {
    if (!$("calcForm")) return;

    applyExchange("NSE");

    var inputs = $("calcForm").querySelectorAll("input[type=number], input[type=checkbox]");
    for (var i = 0; i < inputs.length; i++) {
      inputs[i].addEventListener("input", calculate);
      inputs[i].addEventListener("change", calculate);
    }

    $("inExchange").addEventListener("change", function () {
      applyExchange(this.value);
      setText("stockNote", "");
      calculate();
    });

    $("inStock").addEventListener("change", function () {
      var s = findStockFromInput(this.value);
      if (s) applyStock(s);
    });
    $("inStock").addEventListener("input", function () {
      var s = LABEL_MAP[this.value];
      if (s) applyStock(s);
    });

    $("calcForm").addEventListener("submit", function (e) { e.preventDefault(); calculate(); });

    calculate();
    loadStocks();
  });
})();