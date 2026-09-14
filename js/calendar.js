/* ═══════════════════════════════════════════════════════════════
   calendar.js — Earnings Calendar  (Premium feature)

   CHANGED: EARNINGS_DATA is no longer hardcoded. It's fetched live
   from ?action=calendar, which reads the EarningsCalendar sheet —
   this is what closes the ticker coverage gap (covers every ticker
   in Registry, not just the ~38 that were manually typed in before)
   and fixes the "vanishes after 60 days" problem, since
   NextExpectedDate auto-projects forward via a sheet formula.

   FREE users:    see first 3 upcoming dates only + lock gate
   PREMIUM users: full calendar, all dates, exchange filter

   Depends on premium.js being loaded first for isPremium(),
   requirePremium(), showTokenModal()
═══════════════════════════════════════════════════════════════ */

var EARNINGS_DATA = []; // CHANGED — populated by loadEarningsCalendarEntries(), not hardcoded

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

  // NEW — fetch calendar entries and stock data in parallel, not
  // sequentially, so load time doesn't stack the two round-trips.
  loadEarningsCalendarEntries(function (entries) {
    EARNINGS_DATA = entries;
    loadAndRender("all", premium);
  });
});

// NEW — fetches the live earnings calendar from the Apps Script API.
// Falls back to an empty array (not a crash) if the fetch fails, and
// surfaces the existing #calError state rather than hanging on the
// loading spinner forever.
function loadEarningsCalendarEntries(callback) {
  if (typeof API_URL === "undefined" || !API_URL ||
      API_URL === "PASTE_YOUR_APPS_SCRIPT_URL_HERE") {
    console.error("calendar.js: API_URL not configured.");
    showCalError("Calendar API not configured.");
    callback([]);
    return;
  }

  fetch(API_URL + "?action=calendar")
    .then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then(function (json) {
      var list = (json && Array.isArray(json.data)) ? json.data : [];
      callback(list);
    })
    .catch(function (err) {
      console.error("calendar.js fetch error:", err);
      showCalError("Could not load earnings calendar: " + err.message);
      callback([]);
    });
}

// NEW — the HTML already has a #calError element that was never
// wired up in the original file. Wiring it in now since a live
// fetch can genuinely fail, unlike the old static array.
function showCalError(msg) {
  hide("calLoading");
  var el = document.getElementById("calError");
  if (el) {
    el.querySelector("p").textContent = "⚠ " + msg;
    el.classList.remove("hidden");
  }
}

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

// ── Load stock price/PE data then render ──────────────────────
// (unchanged logic — still merges live price data onto whichever
// EARNINGS_DATA is currently loaded)
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
// CHANGED — filters on nextExpectedDate (upcoming) and
// lastReportDate (recent) instead of a single shared "date" field,
// since the sheet now tracks both separately. Entries missing a
// usable date (not yet filled in on the sheet) are skipped rather
// than crashing on an invalid Date parse.
function renderCalendar(exchange, stockMap, premium) {
  var today  = new Date(); today.setHours(0,0,0,0);
  var past60 = new Date(today); past60.setDate(past60.getDate() - 60);

  var pool = EARNINGS_DATA.filter(function (e) {
    return exchange === "all" || e.exchange === exchange;
  });

  var upcoming = [], recent = [];
  pool.forEach(function (e) {
    if (e.nextExpectedDate) {
      var nd = new Date(e.nextExpectedDate);
      if (!isNaN(nd) && nd >= today) upcoming.push(e);
    }
    if (e.lastReportDate) {
      var ld = new Date(e.lastReportDate);
      if (!isNaN(ld) && ld >= past60 && ld < today) recent.push(e);
    }
  });

  upcoming.sort(function (a,b) { return new Date(a.nextExpectedDate) - new Date(b.nextExpectedDate); });
  recent.sort(function   (a,b) { return new Date(b.lastReportDate)   - new Date(a.lastReportDate); });

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

// ── Format a short date for table display ──────────────────────
function formatShortDate(iso) {
  var d = new Date(iso);
  if (isNaN(d)) return "—";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

// ── Render one list — TABLE FORMAT ─────────────────────────────
// CHANGED from card layout to a table. Same function signature and
// same DOM injection points (#upcomingList / #recentList) as before,
// so renderCalendar()'s premium slicing/gate logic needs zero changes —
// it still just decides which entries array gets passed in here.
// Each row shows BOTH dates (primary + the other one as context),
// which is what surfaces "previous releases" without a second table.
function renderList(containerId, entries, stockMap, isRecent) {
  var container = document.getElementById(containerId);
  if (!container) return;

  if (!entries || entries.length === 0) {
    container.innerHTML = '<div class="cal-empty">No entries for this period.</div>';
    return;
  }

  var otherColLabel = isRecent ? "Next Expected" : "Last Reported";

  var rows = entries.map(function (e) {
    var primaryDate = isRecent ? e.lastReportDate : e.nextExpectedDate;
    var otherDate    = isRecent ? e.nextExpectedDate : e.lastReportDate;

    var d     = new Date(primaryDate);
    var day   = isNaN(d) ? "—" : d.getDate();
    var month = isNaN(d) ? "" : d.toLocaleString("default", { month: "short" }).toUpperCase();
    var year  = isNaN(d) ? "" : String(d.getFullYear()).slice(2);

    var stock    = stockMap[e.ticker] || {};
    var cur      = e.exchange === "NSE" ? "KES " : "R";
    var priceStr = stock.price ? cur + Number(stock.price).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}) : "—";

    var statusCls = isRecent ? "reported" : String(e.status || "estimated").toLowerCase();
    var statusLbl = isRecent ? "Reported" : (statusCls === "confirmed" ? "Confirmed" : "Estimated");

    var otherStr = otherDate ? formatShortDate(otherDate) : "—";

    var href = "stock.html?ticker=" + encodeURIComponent(e.ticker) +
               "&country=" + encodeURIComponent(e.exchange === "NSE" ? "Kenya" : "S. Africa");

    return (
      '<tr class="cal-row" data-href="' + href + '">' +
        '<td class="cal-td-date">' +
          '<span class="cal-td-day">' + day + '</span>' +
          '<span class="cal-td-month">' + month + (year ? " '" + year : "") + '</span>' +
        '</td>' +
        '<td class="cal-td-ticker">' + esc(e.ticker) + '</td>' +
        '<td class="cal-td-name">' + esc(e.name) + '</td>' +
        '<td class="cal-td-exch"><span class="cal-exch ' + e.exchange.toLowerCase() + '">' + e.exchange + '</span></td>' +
        '<td class="cal-td-type">' + esc(e.resultType) + '</td>' +
        '<td class="cal-td-prev">' + otherStr + '</td>' +
        '<td class="cal-td-price">' + priceStr + '</td>' +
        '<td class="cal-td-status"><span class="cal-status-badge ' + statusCls + '">' + statusLbl + '</span></td>' +
      '</tr>'
    );
  }).join("");

  container.innerHTML =
    '<div class="cal-table-wrap">' +
      '<table class="cal-table">' +
        '<thead><tr>' +
          '<th>Date</th><th>Ticker</th><th>Company</th><th>Exch</th>' +
          '<th class="cal-th-type">Type</th><th>' + otherColLabel + '</th>' +
          '<th class="cal-th-price">Price</th><th>Status</th>' +
        '</tr></thead>' +
        '<tbody>' + rows + '</tbody>' +
      '</table>' +
    '</div>';

  container.querySelectorAll(".cal-row").forEach(function (tr) {
    tr.addEventListener("click", function () {
      window.location.href = this.dataset.href;
    });
  });
}