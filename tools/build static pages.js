#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════
   build-static-pages.js — The African Oracle
   Generates one real, crawlable HTML page per company (stocks/<ticker>-<nse|jse>.html)
   with the company name, numbers and written profile ALREADY IN THE HTML,
   so reviewers/crawlers don't depend on JavaScript to see the content.
   Also writes sitemap-stocks.xml.

   Run from the repo root (the folder containing stock.html and js/stock.js):

     node tools/build-static-pages.js                      # fetches from Supabase
     node tools/build-static-pages.js --data stocks.json   # use a local JSON file

   Supabase mode needs two environment variables (the PUBLIC anon key is fine):
     SUPABASE_URL=https://xxxx.supabase.co
     SUPABASE_ANON_KEY=eyJ...
   Optional: SITE_URL (default https://africanoracle.info)

   No npm packages. Needs Node 18+.
   ═══════════════════════════════════════════════════════════════════════ */

"use strict";
var fs   = require("fs");
var path = require("path");
var vm   = require("vm");

var SITE_URL = (process.env.SITE_URL || "https://africanoracle.info").replace(/\/+$/, "");
var ROOT     = process.cwd();
var OUT_DIR  = path.join(ROOT, "stocks");

// ── helpers ───────────────────────────────────────────────────────────────
function esc(s) {
  return String(s === null || s === undefined ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function num(v) { var n = parseFloat(v); return isNaN(n) ? null : n; }
function exchangeOf(country) { return country === "Kenya" ? "NSE" : "JSE"; }
function exchangeName(ex) {
  return ex === "NSE" ? "Nairobi Securities Exchange (NSE)" : "Johannesburg Stock Exchange (JSE)";
}
function slugFor(s) {
  return String(s.ticker).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") +
         "-" + exchangeOf(s.country).toLowerCase();
}
function money(v, cur) {
  var n = num(v);
  if (n === null) return null;
  var sym = cur === "ZAR" ? "R" : "KES ";
  return sym + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function truncate(s, max) {
  s = String(s);
  return s.length <= max ? s : s.slice(0, max - 1).replace(/\s+\S*$/, "") + "…";
}

// Supabase snake_case → the camelCase shape stock.js uses. Tolerant of either.
function normalizeRow(r) {
  function pick(a, b) { return r[a] !== undefined ? r[a] : r[b]; }
  var vb = pick("val_breakdown", "valBreakdown");
  if (typeof vb === "string") { try { vb = JSON.parse(vb); } catch (e) { vb = null; } }
  return {
    ticker: r.ticker, name: r.name, sector: r.sector, country: r.country,
    currency: r.currency, price: r.price, eps: r.eps,
    beginEps: pick("begin_eps", "beginEps"), endEps: pick("end_eps", "endEps"),
    earningsGrowth: pick("earnings_growth", "earningsGrowth"),
    pe: r.pe, peg: r.peg, divYield: pick("div_yield", "divYield"),
    debtEquity: pick("debt_equity", "debtEquity"),
    predictability: r.predictability, moat: r.moat,
    finStrength: pick("fin_strength", "finStrength"),
    intrinsicValue: pick("intrinsic_value", "intrinsicValue"),
    confidence: r.confidence, valBreakdown: vb,
    lastUpdated: pick("last_updated", "lastUpdated")
  };
}

// ── pull COMPANY_PROFILES + generateFallbackProfile out of js/stock.js ─────
// Brace matcher that understands strings and comments.
function matchBraces(src, openIdx) {
  var depth = 0, i = openIdx, n = src.length;
  while (i < n) {
    var c = src[i], d = src[i + 1];
    if (c === "/" && d === "/") { i = src.indexOf("\n", i); if (i < 0) break; continue; }
    if (c === "/" && d === "*") { i = src.indexOf("*/", i + 2); if (i < 0) break; i += 2; continue; }
    if (c === '"' || c === "'" || c === "`") {
      var q = c; i++;
      while (i < n && src[i] !== q) { if (src[i] === "\\") i++; i++; }
      i++; continue;
    }
    if (c === "{") depth++;
    if (c === "}") { depth--; if (depth === 0) return i; }
    i++;
  }
  throw new Error("Unbalanced braces while parsing js/stock.js");
}

function loadProfiles(stockJsPath) {
  var src = fs.readFileSync(stockJsPath, "utf8");

  var pIdx = src.indexOf("var COMPANY_PROFILES");
  if (pIdx < 0) throw new Error("COMPANY_PROFILES not found in " + stockJsPath);
  var pOpen = src.indexOf("{", pIdx);
  var pClose = matchBraces(src, pOpen);
  var profiles = vm.runInNewContext("(" + src.slice(pOpen, pClose + 1) + ")", {});

  var fIdx = src.indexOf("function generateFallbackProfile");
  if (fIdx < 0) throw new Error("generateFallbackProfile not found in " + stockJsPath);
  var fOpen = src.indexOf("{", fIdx);
  var fClose = matchBraces(src, fOpen);
  var fallback = vm.runInNewContext("(" + src.slice(fIdx, fClose + 1) + ")", {});

  return { profiles: profiles, fallback: fallback };
}

// profiles are keyed by ticker only, so BAT (NSE) and BAT (JSE) would collide.
// Refuse a profile whose text is clearly about the other exchange.
function profileFor(s, P) {
  var p = P.profiles[s.ticker];
  var ex = exchangeOf(s.country);
  if (p) {
    var head = (p.about || "").slice(0, 300);
    var wrong = (ex === "JSE" && /Kenya|Nairobi/.test(head)) ||
                (ex === "NSE" && /Johannesburg|South Africa/.test(head));
    if (!wrong) return { p: p, hand: true };
    console.warn("  ! " + s.ticker + " (" + ex + "): hand-written profile is for the other exchange — using generated profile");
  }
  return { p: P.fallback(s), hand: false };
}

// ── page pieces ───────────────────────────────────────────────────────────
var METHOD_LABELS = {
  "DCF-FCF": "Discounted free cash flow", "RIM": "Residual income",
  "DDM": "Dividend discount", "DEPS": "Discounted EPS",
  "PB-J": "Justified price-to-book", "RIM+PB-J": "Residual income + justified P/B (combined)"
};

function snapshotRows(s, cur) {
  var rows = [];
  function add(label, val) { if (val !== null && val !== undefined && val !== "") rows.push([label, val]); }
  var pe = num(s.pe), peg = num(s.peg), dy = num(s.divYield), de = num(s.debtEquity),
      eps = num(s.eps), g = num(s.earningsGrowth), iv = num(s.intrinsicValue);
  add("Share price", money(s.price, cur));
  add("Earnings per share (EPS)", eps !== null ? money(eps, cur) : null);
  add("P/E ratio", pe !== null && pe > 0 ? pe.toFixed(1) + "x" : null);
  add("PEG ratio", peg !== null && peg > 0 ? peg.toFixed(2) : null);
  add("Dividend yield", dy !== null && dy > 0 ? (dy * 100).toFixed(1) + "%" : null);
  add("Debt-to-equity", de !== null ? de.toFixed(2) : null);
  add("Earnings growth (5-year)", g !== null ? g.toFixed(0) + "%" : null);
  add("Economic moat", s.moat);
  add("Financial strength", s.finStrength);
  add("Earnings predictability", s.predictability);
  add("Estimated intrinsic value", iv !== null && iv > 0 ? money(iv, cur) : null);
  if (iv !== null && iv > 0 && s.confidence) add("Valuation confidence", s.confidence);
  return rows;
}

function valuationList(s, cur) {
  var vb = s.valBreakdown;
  if (!vb || typeof vb !== "object") return "";
  var items = [];
  Object.keys(vb).forEach(function (k) {
    var v = num(vb[k]);
    if (v === null || v <= 0) return;
    items.push("<li><span>" + esc(METHOD_LABELS[k] || k) + "</span> <strong>" + esc(money(v, cur)) + "</strong></li>");
  });
  if (!items.length) return "";
  return '<h2>Valuation methods</h2>' +
    '<p>Each model estimates what one share may be worth from different inputs. ' +
    'Where they agree, the estimate is more reliable; where they diverge, treat it with caution.</p>' +
    '<ul class="sp-list">' + items.join("") + "</ul>";
}

function peersList(s, all, slugs) {
  var ex = exchangeOf(s.country);
  var peers = all.filter(function (o) {
    return o !== s && o.sector && o.sector === s.sector && exchangeOf(o.country) === ex;
  }).slice(0, 6);
  if (!peers.length) return "";
  var li = peers.map(function (o) {
    var pe = num(o.pe);
    return '<li><a href="stocks/' + slugs.get(o) + '.html">' + esc(o.name) + " (" + esc(o.ticker) + ")</a>" +
           (pe !== null && pe > 0 ? " <span>P/E " + pe.toFixed(1) + "x</span>" : "") + "</li>";
  }).join("");
  return "<h2>Other " + esc(s.sector) + " companies on the " + ex + "</h2>" +
         '<ul class="sp-list">' + li + "</ul>";
}

var STATIC_CSS =
  "<style>" +
  "#staticProfile{max-width:960px;margin:0 auto;padding:24px 20px 8px;line-height:1.65}" +
  "#staticProfile h1{margin:.2em 0 .1em}#staticProfile h2{margin:1.4em 0 .4em;font-size:1.2em}" +
  "#staticProfile .sp-crumbs{font-size:.85em;opacity:.75}" +
  "#staticProfile .sp-meta{opacity:.8;margin:0 0 1em}" +
  "#staticProfile table{border-collapse:collapse;width:100%;max-width:560px}" +
  "#staticProfile td,#staticProfile th{text-align:left;padding:7px 10px;border-bottom:1px solid rgba(128,128,128,.3)}" +
  "#staticProfile th{font-weight:500;opacity:.8}" +
  "#staticProfile .sp-list{padding-left:1.1em}#staticProfile .sp-list li{margin:.25em 0}" +
  "#staticProfile .sp-list span{opacity:.8}" +
  "#staticProfile .sp-note{font-size:.85em;opacity:.75;margin-top:1.5em}" +
  "</style>";

function buildStaticSection(s, all, slugs, P) {
  var cur = s.currency || (s.country === "Kenya" ? "KES" : "ZAR");
  var ex = exchangeOf(s.country);
  var prof = profileFor(s, P).p;
  var rows = snapshotRows(s, cur);
  var asOf = s.lastUpdated ? String(s.lastUpdated).slice(0, 10) : new Date().toISOString().slice(0, 10);

  var table = rows.length
    ? '<h2>Key figures</h2><table><tbody>' +
      rows.map(function (r) { return "<tr><th scope=\"row\">" + esc(r[0]) + "</th><td>" + esc(r[1]) + "</td></tr>"; }).join("") +
      "</tbody></table>"
    : "";

  var paras = [prof.about, prof.highlight, prof.investor].filter(Boolean)
    .map(function (t) { return "<p>" + esc(t) + "</p>"; }).join("");

  return '<main id="staticProfile">' +
    '<nav class="sp-crumbs" aria-label="Breadcrumb"><a href="index.html">Screener</a> › ' + esc(ex) + " › " + esc(s.ticker) + "</nav>" +
    "<h1>" + esc(s.name) + " (" + esc(s.ticker) + ")</h1>" +
    '<p class="sp-meta">' + esc(exchangeName(ex)) + (s.sector ? " · " + esc(s.sector) : "") +
      (s.country ? " · " + esc(s.country) : "") + " · prices in " + esc(cur) + "</p>" +
    "<h2>About " + esc(s.name) + "</h2>" + paras +
    table + valuationList(s, cur) + peersList(s, all, slugs) +
    '<p class="sp-note">Figures as of ' + esc(asOf) + ". Sourced from public filings and exchange data; " +
      'see <a href="about.html">how we gather and calculate our data</a> and the <a href="learn.html">plain-English glossary</a>. ' +
      "This is information, not financial advice, and not a recommendation to buy, sell or hold any security.</p>" +
    "</main>";
}

function buildHead(s, slug) {
  var ex = exchangeOf(s.country);
  var pe = num(s.pe);
  var title = truncate(s.name + " (" + s.ticker + ") — " + ex + " stock analysis: P/E, EPS & intrinsic value | The African Oracle", 110);
  var desc = s.name + " (" + s.ticker + ") is listed on the " + exchangeName(ex) + "." +
    (s.sector ? " Sector: " + s.sector + "." : "") +
    (pe !== null && pe > 0 ? " P/E " + pe.toFixed(1) + "x." : "") +
    " See EPS growth, moat, financial strength and valuation estimates.";
  desc = truncate(desc, 158);
  return { title: title, desc: desc, url: SITE_URL + "/stocks/" + slug + ".html" };
}

// ── turn the template stock.html into one company's static page ───────────
function buildPage(template, s, slug, all, slugs, P) {
  var h = buildHead(s, slug);
  var html = template;

  // title + description (keep the ids stock.js writes to)
  html = html.replace(/<title id="pageTitle">[\s\S]*?<\/title>/, '<title id="pageTitle">' + esc(h.title) + "</title>");
  html = html.replace(/<meta name="description" id="pageDesc" content="[^"]*"\s*\/?>/,
    '<meta name="description" id="pageDesc" content="' + esc(h.desc) + '" />');

  // base href (pages live in /stocks/ but assets/links are root-relative), canonical, OG
  var headExtra =
    '<base href="/" />' +
    '<link rel="canonical" href="' + esc(h.url) + '" />' +
    '<meta property="og:type" content="website" />' +
    '<meta property="og:title" content="' + esc(h.title) + '" />' +
    '<meta property="og:description" content="' + esc(h.desc) + '" />' +
    '<meta property="og:url" content="' + esc(h.url) + '" />' +
    "<script>window.ORACLE_STATIC=" + JSON.stringify({ ticker: s.ticker, country: s.country }).replace(/</g, "\\u003c") + ";</script>" +
    STATIC_CSS;
  html = html.replace(/<meta charset="UTF-8"\s*\/?>/, function (m) { return m + headExtra; });

  // no "Loading…" spinner baked into the static HTML
  html = html.replace('class="detail-loading" id="detailLoading"', 'class="detail-loading hidden" id="detailLoading"');

  // static content right after the header
  html = html.replace("</header>", "</header>" + buildStaticSection(s, all, slugs, P));

  // de-duplicate <script src> tags (stock.html loads app.js and stock.js twice) — keep the LAST of each
  var scriptRe = /[ \t]*<script src="([^"]+)"><\/script>[ \t]*\r?\n?/g;
  var seen = {}, all_ = [], m;
  while ((m = scriptRe.exec(html))) all_.push({ full: m[0], idx: m.index, key: m[1].split("?")[0] });
  for (var i = all_.length - 1; i >= 0; i--) {
    if (seen[all_[i].key]) {
      html = html.slice(0, all_[i].idx) + html.slice(all_[i].idx + all_[i].full.length);
      // positions after idx shift, but we walk backwards so earlier indices stay valid
    } else seen[all_[i].key] = true;
  }
  return html;
}

// ── companies.html — a plain list of links to every company page ──────────
// The screener's rows navigate with JavaScript, not <a> links, so crawlers can't
// follow them. This page gives every company page at least one real link.
function buildDirectory(template, stocks, slugs) {
  var url = SITE_URL + "/companies.html";
  var title = "All NSE & JSE companies covered — The African Oracle";
  var desc = "Browse every Nairobi Securities Exchange and Johannesburg Stock Exchange company on The African Oracle, grouped by exchange and sector.";
  var html = template;

  html = html.replace(/<title id="pageTitle">[\s\S]*?<\/title>/, "<title>" + esc(title) + "</title>");
  html = html.replace(/<meta name="description" id="pageDesc" content="[^"]*"\s*\/?>/,
    '<meta name="description" content="' + esc(desc) + '" />');
  html = html.replace(/<meta charset="UTF-8"\s*\/?>/, function (m) {
    return m + '<base href="/" /><link rel="canonical" href="' + esc(url) + '" />' + STATIC_CSS.replace(/#staticProfile/g, "#companyDirectory");
  });

  var body = '<main id="companyDirectory"><h1>All companies covered</h1>' +
    "<p>" + stocks.length + " companies listed on the Nairobi Securities Exchange (NSE) and the Johannesburg Stock Exchange (JSE). " +
    'Each page shows the company\'s profile, key figures and valuation estimates. Information only, not financial advice. ' +
    'New to the terms? See the <a href="learn.html">glossary</a>.</p>';

  ["NSE", "JSE"].forEach(function (ex) {
    var inEx = stocks.filter(function (s) { return exchangeOf(s.country) === ex; });
    if (!inEx.length) return;
    body += "<h2>" + esc(exchangeName(ex)) + " — " + inEx.length + " companies</h2>";
    var bySector = {};
    inEx.forEach(function (s) { var k = s.sector || "Other"; (bySector[k] = bySector[k] || []).push(s); });
    Object.keys(bySector).sort().forEach(function (sec) {
      body += "<h3>" + esc(sec) + "</h3><ul class=\"sp-list\">" +
        bySector[sec].map(function (s) {
          return '<li><a href="stocks/' + slugs.get(s) + '.html">' + esc(s.name) + "</a> <span>(" + esc(s.ticker) + ")</span></li>";
        }).join("") + "</ul>";
    });
  });
  body += "</main>";

  // keep header + footer, replace everything between them
  var a = html.indexOf("</header>"), b = html.indexOf("<footer");
  if (a < 0 || b < 0) throw new Error("stock.html is missing </header> or <footer> — can't build companies.html");
  html = html.slice(0, a + "</header>".length) + body + html.slice(b);

  // drop every <script src=...> except analytics (this page needs no app scripts)
  html = html.replace(/[ \t]*<script src="(?!https:\/\/www\.googletagmanager)[^"]+"><\/script>[ \t]*\r?\n?/g, "");
  return html;
}

// ── data loading ──────────────────────────────────────────────────────────
async function loadStocks(argv) {
  var di = argv.indexOf("--data");
  var rows;
  if (di > -1) {
    rows = JSON.parse(fs.readFileSync(argv[di + 1], "utf8"));
    if (rows && !Array.isArray(rows) && Array.isArray(rows.data)) rows = rows.data;
  } else {
    var url = process.env.SUPABASE_URL, key = process.env.SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error("Set SUPABASE_URL and SUPABASE_ANON_KEY, or pass --data file.json");
    var res = await fetch(url.replace(/\/+$/, "") + "/rest/v1/stocks?select=*&limit=1000",
      { headers: { apikey: key, Authorization: "Bearer " + key } });
    if (!res.ok) throw new Error("Supabase HTTP " + res.status);
    rows = await res.json();
  }
  if (!Array.isArray(rows)) throw new Error("Data is not an array of stocks");
  return rows.map(normalizeRow).filter(function (s) { return s.ticker && s.name && s.country; });
}

// ── main ──────────────────────────────────────────────────────────────────
(async function main() {
  var argv = process.argv.slice(2);
  var templatePath = path.join(ROOT, "stock.html");
  var stockJsPath  = path.join(ROOT, "js", "stock.js");
  if (!fs.existsSync(templatePath)) throw new Error("stock.html not found — run from the repo root");
  if (!fs.existsSync(stockJsPath))  throw new Error("js/stock.js not found — run from the repo root");

  var template = fs.readFileSync(templatePath, "utf8");
  var P = loadProfiles(stockJsPath);
  var stocks = await loadStocks(argv);

  var MIN = parseInt(process.env.MIN_STOCKS || "20", 10);
  if (stocks.length < MIN) throw new Error("Only " + stocks.length + " stocks loaded (expected ≥ " + MIN + ") — refusing to write pages");

  var slugs = new Map(), used = {};
  stocks.forEach(function (s) {
    var slug = slugFor(s);
    if (used[slug]) { console.warn("  ! duplicate slug " + slug + " — skipping second entry"); return; }
    used[slug] = true; slugs.set(s, slug);
  });
  stocks = stocks.filter(function (s) { return slugs.has(s); });
  stocks.sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); });

  fs.mkdirSync(OUT_DIR, { recursive: true });
  var today = new Date().toISOString().slice(0, 10);
  var urls = [];

  stocks.forEach(function (s) {
    var slug = slugs.get(s);
    fs.writeFileSync(path.join(OUT_DIR, slug + ".html"), buildPage(template, s, slug, stocks, slugs, P), "utf8");
    urls.push(SITE_URL + "/stocks/" + slug + ".html");
  });

  fs.writeFileSync(path.join(ROOT, "companies.html"), buildDirectory(template, stocks, slugs), "utf8");
  urls.push(SITE_URL + "/companies.html");

  var sm = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map(function (u) { return "  <url><loc>" + esc(u) + "</loc><lastmod>" + today + "</lastmod><changefreq>daily</changefreq></url>"; }).join("\n") +
    "\n</urlset>\n";
  fs.writeFileSync(path.join(ROOT, "sitemap-stocks.xml"), sm, "utf8");

  console.log("Wrote " + (urls.length - 1) + " company pages to stocks/, companies.html and sitemap-stocks.xml");
})().catch(function (e) { console.error("FAILED: " + e.message); process.exit(1); });