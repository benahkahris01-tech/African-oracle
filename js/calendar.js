/* ═══════════════════════════════════════════════════════════════
   calendar.js — Earnings Calendar  (Premium feature)
   
   FREE users:    see first 3 upcoming dates only + lock gate
   PREMIUM users: full calendar, all dates, exchange filter
   
   Depends on premium.js being loaded first for isPremium(),
   requirePremium(), showTokenModal()
═══════════════════════════════════════════════════════════════ */

var EARNINGS_DATA = [
  // ── NSE KENYA ────────────────────────────────────────────────
  { ticker:"SCOM", name:"Safaricom PLC",            exchange:"NSE", date:"2026-05-09", resultType:"Full Year",  status:"reported"  },
  { ticker:"EQTY", name:"Equity Group Holdings",    exchange:"NSE", date:"2026-05-20", resultType:"Full Year",  status:"reported"  },
  { ticker:"KCB",  name:"KCB Group PLC",            exchange:"NSE", date:"2026-04-29", resultType:"Full Year",  status:"reported"  },
  { ticker:"COOP", name:"Co-operative Bank Kenya",  exchange:"NSE", date:"2026-04-24", resultType:"Full Year",  status:"reported"  },
  { ticker:"ABSA", name:"Absa Bank Kenya",          exchange:"NSE", date:"2026-04-15", resultType:"Full Year",  status:"reported"  },
  { ticker:"NCBA", name:"NCBA Group PLC",           exchange:"NSE", date:"2026-04-22", resultType:"Full Year",  status:"reported"  },
  { ticker:"SCBK", name:"Standard Chartered Kenya", exchange:"NSE", date:"2026-04-30", resultType:"Full Year",  status:"reported"  },
  { ticker:"SBIC", name:"Stanbic Bank Kenya",       exchange:"NSE", date:"2026-05-28", resultType:"Full Year",  status:"estimated" },
  { ticker:"DTK",  name:"Diamond Trust Bank",       exchange:"NSE", date:"2026-05-30", resultType:"Full Year",  status:"estimated" },
  { ticker:"IMH",  name:"I&M Holdings",             exchange:"NSE", date:"2026-06-05", resultType:"Full Year",  status:"estimated" },
  { ticker:"HFCK", name:"HF Group",                 exchange:"NSE", date:"2026-06-10", resultType:"Full Year",  status:"estimated" },
  { ticker:"BAT",  name:"BAT Kenya PLC",            exchange:"NSE", date:"2026-07-15", resultType:"Half Year",  status:"estimated" },
  { ticker:"JUB",  name:"Jubilee Holdings",         exchange:"NSE", date:"2026-08-10", resultType:"Half Year",  status:"estimated" },
  { ticker:"NMG",  name:"Nation Media Group",       exchange:"NSE", date:"2026-08-05", resultType:"Half Year",  status:"estimated" },
  { ticker:"EABL", name:"East African Breweries",   exchange:"NSE", date:"2026-08-20", resultType:"Full Year",  status:"estimated" },
  { ticker:"KUKZ", name:"Kakuzi PLC",               exchange:"NSE", date:"2026-08-25", resultType:"Half Year",  status:"estimated" },
  { ticker:"TOTL", name:"TotalEnergies Kenya",      exchange:"NSE", date:"2026-09-10", resultType:"Half Year",  status:"estimated" },
  { ticker:"KPLC", name:"Kenya Power",              exchange:"NSE", date:"2026-11-15", resultType:"Half Year",  status:"estimated" },
  // ── JSE SOUTH AFRICA ─────────────────────────────────────────
  { ticker:"ABG",  name:"Absa Group Limited",       exchange:"JSE", date:"2026-06-05", resultType:"Half Year",  status:"confirmed" },
  { ticker:"NPN",  name:"Naspers Limited",          exchange:"JSE", date:"2026-06-24", resultType:"Full Year",  status:"confirmed" },
  { ticker:"MRP",  name:"Mr Price Group",           exchange:"JSE", date:"2026-06-17", resultType:"Full Year",  status:"confirmed" },
  { ticker:"VOD",  name:"Vodacom Group",            exchange:"JSE", date:"2026-06-09", resultType:"Full Year",  status:"confirmed" },
  { ticker:"TKG",  name:"Telkom SA",                exchange:"JSE", date:"2026-06-03", resultType:"Full Year",  status:"estimated" },
  { ticker:"INL",  name:"Investec Limited",         exchange:"JSE", date:"2026-06-12", resultType:"Full Year",  status:"estimated" },
  { ticker:"NED",  name:"Nedbank Group",            exchange:"JSE", date:"2026-07-31", resultType:"Half Year",  status:"estimated" },
  { ticker:"BTI",  name:"BAT PLC (JSE)",            exchange:"JSE", date:"2026-07-30", resultType:"Half Year",  status:"estimated" },
  { ticker:"MTN",  name:"MTN Group Limited",        exchange:"JSE", date:"2026-08-05", resultType:"Half Year",  status:"estimated" },
  { ticker:"ANG",  name:"AngloGold Ashanti",        exchange:"JSE", date:"2026-08-06", resultType:"Half Year",  status:"estimated" },
  { ticker:"GFI",  name:"Gold Fields Limited",      exchange:"JSE", date:"2026-08-13", resultType:"Half Year",  status:"estimated" },
  { ticker:"SBK",  name:"Standard Bank Group",      exchange:"JSE", date:"2026-08-20", resultType:"Half Year",  status:"estimated" },
  { ticker:"REM",  name:"Remgro Limited",           exchange:"JSE", date:"2026-08-25", resultType:"Full Year",  status:"estimated" },
  { ticker:"FSR",  name:"FirstRand Limited",        exchange:"JSE", date:"2026-09-10", resultType:"Full Year",  status:"estimated" },
  { ticker:"SHP",  name:"Shoprite Holdings",        exchange:"JSE", date:"2026-09-15", resultType:"Full Year",  status:"estimated" },
  { ticker:"OUT",  name:"OUTsurance Group",         exchange:"JSE", date:"2026-09-17", resultType:"Full Year",  status:"estimated" },
  { ticker:"CPI",  name:"Capitec Bank Holdings",    exchange:"JSE", date:"2026-09-23", resultType:"Full Year",  status:"estimated" },
  { ticker:"DSY",  name:"Discovery Limited",        exchange:"JSE", date:"2026-09-08", resultType:"Full Year",  status:"estimated" },
  { ticker:"GRT",  name:"Growthpoint Properties",   exchange:"JSE", date:"2026-09-02", resultType:"Full Year",  status:"estimated" },
  { ticker:"CFR",  name:"Compagnie Financière Richemont", exchange:"JSE", date:"2026-11-08", resultType:"Half Year", status:"estimated" }
];

// ── Boot ──────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", function () {
  if (!document.getElementById("calContent")) return;

  var premium = (typeof isPremium === "function") && isPremium();

  // Show premium status bar if subscriber
  if (premium) {
    var info    = (typeof getPremiumInfo === "function") ? getPremiumInfo() : null;
    var bar     = document.getElementById("calPremiumBar");
    if (bar && info) {
      bar.innerHTML =
        '<div class="premium-status-bar">' +
          '<span class="premium-status-icon">◈</span>' +
          '<span class="premium-status-text">' +
            '<strong>Premium active</strong> · ' + info.tier + ' plan · ' +
            'Expires ' + info.expiry + ' · ' +
            '<span class="priority-badge">⚡ Live data</span>' +
          '</span>' +
          '<button class="premium-sign-out" onclick="premiumLogout()">Sign out</button>' +
        '</div>';
    }
  }

  // Hide exchange toggle for free users
  var toggle = document.querySelector(".cal-exchange-toggle");
  if (toggle && !premium) toggle.style.display = "none";

  bindToggle();
  loadAndRender("all", premium);
});

// ── Exchange toggle ───────────────────────────────────────────
function bindToggle() {
  document.querySelectorAll(".cal-toggle").forEach(function (btn) {
    btn.addEventListener("click", function () {
      if (!(typeof isPremium === "function" && isPremium())) return;
      document.querySelectorAll(".cal-toggle").forEach(function (b) {
        b.classList.remove("active");
      });
      this.classList.add("active");
      loadAndRender(this.dataset.ex, true);
    });
  });
}

// ── Load stock data then render ───────────────────────────────
function loadAndRender(exchange, premium) {
  var CACHE_KEY = "oracle_data";
  var CACHE_TTL = 10 * 60 * 1000;
  var stockMap  = {};

  // Premium users: try priority endpoint first (bypasses 6hr cache)
  if (premium && typeof API_URL !== "undefined" && API_URL &&
      API_URL !== "PASTE_YOUR_APPS_SCRIPT_URL_HERE") {
    var token = "";
    try { token = localStorage.getItem("oracle_premium_token") || ""; } catch (e) {}
    if (token) {
      fetch(API_URL + "?action=priority&token=" + encodeURIComponent(token))
        .then(function (r) { return r.json(); })
        .then(function (json) {
          if (json && json.data) {
            var list = Array.isArray(json.data) ? json.data : [];
            list.forEach(function (s) { stockMap[s.ticker] = s; });
          }
          renderCalendar(exchange, stockMap, premium);
        })
        .catch(function () { renderCalendar(exchange, {}, premium); });
      return;
    }
  }

  // Free users or fallback: sessionStorage cache
  try {
    var cached = sessionStorage.getItem(CACHE_KEY);
    if (cached) {
      var parsed = JSON.parse(cached);
      if (parsed && parsed.ts && (Date.now() - parsed.ts < CACHE_TTL) && parsed.data) {
        parsed.data.forEach(function (s) { stockMap[s.ticker] = s; });
        renderCalendar(exchange, stockMap, premium);
        return;
      }
    }
  } catch (e) {}

  if (typeof API_URL !== "undefined" && API_URL &&
      API_URL !== "PASTE_YOUR_APPS_SCRIPT_URL_HERE") {
    fetch(API_URL)
      .then(function (r) { return r.json(); })
      .then(function (json) {
        if (json && json.data) {
          var list = Array.isArray(json.data) ? json.data : [];
          list.forEach(function (s) { stockMap[s.ticker] = s; });
          try {
            sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: list }));
          } catch (e) {}
        }
        renderCalendar(exchange, stockMap, premium);
      })
      .catch(function () { renderCalendar(exchange, {}, premium); });
  } else {
    renderCalendar(exchange, {}, premium);
  }
}

// ── Render calendar ───────────────────────────────────────────
function renderCalendar(exchange, stockMap, premium) {
  var today  = new Date(); today.setHours(0,0,0,0);
  var past60 = new Date(today); past60.setDate(past60.getDate() - 60);

  var pool = EARNINGS_DATA.filter(function (e) {
    return exchange === "all" || e.exchange === exchange;
  });

  var upcoming = [], recent = [];
  pool.forEach(function (e) {
    var d = new Date(e.date);
    if (d >= today)       upcoming.push(e);
    else if (d >= past60) recent.push(e);
  });

  upcoming.sort(function (a,b) { return new Date(a.date)-new Date(b.date); });
  recent.sort(function   (a,b) { return new Date(b.date)-new Date(a.date); });

  if (premium) {
    // ── PREMIUM: show everything ──────────────────────────────
    renderList("upcomingList", upcoming, stockMap, false);
    renderList("recentList",   recent,   stockMap, true);
  } else {
    // ── FREE: show first 3 upcoming, then lock ────────────────
    var preview  = upcoming.slice(0, 3);
    var locked   = upcoming.slice(3);

    renderList("upcomingList", preview, stockMap, false);

    // Append lock gate after the 3 preview entries
    var upcomingContainer = document.getElementById("upcomingList");
    if (upcomingContainer && (locked.length > 0 || recent.length > 0)) {
      var gate = document.createElement("div");
      gate.className = "premium-gate";
      gate.innerHTML =
        '<div class="premium-gate-icon">◈</div>' +
        '<div class="premium-gate-title">Full Calendar — Premium Feature</div>' +
        '<div class="premium-gate-desc">' +
          'You are seeing 3 of ' + upcoming.length + ' upcoming earnings dates. ' +
          'Subscribe to see the full calendar for all NSE and JSE companies, ' +
          'including recently reported results.' +
        '</div>' +
        '<div class="premium-gate-price">' +
          '<div class="price-option">' +
            '<div class="price-amount">KES 800</div>' +
            '<div class="price-period">per month</div>' +
          '</div>' +
          '<div class="price-divider">or</div>' +
          '<div class="price-option featured">' +
            '<div class="price-amount">KES 7,200</div>' +
            '<div class="price-period">per year <span class="price-save">Save 25%</span></div>' +
          '</div>' +
        '</div>' +
        '<a href="premium.html" class="premium-gate-btn">View Premium Plans →</a>' +
        '<div class="premium-gate-token">' +
          '<p>Already subscribed? Enter your access token to unlock.</p>' +
          '<div class="token-input-row">' +
            '<input type="text" id="calTokenInput" class="token-input" ' +
                   'placeholder="ORC-XXXX-XXXX-XXXX-XXXX" />' +
            '<button id="calTokenBtn" class="token-submit-btn">Verify</button>' +
          '</div>' +
          '<div id="calTokenErr" class="token-error hidden"></div>' +
        '</div>';

      upcomingContainer.appendChild(gate);

      // Bind token entry
      document.getElementById("calTokenBtn").addEventListener("click", function () {
        var token = document.getElementById("calTokenInput").value.trim().toUpperCase();
        var err   = document.getElementById("calTokenErr");
        if (!token) { err.textContent = "Please enter your token."; err.classList.remove("hidden"); return; }
        this.textContent = "Verifying…"; this.disabled = true;
        if (typeof verifyAndStore === "function") {
          verifyAndStore(token,
            function () { window.location.reload(); },
            function (msg) {
              document.getElementById("calTokenBtn").textContent = "Verify";
              document.getElementById("calTokenBtn").disabled = false;
              err.textContent = "⚠ " + msg; err.classList.remove("hidden");
            }
          );
        }
      });
    }

    // Hide recent section entirely for free users
    var recentGroup = document.getElementById("recentGroup");
    if (recentGroup) recentGroup.style.display = "none";
  }

  hide("calLoading");
  show("calContent");
}

// ── Render one list ───────────────────────────────────────────
function renderList(containerId, entries, stockMap, isRecent) {
  var container = document.getElementById(containerId);
  if (!container) return;

  if (!entries || entries.length === 0) {
    container.innerHTML = '<div class="cal-empty">No entries for this period.</div>';
    return;
  }

  var html = "";
  entries.forEach(function (e) {
    var d         = new Date(e.date);
    var day       = d.getDate();
    var month     = d.toLocaleString("default", { month:"short" }).toUpperCase();
    var stock     = stockMap[e.ticker] || {};
    var cur       = e.exchange === "NSE" ? "KES " : "R";
    var priceStr  = stock.price ? cur + Number(stock.price).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}) : "—";
    var sig       = stock.pe ? _calSignal(stock) : null;
    var sigHtml   = sig ? _calSignalHtml(sig) : "";
    var statusCls = isRecent ? "reported" : e.status;
    var statusLbl = isRecent ? "Reported" : (e.status==="confirmed" ? "Confirmed" : "Estimated");
    var href      = "stock.html?ticker=" + encodeURIComponent(e.ticker) +
                    "&country=" + encodeURIComponent(e.exchange==="NSE" ? "Kenya" : "S. Africa");

    html +=
      '<a href="' + href + '" class="cal-card ' + statusCls + '">' +
        '<div class="cal-date-col">' +
          '<div class="cal-date-day">'   + day   + '</div>' +
          '<div class="cal-date-month">' + month + '</div>' +
        '</div>' +
        '<div class="cal-company-col">' +
          '<div class="cal-company-ticker">' + esc(e.ticker) + '</div>' +
          '<div class="cal-company-name">'   + esc(e.name)   + '</div>' +
          '<div class="cal-company-meta">' +
            '<span class="cal-exch ' + e.exchange.toLowerCase() + '">' + e.exchange + '</span>' +
            '<span class="cal-result-type">' + esc(e.resultType) + '</span>' +
            (stock.price ? '<span style="font-family:var(--fm);font-size:11px;color:#C0C0C0">Price: ' + priceStr + '</span>' : '') +
            sigHtml +
          '</div>' +
        '</div>' +
        '<div class="cal-status-col">' +
          '<span class="cal-status-badge ' + statusCls + '">' + statusLbl + '</span>' +
        '</div>' +
      '</a>';
  });

  container.innerHTML = html;
}

// ── Signal helpers ────────────────────────────────────────────
function _calSignal(s) {
  var pe=parseFloat(s.pe),peg=parseFloat(s.peg),gr=parseFloat(s.earningsGrowth),div=parseFloat(s.divYield);
  var moat=s.moat||"",str=s.finStrength||"";
  if(isNaN(pe)||pe<=0) return "avoid";
  if(str==="Weak"&&moat==="None") return "avoid";
  if(!isNaN(gr)&&gr<-5) return "avoid";
  var sc=0;
  if(moat==="Wide")sc+=2; if(moat==="Narrow")sc+=1;
  if(str==="Strong")sc+=2; if(str==="Adequate")sc+=1;
  if(!isNaN(peg)&&peg>0&&peg<1)sc+=2;
  if(pe>0&&pe<12)sc+=2; if(pe>=12&&pe<20)sc+=1;
  if(!isNaN(gr)&&gr>15)sc+=2; else if(!isNaN(gr)&&gr>5)sc+=1;
  if(!isNaN(div)&&div>0.05)sc+=1;
  return sc>=7?"buy":sc>=4?"watch":sc>=1?"neutral":"avoid";
}
function _calSignalHtml(sig) {
  var lbl={buy:"● Buy",watch:"◐ Watch",avoid:"○ Avoid",neutral:"– Neutral"};
  var cls={buy:"signal-buy",watch:"signal-watch",avoid:"signal-avoid",neutral:"signal-neutral"};
  return '<span class="signal '+(cls[sig]||"")+'" style="font-size:10px;padding:1px 7px;">'+(lbl[sig]||"")+'</span>';
}
function esc(s){return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
function show(id){var el=document.getElementById(id);if(el)el.classList.remove("hidden");}
function hide(id){var el=document.getElementById(id);if(el)el.classList.add("hidden");}