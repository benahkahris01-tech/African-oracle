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

  var isKenya = s.country === "Kenya";

  // ── WHAT YOU NEED BEFORE STARTING ────────────────────────────────────────
  var requirementsEl = document.getElementById("brokerGrid");

  if (isKenya) {
    // ════════════════════════════════════════════════════════════════════════
    //  NSE KENYA — THREE METHODS
    // ════════════════════════════════════════════════════════════════════════
    requirementsEl.innerHTML =

      // ── METHOD 1: ZIIDI TRADER (easiest — via M-PESA) ──────────────────
      "<div class='broker-method'>" +
        "<div class='method-badge fastest'>⚡ Fastest — No broker account needed</div>" +
        "<div class='broker-name'>Ziidi Trader via M-PESA</div>" +
        "<div class='broker-meta'>By Safaricom &amp; NSE · CMA regulated · From 1 share</div>" +
        "<div class='broker-desc'>The easiest way to buy NSE shares in Kenya. Ziidi Trader is built into the M-PESA app — no separate brokerage account, no paperwork, no branch visit. You pay directly from your M-PESA wallet. Launched February 2026 and already accounting for over 50% of daily NSE retail trades.</div>" +
        "<div class='broker-steps'>" +
          "<div class='step-title'>Step-by-step:</div>" +
          "<div class='step'><span class='step-num'>1</span><span>Open your <strong>M-PESA app</strong> on your smartphone</span></div>" +
          "<div class='step'><span class='step-num'>2</span><span>Tap <strong>Financial Services</strong> from the home menu</span></div>" +
          "<div class='step'><span class='step-num'>3</span><span>Select <strong>Ziidi Trader</strong></span></div>" +
          "<div class='step'><span class='step-num'>4</span><span>Accept the terms and conditions (first time only)</span></div>" +
          "<div class='step'><span class='step-num'>5</span><span>Search for the company you want — e.g. <strong>" + esc(s.ticker) + "</strong></span></div>" +
          "<div class='step'><span class='step-num'>6</span><span>Enter how many shares or the amount in KES you want to buy</span></div>" +
          "<div class='step'><span class='step-num'>7</span><span>Confirm with your M-PESA PIN — payment deducted instantly</span></div>" +
          "<div class='step'><span class='step-num'>8</span><span>Your shares are held under an omnibus account managed by licensed brokers. View your portfolio anytime in the M-PESA app.</span></div>" +
        "</div>" +
        "<div class='broker-notes'>" +
          "<strong>Trading hours:</strong> Monday–Friday, 9:30 AM – 3:00 PM EAT (NSE market hours only)<br/>" +
          "<strong>Fees:</strong> Approximately 1.5% per transaction<br/>" +
          "<strong>Minimum:</strong> 1 share (no minimum KES amount)<br/>" +
          "<strong>Note:</strong> Shares are held in a pooled omnibus account, not in your personal CDS account" +
        "</div>" +
        "<div class='broker-link-note'>Access via your M-PESA app → Financial Services → Ziidi Trader. No separate website or download needed.</div>" +
      "</div>" +

      // ── METHOD 2: NCBA SECURITIES (online, good for NCBA customers) ─────
      "<div class='broker-method'>" +
        "<div class='method-badge'>🏦 Best for NCBA bank customers</div>" +
        "<div class='broker-name'>NCBA Securities — Online Share Trading</div>" +
        "<div class='broker-meta'>CMA licensed · Full NSE access · Web &amp; mobile app</div>" +
        "<div class='broker-desc'>NCBA's Online Share Trading (OST) platform gives you direct, real-time access to the NSE. You own the shares in your own CDS account — unlike Ziidi's pooled model. Best choice if you already bank with NCBA or want a full personal trading account.</div>" +
        "<div class='broker-steps'>" +
          "<div class='step-title'>Step-by-step:</div>" +
          "<div class='step'><span class='step-num'>1</span><span><strong>Gather your documents:</strong> National ID or passport, KRA PIN certificate, passport photo, and a bank account</span></div>" +
          "<div class='step'><span class='step-num'>2</span><span>Visit <strong>investment-bank.ncbagroup.com</strong> and download the CDS Account Opening Form</span></div>" +
          "<div class='step'><span class='step-num'>3</span><span>Fill the form and submit at any <strong>NCBA branch</strong> or email to their investment bank team</span></div>" +
          "<div class='step'><span class='step-num'>4</span><span>Sign the <strong>Online Trading Agreement</strong> (available on the NCBA Investment Bank website)</span></div>" +
          "<div class='step'><span class='step-num'>5</span><span>Once your CDS account is created (3–5 business days), go to the NCBA Online platform and click <strong>Sign Up</strong></span></div>" +
          "<div class='step'><span class='step-num'>6</span><span>Enter your CDS account number, National ID number, and email to create your login</span></div>" +
          "<div class='step'><span class='step-num'>7</span><span><strong>Deposit funds</strong> into your trading account via M-PESA or bank transfer</span></div>" +
          "<div class='step'><span class='step-num'>8</span><span>Log in, search for <strong>" + esc(s.ticker) + "</strong>, place a buy order, and confirm</span></div>" +
          "<div class='step'><span class='step-num'>9</span><span>NCBA customers can also trade directly via the <strong>NCBA Mobile Banking app</strong> without a separate OST login</span></div>" +
        "</div>" +
        "<div class='broker-notes'>" +
          "<strong>Trading hours:</strong> Monday–Friday, 9:30 AM – 3:00 PM EAT<br/>" +
          "<strong>Fees:</strong> Standard NSE brokerage (1.8%–2.1% per transaction)<br/>" +
          "<strong>Ownership:</strong> Shares registered in your own personal CDS account" +
        "</div>" +
        "<a href='https://investment-bank.ncbagroup.com/brokerage/' target='_blank' rel='noopener noreferrer' class='broker-btn'>Visit NCBA Investment Bank →</a>" +
      "</div>" +

      // ── METHOD 3: SBG SECURITIES ────────────────────────────────────────
      "<div class='broker-method'>" +
        "<div class='method-badge'>📊 Best for research &amp; professional trading</div>" +
        "<div class='broker-name'>SBG Securities (Stanbic Kenya)</div>" +
        "<div class='broker-meta'>CMA licensed · Top 3 NSE broker · Full-service brokerage · Chiromo, Nairobi</div>" +
        "<div class='broker-desc'>SBG Securities is one of Kenya's oldest and largest stockbrokers, a subsidiary of Standard Bank Group (Stanbic Bank Kenya). They provide full-service NSE brokerage with in-house research reports and dedicated relationship managers. Best suited for investors who want professional support and research alongside their trades.</div>" +
        "<div class='broker-steps'>" +
          "<div class='step-title'>Step-by-step:</div>" +
          "<div class='step'><span class='step-num'>1</span><span><strong>Documents needed:</strong> Original National ID or passport, KRA PIN certificate, proof of residence (utility bill or bank statement), passport photo</span></div>" +
          "<div class='step'><span class='step-num'>2</span><span>Walk into <strong>Stanbic Bank Kenya, Chiromo branch</strong> or call SBG Securities directly to request account opening forms. You can also download forms at <strong>sbgsecurities.co.ke</strong></span></div>" +
          "<div class='step'><span class='step-num'>3</span><span>Complete the <strong>CDS Account Opening Form</strong> (CDS 1) — this registers you with the Central Depository and Settlement Corporation so your shares are held electronically in your name</span></div>" +
          "<div class='step'><span class='step-num'>4</span><span>Submit all documents — an SBG staff member certifies your originals. Account approval takes <strong>3–7 business days</strong></span></div>" +
          "<div class='step'><span class='step-num'>5</span><span><strong>Fund your CDS trading account</strong> via bank transfer. Use these details:<br/>Account Name: <strong>SBG SECURITIES</strong><br/>Bank: CfC Stanbic Bank<br/>Account No: <strong>0100000020499</strong><br/>Branch: Chiromo · Swift: SBICKENX<br/>Always quote your CDS account number as the reference</span></div>" +
          "<div class='step'><span class='step-num'>6</span><span>Once funds reflect, call or email your SBG relationship manager to place a <strong>buy order</strong> for " + esc(s.ticker) + " — or use their online trading platform if enabled on your account</span></div>" +
          "<div class='step'><span class='step-num'>7</span><span>Dividends are paid to your bank account automatically via EFT once registered in your CDS profile</span></div>" +
        "</div>" +
        "<div class='broker-notes'>" +
          "<strong>Trading hours:</strong> Monday–Friday, 9:00 AM – 3:00 PM EAT<br/>" +
          "<strong>Fees:</strong> Standard NSE brokerage rates (~1.8%–2.1% per transaction)<br/>" +
          "<strong>Best for:</strong> Investors who want research reports and a full-service professional experience<br/>" +
          "<strong>Minimum investment:</strong> No strict minimum for shares; bonds require KES 50,000" +
        "</div>" +
        "<a href='https://www.sbgsecurities.co.ke/sbgsecurities/securities' target='_blank' rel='noopener noreferrer' class='broker-btn'>Visit SBG Securities →</a>" +
      "</div>";

  } else {

    // ════════════════════════════════════════════════════════════════════════
    //  JSE SOUTH AFRICA — TWO METHODS
    // ════════════════════════════════════════════════════════════════════════
    requirementsEl.innerHTML =

      // ── METHOD 1: EASYEQUITIES (easiest) ────────────────────────────────
      "<div class='broker-method'>" +
        "<div class='method-badge fastest'>⚡ Easiest — fully online, from R1</div>" +
        "<div class='broker-name'>EasyEquities</div>" +
        "<div class='broker-meta'>FSCA authorised (FSP 22588) · JSE registered · 2 million+ users · From R1</div>" +
        "<div class='broker-desc'>South Africa's most accessible investment platform. You can buy fractional shares — meaning you don't need to afford a full share price. Available as a standalone app, and also built into the Capitec Banking app for Capitec customers. No monthly fees, no minimum deposit.</div>" +
        "<div class='broker-steps'>" +
          "<div class='step-title'>Step-by-step:</div>" +
          "<div class='step'><span class='step-num'>1</span><span><strong>If you bank with Capitec:</strong> Open your Capitec app → tap <strong>EasyEquities</strong> directly — you're already verified. Skip to step 6.</span></div>" +
          "<div class='step'><span class='step-num'>2</span><span>Otherwise, go to <strong>easyequities.co.za</strong> or download the EasyEquities app from Google Play or App Store</span></div>" +
          "<div class='step'><span class='step-num'>3</span><span>Click <strong>Register</strong> — enter your email, create a username and password</span></div>" +
          "<div class='step'><span class='step-num'>4</span><span>Provide your personal details: date of birth, residential address, employment status, income range</span></div>" +
          "<div class='step'><span class='step-num'>5</span><span><strong>Verify your identity (FICA):</strong> Upload your South African ID or passport, plus a proof of address (bank statement or utility bill less than 3 months old). Only PNG or JPG files accepted — not PDF.</span></div>" +
          "<div class='step'><span class='step-num'>6</span><span>Account approval typically takes <strong>24 hours to 1 week</strong></span></div>" +
          "<div class='step'><span class='step-num'>7</span><span>Once approved, select your <strong>ZAR account</strong> (for JSE shares) from the account dashboard</span></div>" +
          "<div class='step'><span class='step-num'>8</span><span><strong>Add funds</strong> via instant EFT from your bank account (Nedbank, Absa, FNB, Standard Bank, Capitec all supported)</span></div>" +
          "<div class='step'><span class='step-num'>9</span><span>Search for <strong>" + esc(s.ticker) + "</strong> in the search bar, tap <strong>Invest</strong></span></div>" +
          "<div class='step'><span class='step-num'>10</span><span>Enter the <strong>Rand amount</strong> you want to invest (e.g. R500) — EasyEquities buys fractional shares so you don't need the full share price</span></div>" +
          "<div class='step'><span class='step-num'>11</span><span>Review the order and confirm. Your shares appear in your portfolio immediately.</span></div>" +
        "</div>" +
        "<div class='broker-notes'>" +
          "<strong>Trading hours:</strong> Monday–Friday, 9:00 AM – 5:00 PM SAST (JSE market hours)<br/>" +
          "<strong>Fees:</strong> 0.25% brokerage on JSE shares + VAT. No monthly platform fee.<br/>" +
          "<strong>Tax-free option:</strong> Open a TFSA (Tax Free Savings Account) to pay zero tax on profits and dividends — annual limit R46,000<br/>" +
          "<strong>Practice first:</strong> EasyEquities offers a demo account with R100,000 virtual money before you commit real funds" +
        "</div>" +
        "<a href='https://www.easyequities.co.za' target='_blank' rel='noopener noreferrer' class='broker-btn'>Open EasyEquities Account →</a>" +
      "</div>" +

      // ── METHOD 2: STANDARD BANK OST (for Standard Bank customers) ──────
      "<div class='broker-method'>" +
        "<div class='method-badge'>🏦 Best for Standard Bank customers</div>" +
        "<div class='broker-name'>Standard Bank Online Share Trading (OST)</div>" +
        "<div class='broker-meta'>FSCA regulated · Full JSE access · Web &amp; mobile · Professional tools</div>" +
        "<div class='broker-desc'>Standard Bank's investment platform for JSE shares, ETFs, bonds and more. Full ownership — shares registered in your own name. Best for existing Standard Bank customers who want to manage investments alongside their banking in one place.</div>" +
        "<div class='broker-steps'>" +
          "<div class='step-title'>Step-by-step:</div>" +
          "<div class='step'><span class='step-num'>1</span><span><strong>Documents needed:</strong> South African ID or passport, proof of residential address, bank account details</span></div>" +
          "<div class='step'><span class='step-num'>2</span><span>Go to <strong>standardbank.co.za</strong> → Personal → Invest &amp; Save → Online Share Trading</span></div>" +
          "<div class='step'><span class='step-num'>3</span><span>Click <strong>Open an account</strong> and complete the online FICA application</span></div>" +
          "<div class='step'><span class='step-num'>4</span><span>Upload your ID and proof of address — verification takes 3–5 business days</span></div>" +
          "<div class='step'><span class='step-num'>5</span><span>Link your Standard Bank account for funding. <strong>Non-Standard Bank customers</strong> can still use EFT from other banks.</span></div>" +
          "<div class='step'><span class='step-num'>6</span><span>Once approved, log in to the Standard Bank OST platform or the Standard Bank app</span></div>" +
          "<div class='step'><span class='step-num'>7</span><span>Search for <strong>" + esc(s.ticker) + "</strong>, select Buy, choose <strong>Market order</strong> (buys at current price) or <strong>Limit order</strong> (buys only at a price you set)</span></div>" +
          "<div class='step'><span class='step-num'>8</span><span>Enter the number of shares, review total cost including fees, and confirm</span></div>" +
        "</div>" +
        "<div class='broker-notes'>" +
          "<strong>Trading hours:</strong> Monday–Friday, 9:00 AM – 5:00 PM SAST<br/>" +
          "<strong>Fees:</strong> 0.4% brokerage (min R60 per trade) + VAT<br/>" +
          "<strong>Best for:</strong> Standard Bank customers who want full share ownership and professional research tools" +
        "</div>" +
        "<a href='https://www.standardbank.co.za/southafrica/personal/products-and-services/invest-and-save/share-trading/online-share-trading' target='_blank' rel='noopener noreferrer' class='broker-btn'>Visit Standard Bank OST →</a>" +
      "</div>";
  }
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