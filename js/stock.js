/* ═══════════════════════════════════════════════════════════════
   stock.js — individual company detail page
   Self-contained: does NOT depend on app.js running any functions.
   Only uses API_URL variable which app.js declares globally.
   Reads ?ticker=SCOM&country=Kenya from URL params.
═══════════════════════════════════════════════════════════════ */

document.addEventListener("DOMContentLoaded", function () {
  // Only run on stock.html — guard against running on other pages
  if (!document.getElementById("detailWrap")) return;

  var params  = new URLSearchParams(window.location.search);
  var ticker  = (params.get("ticker")  || "").toUpperCase().trim();
  var country = (params.get("country") || "").trim();

  if (!ticker) {
    showDetailError("No ticker found in URL.");
    return;
  }

  // API_URL is declared in app.js which loads before this file
  if (typeof API_URL === "undefined" ||
      !API_URL ||
      API_URL === "PASTE_YOUR_APPS_SCRIPT_URL_HERE") {
    showDetailError("API URL not configured in js/app.js.");
    return;
  }

  // ── Try sessionStorage cache first ───────────────────────────
  // Uses same fixed key as app.js and movers.js — "oracle_data"
  // so all three pages share the same cache.
  var CACHE_KEY = "oracle_data";
  var CACHE_TTL = 10 * 60 * 1000; // 10 minutes

  function findAndRender(data) {
    var stock = null;
    for (var i = 0; i < data.length; i++) {
      if (data[i].ticker === ticker) { stock = data[i]; break; }
    }
    if (!stock) {
      showDetailError("Company " + ticker + " not found in data.");
      return;
    }
    renderDetail(stock);
  }

  try {
    var cached = sessionStorage.getItem(CACHE_KEY);
    if (cached) {
      var parsed = JSON.parse(cached);
      if (parsed && parsed.ts && (Date.now() - parsed.ts < CACHE_TTL) && parsed.data) {
        // Data already in cache — render immediately, zero network call
        findAndRender(parsed.data);
        return;
      }
    }
  } catch (e) {
    // sessionStorage unavailable — fall through to fetch
  }

  // Cache miss — fetch from API and store for future use
  fetch(API_URL)
    .then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then(function (json) {
      if (!json || !json.data) throw new Error("Empty API response");
      var list = Array.isArray(json.data) ? json.data : [];

      // Store in sessionStorage so screener page is also instant if user goes back
      try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({
          ts:   Date.now(),
          data: list
        }));
      } catch (e) { /* storage full — continue */ }

      findAndRender(list);
    })
    .catch(function (err) {
      console.error("stock.js fetch error:", err);
      showDetailError("Could not load data: " + err.message);
    });
});

function showDetailError(msg) {
  console.error("stock.js error:", msg || "unknown");
  hide("detailLoading");
  show("detailError");
}

function renderDetail(s) {
  // Hide loading spinner immediately
  hide("detailLoading");

  var cur = s.currency || (s.country === "Kenya" ? "KES" : "ZAR");
  var sym = cur === "ZAR" ? "R" : "KES ";
  var pr  = numOrNull(s.price);
  var iv  = numOrNull(s.intrinsicValue);
  var sig = getSignal(s);

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

  // ── COMPANY DESCRIPTION ──────────────────────────────────────────────────
  // Written editorial content about each company.
  // This transforms auto-generated data pages into content pages for AdSense.
  // Each description: what the company does, its market position, and why
  // it matters to NSE/JSE investors. 2-3 paragraphs per company.

  var COMPANY_PROFILES = {

    // ── NSE KENYA ────────────────────────────────────────────────────────────
    "SCOM": {
      name: "Safaricom PLC",
      about: "Safaricom is Kenya's largest telecommunications company by revenue and subscriber base, listed on the Nairobi Securities Exchange since 2008. The company operates the dominant mobile network in Kenya with over 45 million subscribers, commanding a market share of approximately 65% in voice and data services.",
      highlight: "Safaricom's most significant competitive asset is M-Pesa, the mobile money platform it co-developed with Vodafone and launched in 2007. M-Pesa has grown into one of the world's most successful financial technology platforms, processing billions of transactions annually and serving as the primary banking infrastructure for millions of Kenyans who have no access to traditional banking. The platform now operates in Ethiopia, Mozambique, and other African markets.",
      investor: "For investors, Safaricom offers a rare combination of telecommunications scale and fintech growth. The company is consistently profitable, pays regular dividends, and has delivered steady earnings growth over the past decade. Its economic moat is one of the widest on the NSE — the M-Pesa network effect makes it extremely difficult for competitors to replicate. Risk factors include regulatory pressure on mobile money, government shareholding dynamics, and the capital-intensive expansion into Ethiopia."
    },
    "EQTY": {
      name: "Equity Group Holdings",
      about: "Equity Group Holdings is East and Central Africa's largest bank by customer numbers, with over 20 million accounts across Kenya, Uganda, Tanzania, Rwanda, DRC, South Sudan, and Ethiopia. Founded in 1984 as a building society, the company transformed into a commercial bank in 2004 and listed on the NSE in 2006. Equity's headquarters are in Nairobi and its subsidiary Equity Bank Kenya is the flagship operation.",
      highlight: "Equity pioneered the agency banking model in Kenya, building a network of over 50,000 banking agents across East Africa that dramatically extended financial services to previously unbanked rural communities. This model — combined with mobile banking through the Equity Mobile app and Equitel network — has made Equity the most financially inclusive bank in the region. The group also operates Equity BCDC in the DRC, one of its fastest-growing subsidiaries.",
      investor: "Equity Group has delivered strong earnings growth over the past five years, driven by both organic customer growth and strategic expansion across the continent. The bank consistently maintains strong capital ratios and pays competitive dividends. Key risks include currency exposure across multiple African currencies, credit quality in high-growth markets, and macroeconomic conditions in the DRC. The stock typically trades at a premium to regional peers due to its growth profile and management quality."
    },
    "KCB": {
      name: "KCB Group PLC",
      about: "KCB Group is Kenya's largest bank by total assets, with a balance sheet exceeding KES 2 trillion. Established in 1896 as a branch of National Bank of India, KCB became a fully Kenyan institution over the following century and listed on the NSE in 1954. The group operates across Kenya, Uganda, Tanzania, Rwanda, Burundi, Ethiopia, and South Sudan, with KCB Kenya accounting for the majority of earnings.",
      highlight: "KCB's most transformative strategic move was its 2021 acquisition of National Bank of Kenya (NBK), significantly expanding its retail banking footprint. The group also acquired BancABC Tanzania and Banque Populaire du Rwanda in recent years, demonstrating an aggressive regional expansion strategy. KCB's digital platform, KCB Mobile, has grown rapidly and now handles the majority of the group's transaction volumes.",
      investor: "KCB typically trades at one of the lowest P/E ratios among major NSE banks, making it attractive to value investors. The stock offers a healthy dividend yield and has shown consistent earnings growth. Key risks include non-performing loan pressures during economic downturns, integration complexity from multiple acquisitions, and currency risks from regional subsidiaries. The bank's large government and corporate lending book provides stability but limits margin growth."
    },
    "COOP": {
      name: "Co-operative Bank of Kenya",
      about: "Co-operative Bank of Kenya, commonly known as Co-op Bank, is Kenya's third-largest bank by assets and the country's only bank with a strong co-operative society ownership structure. The bank was established in 1965 to serve the co-operative movement and listed on the NSE in 2008. It serves over 9 million customers through a network of over 190 branches and 600 ATMs across Kenya.",
      highlight: "Co-op Bank's unique ownership structure — with co-operative societies holding approximately 65% of shares — provides a stable, mission-driven shareholder base that supports long-term business decisions. The bank's MCo-op Cash mobile platform has grown to over 5 million users. Co-op Bank also operates in South Sudan and has a minority stake in CIC Insurance Group.",
      investor: "Co-op Bank is known for consistent earnings delivery and dividend payments, making it a favourite among income-focused NSE investors. The bank maintains strong asset quality compared to many peers. Its earnings predictability score is among the highest in the NSE banking sector. Key risks include exposure to agricultural lending (given its co-operative roots) and competition from larger banks with more capital for digital infrastructure investment."
    },
    "ABSA": {
      name: "Absa Bank Kenya PLC",
      about: "Absa Bank Kenya, formerly known as Barclays Bank of Kenya, is a subsidiary of Absa Group Limited of South Africa and one of Kenya's oldest commercial banks, having operated continuously in Kenya since 1916. The bank rebranded from Barclays to Absa in February 2020 following the South African parent's separation from Barclays PLC. It is listed on the NSE and serves over 1.2 million customers.",
      highlight: "Absa Kenya benefits from being part of the pan-African Absa Group, which operates in 15 countries and provides access to shared technology platforms, regional expertise, and capital markets capabilities. The bank has a strong corporate and investment banking division alongside a growing retail business. Absa Kenya has invested significantly in digital banking, with its Absa Timiza mobile app gaining traction among retail customers.",
      investor: "Absa Kenya has delivered improving profitability in recent years, with net margins among the highest in the NSE banking sector. The bank pays dividends and has been growing its earnings steadily. As a subsidiary of a well-capitalised South African group, it benefits from strong governance and risk management frameworks. Key risks include competition from larger domestic banks, currency risks given its South African parent, and any instability in the broader Absa Group."
    },
    "NCBA": {
      name: "NCBA Group PLC",
      about: "NCBA Group was formed in 2019 through the merger of NIC Group and Commercial Bank of Africa (CBA), creating Kenya's third-largest bank by customer numbers. The group operates across Kenya, Uganda, Tanzania, Rwanda, and Ivory Coast. NCBA's majority shareholders include members of the Kenyatta family, one of Kenya's most prominent business dynasties, and the Merali family.",
      highlight: "NCBA is best known as the bank behind M-Shwari, the mobile savings and loans product it developed in partnership with Safaricom's M-Pesa platform. M-Shwari has disbursed billions of shillings in micro-loans since its 2012 launch and remains one of Africa's most successful mobile credit products. NCBA also operates Fuliza, the M-Pesa overdraft facility, and Loop, its digital banking platform.",
      investor: "NCBA has demonstrated strong earnings growth since the 2019 merger as integration benefits have materialised. The bank's digital lending partnerships give it a unique growth avenue that traditional banks cannot easily replicate. Key risks include credit quality in its digital lending portfolio (where default rates can be higher than traditional lending) and the complexity of maintaining multiple fintech partnerships while running a full-service bank."
    },
    "EABL": {
      name: "East African Breweries Limited",
      about: "East African Breweries Limited (EABL) is the leading alcohol beverage company in Eastern Africa, operating through subsidiaries including Kenya Breweries Limited (KBL), Uganda Breweries Limited (UBL), and Senator Keg in Tanzania. The company was established in 1922 and listed on the NSE. Diageo PLC, the global spirits giant, holds a majority stake of approximately 50.03% through its subsidiary Diageo Kenya.",
      highlight: "EABL's portfolio includes some of East Africa's most iconic brands: Tusker (Kenya's national beer), Bell Lager (Uganda), Uganda Waragi, Guinness, and an extensive range of spirits. The Senator Keg product is the company's innovation for affordable beer targeting lower-income consumers, brewed from locally sourced sorghum. EABL also distributes Diageo's global premium spirits brands across the region.",
      investor: "EABL is one of the NSE's most recognisable companies among retail investors due to the visibility of its consumer brands. The company pays consistent dividends and has strong pricing power given the loyalty of its brands. Key risks include excise tax increases by governments across the region, competition from illicit alcohol, and currency volatility in Uganda and Tanzania which affects reported Kenya shilling earnings."
    },
    "BAT": {
      name: "British American Tobacco Kenya PLC",
      about: "British American Tobacco Kenya (BAT Kenya) is the leading cigarette manufacturer and distributor in Kenya, with operations that extend across the East African region. Established in 1907, BAT Kenya is one of the oldest listed companies on the NSE. The British American Tobacco PLC group holds a majority stake. The company manufactures brands including Dunhill, Lucky Strike, Kent, Rothmans, and Sportsman.",
      highlight: "BAT Kenya operates the only cigarette manufacturing facility in East and Central Africa, located in Nairobi. This manufacturing base gives the company a structural cost advantage in the region and allows it to export to neighbouring countries. The company has also invested in reduced-risk products in line with the global BAT Group's strategy of transitioning consumers toward alternatives to traditional cigarettes.",
      investor: "BAT Kenya is one of the highest-dividend-paying stocks on the NSE, making it a consistent favourite among income-seeking investors. Earnings are predictable given the inelastic nature of tobacco demand. Key risks include increasing tobacco regulation, health taxes on cigarettes, declining smoking rates particularly among urban youth, and reputational considerations for ESG-conscious investors."
    },
    "JUB": {
      name: "Jubilee Holdings Limited",
      about: "Jubilee Holdings is East and Central Africa's largest insurance group, operating across Kenya, Uganda, Tanzania, Burundi, and Mauritius. Founded in 1937, the company was the first insurance company to list on the NSE, the DSE (Tanzania), and the USE (Uganda) simultaneously. Jubilee offers a comprehensive range of life, health, and general insurance products.",
      highlight: "Jubilee has evolved beyond traditional insurance through Jubilee Health Insurance, one of Kenya's leading medical insurers, and CBA Capital, its investment management arm. The company has also entered into a significant bancassurance partnership with Co-operative Bank of Kenya. Jubilee's international operations, particularly in Uganda and Tanzania, provide geographic diversification.",
      investor: "Jubilee Holdings has demonstrated consistent earnings growth driven by premium growth and investment income. The company pays regular dividends. Insurance stocks on the NSE tend to trade at relatively attractive P/E ratios compared to global peers. Key risks include weather events affecting general insurance claims, healthcare cost inflation, and regulatory changes to insurance product pricing."
    },
    "KUKZ": {
      name: "Kakuzi PLC",
      about: "Kakuzi PLC is one of Kenya's oldest agricultural companies, established in 1902 and listed on the NSE. The company operates approximately 12,000 acres in Murang'a County and produces avocados, tea, macadamia nuts, and forestry products. Kakuzi is majority-owned by Camellia PLC, a UK-listed agribusiness group.",
      highlight: "Avocados have become Kakuzi's most significant and fastest-growing product, driven by surging global demand — particularly from Europe. The company exports premium Hass avocados to European markets and has expanded its avocado acreage significantly over the past decade. Kakuzi's macadamia operation is also growing, targeting Asian markets where demand has increased strongly.",
      investor: "Kakuzi offers exposure to global agricultural commodity demand through an NSE-listed vehicle. The company has delivered strong earnings growth in recent years driven by avocado export revenues. It pays relatively generous dividends. Key risks include commodity price volatility, weather-related crop failures, phytosanitary requirements for export markets, and currency exposure (revenues in USD/EUR, costs in KES)."
    },
    "SCBK": {
      name: "Standard Chartered Bank Kenya",
      about: "Standard Chartered Bank Kenya is a subsidiary of Standard Chartered PLC, the London-headquartered international banking group. The bank has operated in Kenya since 1911 and is one of the country's oldest financial institutions. It focuses primarily on corporate and institutional banking, private banking for high-net-worth individuals, and transaction banking services for multinationals operating in Kenya.",
      highlight: "Standard Chartered Kenya benefits from its parent group's international network across Asia, Africa, and the Middle East, making it the preferred banking partner for multinationals with East African operations. The bank has invested in digital banking but maintains a more selective, premium-focused customer acquisition strategy compared to mass-market peers.",
      investor: "Standard Chartered Kenya typically commands a premium valuation relative to domestic banks due to its international parentage and high profit margins. The bank has one of the highest return-on-equity ratios among NSE-listed banks. Key risks include dependence on a relatively concentrated corporate client base and competition from international banks and local tier-1 banks expanding their corporate banking capabilities."
    },
    "TOTL": {
      name: "TotalEnergies Kenya PLC",
      about: "TotalEnergies Kenya, formerly Total Kenya, is the leading downstream petroleum company in Kenya by market share, operating a network of over 200 service stations across the country. The company is a subsidiary of TotalEnergies SE, the French energy giant. It distributes petrol, diesel, aviation fuel, and lubricants, and also operates the Mogas LPG business.",
      highlight: "TotalEnergies Kenya has been investing in solar energy solutions through its TotalEnergies Access subsidiary, installing solar panels at service stations and providing home solar products to off-grid customers. This positions the company at the intersection of fossil fuels and renewable energy transition — a strategic position that aligns with the parent group's global energy transition strategy.",
      investor: "TotalEnergies Kenya is an income stock on the NSE, with a history of dividend payments. The company benefits from Kenya's growing vehicle fleet and aviation sector growth. Key risks include government fuel pricing controls which can compress margins, foreign exchange costs of importing fuel, and long-term structural risk from electric vehicle adoption."
    },
    "NMG": {
      name: "Nation Media Group PLC",
      about: "Nation Media Group is the largest multi-media house in East and Central Africa, publishing the Nation and Daily Nation newspapers in Kenya, The East African regional paper, and operating NTV and QTV television channels, Nation FM radio, and the NationAfrica digital platform. The group was founded by His Highness the Aga Khan in 1959 and listed on the NSE in 1973.",
      highlight: "Nation Media Group has been navigating the global shift from print to digital media, investing heavily in NationAfrica.com and its digital subscription model. The group operates across Kenya, Uganda, Tanzania, and Rwanda. Despite declining print revenues, NMG has maintained profitability through cost discipline and digital revenue growth.",
      investor: "NMG is a defensive, brand-rich business with stable cash generation but modest growth prospects given the structural decline of print media globally. The stock appeals to income investors who value the dividend and the brand heritage. Key risks include accelerating digital disruption of traditional media, advertiser migration to social media platforms, and the capital requirements of a full digital transformation."
    },
    "KPLC": {
      name: "Kenya Power and Lighting Company",
      about: "Kenya Power is the national electricity distribution and retail company, responsible for transmitting, distributing, and selling electricity to over 9 million customers across Kenya. The company purchases power from Kenya Electricity Generating Company (KenGen) and independent power producers, then distributes it through a national grid. The Government of Kenya holds a majority stake.",
      highlight: "Kenya Power's connection of new customers has accelerated under the Last Mile Connectivity Programme, adding millions of previously unconnected homes to the national grid over the past decade. The company is also investing in smart meters and grid modernisation. Kenya's electricity generation is predominantly renewable — over 90% from geothermal, hydro, and wind — making Kenya Power's distribution network one of the cleanest in Africa.",
      investor: "Kenya Power has had a difficult few years with profitability challenges driven by high system losses, foreign-denominated debt servicing costs, and power purchase agreement obligations. The company's earnings have been volatile and the dividend has been suspended at various points. The stock is primarily for investors with a specific thesis on operational turnaround and government support rather than near-term income."
    },

    // ── JSE SOUTH AFRICA ─────────────────────────────────────────────────────
    "ABG": {
      name: "Absa Group Limited",
      about: "Absa Group Limited is one of South Africa's four major banks and a leading pan-African financial services group, operating in 15 countries across the continent. The group emerged as an independent entity in 2018 when Barclays PLC reduced its shareholding from 62% to below 15%, allowing Absa to rebrand from Barclays Africa Group and establish its own identity. The group is headquartered in Johannesburg and listed on the JSE.",
      highlight: "Absa Group operates through six business clusters: Retail and Business Banking South Africa, Wealth Investment Management and Insurance South Africa, Corporate and Investment Banking, Everyday Banking (rest of Africa), Business Banking (rest of Africa), and Absa Regional Operations covering Tanzania, Uganda, Kenya, Ghana, Mozambique, Zambia, Botswana, Mauritius, and the Seychelles. The group serves over 13 million customers.",
      investor: "Absa Group has been on a strategic transformation journey since the 2018 separation from Barclays, investing in technology, brand building, and market share recovery. The bank trades at a discount to some peers despite improving financial metrics, which value investors find attractive. Absa pays regular dividends and has a strong capital base. Key risks include South Africa's macroeconomic environment, credit quality cycles, and competition from the other three major banks."
    },
    "SBK": {
      name: "Standard Bank Group Limited",
      about: "Standard Bank Group is Africa's largest bank by assets and one of the oldest financial institutions on the continent, having been established in 1862. The group is headquartered in Johannesburg and listed on the JSE. It operates across 20 African countries, China, and other international markets, serving over 17 million customers through banking and insurance operations.",
      highlight: "Standard Bank's pan-African footprint is its defining competitive strength. The group has banking operations in all of the continent's major economies including South Africa, Nigeria, Ghana, Kenya, Uganda, Tanzania, Mozambique, Angola, Zambia, Zimbabwe, and many others. The group's partnership with ICBC of China — which holds approximately 20% — provides access to China-Africa trade and investment flows, a growing and important financial corridor.",
      investor: "Standard Bank Group offers investors exposure to African economic growth through a well-managed, diversified banking platform. The group has delivered consistent earnings growth, strong return on equity, and regular dividend payments. South Africa's economic challenges weigh on the domestic operations, but the rest-of-Africa portfolio provides a meaningful growth offset. Key risks include currency volatility across 20 markets, political risk in certain African countries, and credit quality in high-growth markets."
    },
    "FSR": {
      name: "FirstRand Limited",
      about: "FirstRand Limited is South Africa's largest bank by market capitalisation and one of the most profitable financial services groups on the African continent. The group was formed in 1998 through the merger of First National Bank Holdings and Southern Life. It operates through distinct subsidiaries including FNB (First National Bank), RMB (Rand Merchant Bank), Wesbank, and Aldermore in the UK.",
      highlight: "FNB is FirstRand's consumer banking arm and consistently wins awards as South Africa's most innovative bank. Its digital banking platform has over 8 million active users and its eBucks loyalty rewards programme is one of South Africa's most popular. RMB is the corporate and investment banking powerhouse, regularly ranking first or second in JSE equity capital markets. Wesbank is South Africa's leading vehicle and asset finance provider.",
      investor: "FirstRand is typically the most expensive of the four major South African banks on a price-to-book basis, reflecting the market's premium for its consistent superior return on equity, which regularly exceeds 20%. The group pays strong dividends and has a track record of earnings growth through economic cycles. Key risks include South African economic weakness, rising credit defaults in a high interest rate environment, and competition from challenger banks and fintech firms."
    },
    "NED": {
      name: "Nedbank Group Limited",
      about: "Nedbank Group is one of South Africa's four major banking groups, with approximately 8 million clients and a balance sheet exceeding R1.4 trillion. The group is majority-owned by Old Mutual Limited, which holds approximately 50% of shares. Nedbank is headquartered in Johannesburg and provides a full range of retail, business, corporate, and investment banking services across southern Africa.",
      highlight: "Nedbank has a strong presence in the rest of Africa through its alliance with Ecobank Transnational Incorporated, giving it access to Ecobank's 33-country network without the capital burden of direct ownership. Nedbank has invested heavily in digital banking, with its Nedbank Money app and digital self-service channels now handling the majority of transactions. The bank also has a significant focus on sustainable finance and green bonds.",
      investor: "Nedbank has historically traded at a discount to FNB and Standard Bank on price-to-book metrics due to lower return on equity, though the group has been closing this gap through efficiency programmes. The bank pays competitive dividends. Key risks include exposure to South Africa's constrained economic environment, the Old Mutual majority ownership which can create governance complexity, and competition for skilled technology talent in the domestic market."
    },
    "CPI": {
      name: "Capitec Bank Holdings Limited",
      about: "Capitec Bank is South Africa's largest bank by customer numbers with over 22 million clients, built through a strategy of simple, low-cost transactional banking targeted at the mass market. Founded in 2001, Capitec grew from a microlender into a full-service bank within two decades and listed on the JSE in 2002. The bank's headquarters are in Stellenbosch, Western Cape.",
      highlight: "Capitec's growth strategy has been built on three pillars: simplicity (one account, one card, one app), low fees (substantially lower than legacy banks), and accessibility (over 850 branches including many in townships and rural areas). The bank expanded into credit cards, home loans, and business banking in recent years. Its EasyEquities partnership embedded stock investing directly into the Capitec banking app, attracting millions of new investors.",
      investor: "Capitec is one of the JSE's great growth stories, having delivered exceptional returns to long-term shareholders since its listing. The bank commands a significant premium to peers on all valuation metrics, reflecting the market's expectation of continued above-average growth. Key risks include credit quality in the unsecured lending portfolio (its historical core business), competition from established banks for higher-income customer segments, and margin compression as the bank moves upmarket."
    },
    "NPN": {
      name: "Naspers Limited",
      about: "Naspers is a South African multinational technology and media conglomerate and one of the largest technology investors globally. Founded in 1915 as a newspaper publisher, Naspers transformed into a technology investment holding company, most famously through its 31% stake in Tencent Holdings, the Chinese technology giant behind WeChat. Naspers is listed on the JSE and is the exchange's largest company by market capitalisation.",
      highlight: "Naspers created Prosus, its international internet assets company listed in Amsterdam in 2019, to house its international technology investments outside Tencent. The Prosus portfolio includes investments in online classifieds (OLX), food delivery, payments, ed-tech, and health-tech across emerging markets in Europe, India, Latin America, and Southeast Asia. The persistent discount of Naspers and Prosus shares to their underlying Tencent value has been a long-running debate among investors.",
      investor: "Naspers offers South African investors indirect exposure to Chinese technology growth through the Tencent stake and global technology exposure through Prosus. The persistent holding company discount — where Naspers trades at a significant discount to the value of its underlying assets — is both a risk and an opportunity. Key risks include Tencent's regulatory environment in China, the ability of the Prosus portfolio to generate returns, and the complexity of the Naspers/Prosus structure."
    },
    "BTI": {
      name: "British American Tobacco PLC",
      about: "British American Tobacco is one of the world's largest tobacco companies, listed on the JSE as well as the London Stock Exchange. The group owns brands including Lucky Strike, Dunhill, Kent, Rothmans, Pall Mall, and Camel, with products sold in over 170 countries. BAT Kenya (listed separately on the NSE) is a subsidiary of this parent group.",
      highlight: "BAT has made significant investments in New Category products — vaping devices (Vuse), tobacco heating products (glo), and modern oral nicotine pouches (Velo). The group's transformation strategy aims to generate at least 50% of revenues from non-combustible products. The JSE listing of BAT gives South African and African investors access to one of the world's highest-yielding global consumer stocks.",
      investor: "BAT offers one of the highest dividend yields available on the JSE, making it attractive to income investors. The stock trades at a low P/E reflecting market concerns about long-term tobacco volume decline. Key risks include accelerating decline in combustible cigarette volumes, regulatory headwinds for both traditional and new category products, and the execution risk of the new categories investment programme."
    },
    "GFI": {
      name: "Gold Fields Limited",
      about: "Gold Fields is a globally diversified gold mining company with operations in South Africa, Ghana, Australia, Peru, and Canada. The company is headquartered in Johannesburg and listed on the JSE and the New York Stock Exchange. Gold Fields is one of the world's top 10 gold producers by output, producing approximately 2.3 million ounces of gold equivalent annually.",
      highlight: "Gold Fields operates a portfolio of high-quality, long-life assets including the South Deep mine in South Africa — the world's largest gold deposit by reserves — the Tarkwa and Damang mines in Ghana, and several world-class Australian operations including St Ives and Granny Smith. The company attempted a significant acquisition of Yamana Gold in 2022 but withdrew after a competing bid from Pan American Silver and Agnico Eagle.",
      investor: "Gold Fields provides JSE investors with exposure to gold as a commodity and safe-haven asset. The company has delivered strong earnings growth driven by rising gold prices and operational improvements. Key risks include gold price volatility, geopolitical risk in operating jurisdictions, operational challenges at the deep-level South Deep mine, and capital allocation decisions around acquisitions."
    },
    "ANG": {
      name: "AngloGold Ashanti PLC",
      about: "AngloGold Ashanti is one of the world's largest gold mining companies, with operations in nine countries across Africa, the Americas, and Australia. The company was formed in 2004 through the consolidation of Anglo American's gold interests and has its primary listing on the NYSE, with secondary listings on the JSE and other exchanges. The company is headquartered in Denver, Colorado following its 2023 redomiciliation from South Africa.",
      highlight: "AngloGold's flagship asset is the Obuasi mine in Ghana, a long-life, high-grade underground gold mine that has undergone significant redevelopment. The company also operates the Sunrise Dam and Tropicana mines in Australia, Serra Grande in Brazil, and Geita in Tanzania. AngloGold has been on a portfolio optimisation journey, divesting South African deep-level mines to focus on higher-margin international operations.",
      investor: "AngloGold Ashanti offers exposure to gold prices through a diversified multi-jurisdictional mining portfolio. The company has improved its cost profile significantly through portfolio optimisation. Key risks include gold price volatility, country risk across multiple jurisdictions including DRC and Brazil, operational risks associated with deep underground mining, and currency exposure across multiple currencies."
    },
    "MTN": {
      name: "MTN Group Limited",
      about: "MTN Group is Africa's largest mobile telecommunications company by subscribers, with operations in 19 markets across Africa and the Middle East. The company is headquartered in Johannesburg and listed on the JSE. MTN serves over 300 million subscribers and generated revenue of approximately R200 billion in its most recent financial year.",
      highlight: "MTN's strategic priority beyond traditional telecommunications is fintech through MoMo (Mobile Money), which now has over 60 million active users and is one of Africa's largest mobile money platforms competing with M-Pesa across multiple markets. The company is also building out enterprise and API businesses. MTN's largest markets are Nigeria, South Africa, and Ghana, with significant operations in Uganda, Côte d'Ivoire, Cameroon, and many others.",
      investor: "MTN offers exposure to African mobile connectivity and fintech growth through a single JSE-listed investment. The company has delivered strong subscriber growth and data revenue expansion. Key risks include currency devaluation in key markets — particularly the Nigerian naira and Ghanaian cedi — regulatory pressure on mobile money, political risk, and the capital intensity of network rollout."
    },
    "SHP": {
      name: "Shoprite Holdings Limited",
      about: "Shoprite Holdings is Africa's largest food retailer by revenue, operating over 3,000 stores across 11 African countries under the Shoprite, Checkers, Checkers Hyper, Usave, OK Franchise, and LiquorShop brands. Founded in 1979 and headquartered in Cape Town, Shoprite is listed on the JSE and is consistently one of the exchange's most traded stocks.",
      highlight: "Shoprite's Checkers brand has been repositioned as a premium grocery destination to compete with Woolworths and Pick n Pay's upmarket offerings, while the core Shoprite brand continues to serve value-conscious consumers. The company's Sixty60 grocery delivery service has become a market leader in South Africa with rapid growth. Shoprite's rest-of-Africa operations, particularly in Zambia and Angola, provide significant long-term growth potential.",
      investor: "Shoprite is one of the JSE's most reliable compounders — a business that consistently grows earnings and returns capital to shareholders through dividends and buybacks. The stock typically commands a premium rating due to its track record. Key risks include South Africa's cost of living pressure on consumer spending, load-shedding costs from generator diesel, food price inflation, and currency devaluation in rest-of-Africa markets."
    },
    "MRP": {
      name: "Mr Price Group Limited",
      about: "Mr Price Group is South Africa's largest value fashion retailer, operating the Mr Price, Mr Price Home, Mr Price Sport, Sheet Street, Power Fashion, and Yuppiechef brands across southern Africa. The group is headquartered in Durban and listed on the JSE. It targets value-conscious consumers in the middle and lower-middle income segments with fast fashion and home goods.",
      highlight: "Mr Price Group has one of the best financial track records on the JSE over the past two decades, consistently delivering above-average return on equity and maintaining a debt-free or low-debt balance sheet even through economic cycles. The group expanded into financial services through Mr Price Money, offering credit, insurance, and mobile products to its customer base. Its acquisition of Studio 88 in 2022 significantly expanded its sportswear footprint.",
      investor: "Mr Price is widely regarded as one of South Africa's best-managed retailers and a benchmark for operational excellence in the sector. The stock's quality premium has been consistent over many years. Key risks include South African consumer spending pressure, increasing competition in the value fashion segment from online players, and exposure to discretionary spending in a high interest rate environment."
    },
    "VOD": {
      name: "Vodacom Group Limited",
      about: "Vodacom Group is South Africa's largest mobile operator and a leading telecommunications company across sub-Saharan Africa, with operations in South Africa, Tanzania, the DRC, Mozambique, Lesotho, Ethiopia, and Egypt. Vodacom is listed on the JSE and majority-owned by Vodafone PLC, which holds approximately 65% of shares. The company serves over 130 million customers.",
      highlight: "Vodacom's M-Pesa partnership with Safaricom covers Tanzania, DRC, Mozambique, Lesotho, and Ethiopia, giving it mobile money scale across East and Southern Africa. In South Africa, Vodacom operates the largest network and has invested in 5G rollout across major cities. The company's Egypt expansion through Vodafone Egypt gives it access to one of Africa's largest telecom markets.",
      investor: "Vodacom is an attractive income stock on the JSE, paying consistent and relatively high dividends supported by strong free cash flow. The company's South African business is mature and generates substantial cash, while the rest-of-Africa operations provide growth. Key risks include currency devaluation across multiple markets, regulatory changes affecting mobile money, and competitive pricing pressure in South Africa."
    },
    "GRT": {
      name: "Growthpoint Properties Limited",
      about: "Growthpoint Properties is South Africa's largest primary listed REIT (Real Estate Investment Trust) by market capitalisation, owning and managing a diversified portfolio of over 400 properties across office, retail, and industrial sectors in South Africa, plus investments in Australia (GOZ listed on ASX), Poland (Globalworth), and other international markets.",
      highlight: "Growthpoint's portfolio spans approximately 6.8 million square metres of lettable area. The company has diversified internationally to reduce its exposure to South Africa's challenging property market. Its Australian subsidiary, Growthpoint Properties Australia, owns office, industrial, and healthcare properties. Growthpoint has also developed a significant healthcare property portfolio in South Africa through Growthpoint Healthcare Property Holdings.",
      investor: "As a REIT, Growthpoint is required to distribute at least 75% of its distributable income as dividends, making it an income investment. The stock offers a high dividend yield. Key risks include vacancies in South African office properties (structurally impacted by work-from-home), rising interest rates increasing financing costs, currency impact from international assets, and South Africa's load-shedding affecting retail and office tenants."
    }
  };

  // Get profile for this company
  var profile = COMPANY_PROFILES[s.ticker];

  // Find or create the company overview section
  // Insert it before the metrics grid section in the DOM
  var metricsSection = document.getElementById("metricsGrid").closest(".d-section");
  if (profile && metricsSection) {
    var overviewSection = document.createElement("section");
    overviewSection.className = "d-section";
    overviewSection.style.borderBottom = "1px solid var(--border)";
    overviewSection.innerHTML =
      "<div class='d-inner'>" +
        "<h2 class='d-title'>About " + esc(profile.name) + "</h2>" +
        "<p class='d-sub' style='max-width:100%;margin-bottom:14px;font-size:14px;line-height:1.8;color:#C0C0C0;'>" +
          esc(profile.about) +
        "</p>" +
        "<p class='d-sub' style='max-width:100%;margin-bottom:14px;font-size:14px;line-height:1.8;color:#C0C0C0;'>" +
          esc(profile.highlight) +
        "</p>" +
        "<p class='d-sub' style='max-width:100%;margin-bottom:0;font-size:14px;line-height:1.8;color:#C0C0C0;'>" +
          "<strong style='color:#E0E0E0;'>Investment perspective:</strong> " +
          esc(profile.investor) +
        "</p>" +
      "</div>";

    // Insert before the metrics section
    metricsSection.parentNode.insertBefore(overviewSection, metricsSection);
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

  // ── Show the page — MUST be last, always runs even if sections above had errors
  try { show("detailWrap"); } catch(e) { console.error("show detailWrap failed:", e); }
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

// ── Utilities — all self-contained, no dependency on app.js ──────────────────
function numOrNull(v) { var n = parseFloat(v); return isNaN(n) ? null : n; }
function esc(s) {
  return String(s || "")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
function show(id) { var el = document.getElementById(id); if (el) el.classList.remove("hidden"); }
function hide(id) { var el = document.getElementById(id); if (el) el.classList.add("hidden"); }
function setText(id, v) { var el = document.getElementById(id); if (el) el.textContent = v; }