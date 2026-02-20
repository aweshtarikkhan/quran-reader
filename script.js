const app = document.getElementById("app");
const navButtons = document.querySelectorAll(".nav-btn");

const API_BASE = "https://api.quran.com/api/v4";
const LOCAL_MUSHAF_IMAGE_BASE = "assets/mushaf";
const REMOTE_MUSHAF_IMAGE_BASE = "https://raw.githubusercontent.com/QuranHub/quran-pages-images/main/kfgqpc/hafs-wasat";
const TOTAL_MUSHAF_PAGES = 604;
const BOOKMARK_KEY = "quran_last_read_page";
const PARA_START_PAGES = [
  { para: 1, page: 1 },
  { para: 2, page: 22 },
  { para: 3, page: 42 },
  { para: 4, page: 62 },
  { para: 5, page: 82 },
  { para: 6, page: 102 },
  { para: 7, page: 121 },
  { para: 8, page: 142 },
  { para: 9, page: 162 },
  { para: 10, page: 182 },
  { para: 11, page: 201 },
  { para: 12, page: 222 },
  { para: 13, page: 242 },
  { para: 14, page: 262 },
  { para: 15, page: 282 },
  { para: 16, page: 302 },
  { para: 17, page: 322 },
  { para: 18, page: 342 },
  { para: 19, page: 362 },
  { para: 20, page: 382 },
  { para: 21, page: 402 },
  { para: 22, page: 422 },
  { para: 23, page: 442 },
  { para: 24, page: 462 },
  { para: 25, page: 482 },
  { para: 26, page: 502 },
  { para: 27, page: 522 },
  { para: 28, page: 542 },
  { para: 29, page: 562 },
  { para: 30, page: 582 }
];

const LANGUAGE_FILTERS = {
  english: (item) => (item.language_name || "").toLowerCase().includes("english"),
  urdu: (item) => (item.language_name || "").toLowerCase().includes("urdu"),
  roman_urdu: (item) => {
    const text = `${item.name || ""} ${item.author_name || ""} ${item.slug || ""}`.toLowerCase();
    return text.includes("roman urdu") || text.includes("roman-urdu") || text.includes("maududi-roman-urdu");
  },
  hindi: (item) => (item.language_name || "").toLowerCase().includes("hindi"),
  hinglish: (item) => {
    const text = `${item.name || ""} ${item.author_name || ""} ${item.slug || ""}`.toLowerCase();
    return text.includes("transliteration") || text.includes("roman");
  }
};

const DEFAULT_RESOURCE_IDS = {
  english: { translationIds: [20], tafsirId: 169 },
  urdu: { translationIds: [234], tafsirId: 160 },
  roman_urdu: { translationIds: [831], tafsirId: 160 },
  hindi: { translationIds: [122], tafsirId: null },
  hinglish: { translationIds: [57], tafsirId: 169 }
};
const PRAYER_CONFIGS = {
  hanafi: { label: "Hanafi", method: 1, school: 1 },
  ahle_hadith: { label: "Ahl-e-Hadith", method: 2, school: 0 },
  shia: { label: "Shia (Jafari)", method: 0, school: 0 }
};

let state = {
  view: "home",
  selectedSurah: 1,
  language: "english",
  translationIds: [20],
  tafsirId: 169,
  selectedPara: 1,
  mushafStartPage: 1,
  bookmarkPage: 1,
  currentReadingPage: 1,
  prayerSchool: "hanafi",
  prayerCity: "",
  prayerCoords: null,
  prayerTimes: null,
  prayerTimesPrev: null,
  permissionInfo: {
    location: "unknown",
    storage: "unknown"
  },
  translations: [],
  tafsirs: [],
  currentLoadKey: 0
};

let mushafObserver = null;
let readingObserver = null;
let exitConfirmArmed = false;

function sanitizePage(page) {
  const pageNum = Number(page) || 1;
  return Math.min(TOTAL_MUSHAF_PAGES, Math.max(1, pageNum));
}

function readBookmarkPage() {
  const stored = Number(localStorage.getItem(BOOKMARK_KEY));
  return sanitizePage(stored || 1);
}

function saveBookmarkPage(page) {
  const safePage = sanitizePage(page);
  state.bookmarkPage = safePage;
  localStorage.setItem(BOOKMARK_KEY, String(safePage));

  const bookmarkEl = document.getElementById("bookmark-page-value");
  if (bookmarkEl) bookmarkEl.textContent = String(safePage);
}

function updateCurrentPage(page) {
  const safePage = sanitizePage(page);
  state.currentReadingPage = safePage;

  const currentEl = document.getElementById("current-page-value");
  if (currentEl) currentEl.textContent = String(safePage);
}

function getParaStartPage(para) {
  const item = PARA_START_PAGES.find((entry) => entry.para === Number(para));
  return item ? item.page : 1;
}

function getParaByPage(page) {
  const safePage = sanitizePage(page);
  let result = 1;
  PARA_START_PAGES.forEach((item) => {
    if (safePage >= item.page) result = item.para;
  });
  return result;
}

function setActiveNav(view) {
  navButtons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === view);
  });
}

function getRouteState() {
  return {
    view: state.view,
    selectedSurah: state.selectedSurah,
    mushafStartPage: state.mushafStartPage,
    selectedPara: state.selectedPara
  };
}

function applyRouteState(route) {
  if (!route) return;
  state.view = route.view || state.view;
  if (route.selectedSurah) state.selectedSurah = Number(route.selectedSurah);
  if (route.selectedPara) state.selectedPara = Number(route.selectedPara);
  if (route.mushafStartPage) state.mushafStartPage = sanitizePage(route.mushafStartPage);
}

function navigateTo(view, extraState = {}, options = {}) {
  state.view = view;
  Object.assign(state, extraState);

  if (options.replace) {
    history.replaceState(getRouteState(), "");
  } else if (options.push !== false) {
    history.pushState(getRouteState(), "");
  }

  render();
  if (!options.skipScroll) {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

async function tryExitApp() {
  const cap = window.Capacitor;
  if (cap && cap.isNativePlatform && cap.Plugins && cap.Plugins.App && cap.Plugins.App.exitApp) {
    await cap.Plugins.App.exitApp();
    return;
  }
  window.close();
}

async function confirmExitApp() {
  const ok = window.confirm("Do you want to exit the app?");
  if (ok) {
    await tryExitApp();
    return true;
  }
  return false;
}

function card(title, content) {
  const backBar =
    state.view !== "home"
      ? `
    <div class="page-topbar">
      <button class="home-back-btn" data-home-back="1">← Home</button>
    </div>
  `
      : "";

  return `
    <section class="card">
      ${backBar}
      <h2>${title}</h2>
      ${content}
    </section>
  `;
}

function sanitizeHtml(input = "") {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = input;
  wrapper.querySelectorAll("script, style").forEach((el) => el.remove());
  return wrapper.innerHTML;
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status}`);
  }
  return res.json();
}

async function ensureResourcesLoaded() {
  if (state.translations.length && state.tafsirs.length) {
    return;
  }

  const [translationsRes, tafsirsRes] = await Promise.all([
    fetchJson(`${API_BASE}/resources/translations`),
    fetchJson(`${API_BASE}/resources/tafsirs`)
  ]);

  state.translations = translationsRes.translations || [];
  state.tafsirs = tafsirsRes.tafsirs || [];
}

function getLanguageResources(language) {
  const translationFilter = LANGUAGE_FILTERS[language] || LANGUAGE_FILTERS.english;
  const tafsirFilter = language === "hinglish" ? LANGUAGE_FILTERS.english : translationFilter;

  const translationOptions = state.translations.filter(translationFilter);
  const tafsirOptions = state.tafsirs.filter(tafsirFilter);

  return { translationOptions, tafsirOptions };
}

function normalizeResourceSelection() {
  const { translationOptions, tafsirOptions } = getLanguageResources(state.language);
  const defaults = DEFAULT_RESOURCE_IDS[state.language] || DEFAULT_RESOURCE_IDS.english;

  const selectedSet = new Set(state.translationIds);
  const validSelections = translationOptions.filter((item) => selectedSet.has(item.id)).map((item) => item.id);

  if (!validSelections.length) {
    const fallback = (defaults.translationIds || [])
      .filter((id) => translationOptions.some((item) => item.id === id));
    state.translationIds = fallback.length ? fallback : translationOptions.slice(0, 2).map((item) => item.id);
  } else {
    state.translationIds = validSelections;
  }

  if (!tafsirOptions.some((item) => item.id === state.tafsirId)) {
    const nextTafsir = tafsirOptions.find((item) => item.id === defaults.tafsirId) || tafsirOptions[0];
    state.tafsirId = nextTafsir ? nextTafsir.id : null;
  }
}

function renderHome() {
  app.innerHTML = `
    <section class="home-hero">
      <h1>Noble Quran</h1>
      <p>Read, Recite, and Reflect</p>
    </section>
    <section class="home-grid">
      <button class="home-card" data-go="readquran">
        <span class="home-icon mint">📖</span>
        <h3>Read Quran</h3>
        <p>Digital scan of 15-line Mushaf pages.</p>
      </button>
      <button class="home-card" data-go="line">
        <span class="home-icon teal">📘</span>
        <h3>15 Line (Text)</h3>
        <p>Crisp line-by-line Arabic reading view.</p>
      </button>
      <button class="home-card" data-go="surah">
        <span class="home-icon sky">📚</span>
        <h3>Read by Surah</h3>
        <p>Open any of all 114 surahs.</p>
      </button>
      <button class="home-card" data-go="translation">
        <span class="home-icon gold">📝</span>
        <h3>Translation</h3>
        <p>Multiple author meanings and tafseer.</p>
      </button>
      <button class="home-card" data-go="para">
        <span class="home-icon rose">🧭</span>
        <h3>Read by Para</h3>
        <p>Jump to para and open Read Quran directly.</p>
      </button>
      <button class="home-card" data-go="sehri">
        <span class="home-icon indigo">🌙</span>
        <h3>Sehri & Iftar</h3>
        <p>By location with Hanafi/Ahl-e-Hadith/Shia.</p>
      </button>
      <button class="home-card" data-go="readquran" data-bookmark="1">
        <span class="home-icon emerald">🔖</span>
        <h3>Continue Reading</h3>
        <p>Resume from bookmark page #${state.bookmarkPage}.</p>
      </button>
    </section>
    <p class="home-footer-note">Designed for peace and clarity.</p>
  `;

  app.querySelectorAll(".home-card").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.dataset.bookmark === "1") {
        state.mushafStartPage = state.bookmarkPage;
      }
      navigateTo(btn.dataset.go, { mushafStartPage: state.mushafStartPage });
    });
  });
}

function cleanupMushafObserver() {
  if (mushafObserver) {
    mushafObserver.disconnect();
    mushafObserver = null;
  }
  if (readingObserver) {
    readingObserver.disconnect();
    readingObserver = null;
  }
}

function buildMushafImagePage(pageNumber, index) {
  return `
    <article class="mushaf-page" data-page="${pageNumber}" id="page-${pageNumber}" style="animation-delay:${(index % 10) * 0.05}s">
      <div class="mushaf-page-head">
        <h3>Page ${pageNumber}</h3>
        <button class="page-bookmark-btn" data-bookmark-page="${pageNumber}">Bookmark this page</button>
      </div>
      <img
        class="mushaf-image"
        src="${LOCAL_MUSHAF_IMAGE_BASE}/${pageNumber}.jpg"
        alt="Quran Mushaf Page ${pageNumber}"
        loading="lazy"
        onerror="this.onerror=null;this.src='${REMOTE_MUSHAF_IMAGE_BASE}/${pageNumber}.jpg';"
      />
    </article>
  `;
}

function buildParaOptions(selectedPara) {
  return PARA_START_PAGES.map(
    (item) =>
      `<option value="${item.para}" ${item.para === selectedPara ? "selected" : ""}>Para ${item.para} (starts at page ${item.page})</option>`
  ).join("");
}

function renderMushaf(title = "15-Line Mushaf", startPage = 1) {
  cleanupMushafObserver();
  const safeStart = sanitizePage(startPage);
  state.mushafStartPage = safeStart;
  state.selectedPara = getParaByPage(safeStart);
  updateCurrentPage(safeStart);

  app.innerHTML = card(
    title,
    `
    <details class="settings-panel">
      <summary class="settings-summary">&#9881; Settings</summary>
      <div class="mushaf-tools">
        <div class="chip-row">
          <span class="chip active">Bookmark: <strong id="bookmark-page-value">${state.bookmarkPage}</strong></span>
          <span class="chip">Current: <strong id="current-page-value">${safeStart}</strong></span>
        </div>
        <div class="tool-row">
          <label class="field-label" for="para-select">Read by Para</label>
          <select id="para-select" class="select">${buildParaOptions(state.selectedPara)}</select>
          <button id="go-para-btn" class="action-btn">Open Para in Read Quran</button>
        </div>
        <div class="tool-row">
          <button id="save-bookmark-btn" class="action-btn">Save Current Page</button>
          <button id="continue-bookmark-btn" class="action-btn">Continue From Bookmark</button>
        </div>
      </div>
    </details>
    <p class="translation">Pages load from local downloaded assets with automatic online fallback.</p>
    <div id="mushaf-pages" class="page-view"></div>
    <div id="mushaf-loader" class="loader">
      <p class="translation">Scroll down to load more pages...</p>
    </div>
    `
  );

  const container = document.getElementById("mushaf-pages");
  const loader = document.getElementById("mushaf-loader");

  let nextPage = safeStart;
  const chunkSize = 12;

  function loadMorePages() {
    if (nextPage > TOTAL_MUSHAF_PAGES) {
      loader.innerHTML = `<p class="translation">All ${TOTAL_MUSHAF_PAGES} pages loaded.</p>`;
      cleanupMushafObserver();
      return;
    }

    const end = Math.min(nextPage + chunkSize - 1, TOTAL_MUSHAF_PAGES);
    let html = "";
    for (let page = nextPage; page <= end; page += 1) {
      html += buildMushafImagePage(page, page - 1);
    }

    container.insertAdjacentHTML("beforeend", html);

    if (readingObserver) {
      container.querySelectorAll(".mushaf-page").forEach((pageEl) => {
        if (!pageEl.dataset.observed) {
          readingObserver.observe(pageEl);
          pageEl.dataset.observed = "1";
        }
      });
    }

    nextPage = end + 1;
  }

  loadMorePages();

  readingObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const page = Number(entry.target.dataset.page);
          if (page) {
            updateCurrentPage(page);
          }
        }
      });
    },
    { threshold: 0.65 }
  );

  container.querySelectorAll(".mushaf-page").forEach((pageEl) => {
    readingObserver.observe(pageEl);
    pageEl.dataset.observed = "1";
  });

  mushafObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          loadMorePages();
        }
      });
    },
    { threshold: 0.1 }
  );

  mushafObserver.observe(loader);

  container.addEventListener("click", (event) => {
    const button = event.target.closest("[data-bookmark-page]");
    if (!button) return;
    const page = Number(button.dataset.bookmarkPage);
    if (!page) return;
    saveBookmarkPage(page);
    button.textContent = `Bookmarked #${page}`;
  });

  document.getElementById("go-para-btn").addEventListener("click", () => {
    const selectedPara = Number(document.getElementById("para-select").value);
    state.selectedPara = selectedPara;
    state.mushafStartPage = getParaStartPage(selectedPara);
    navigateTo("readquran", { mushafStartPage: state.mushafStartPage, selectedPara });
  });

  document.getElementById("save-bookmark-btn").addEventListener("click", () => {
    saveBookmarkPage(state.currentReadingPage || safeStart);
  });

  document.getElementById("continue-bookmark-btn").addEventListener("click", () => {
    state.mushafStartPage = state.bookmarkPage;
    navigateTo("readquran", { mushafStartPage: state.bookmarkPage });
  });
}

function renderPara() {
  state.selectedPara = getParaByPage(state.mushafStartPage || state.bookmarkPage || 1);
  app.innerHTML = card(
    "Read by Para",
    `
    <details class="settings-panel" open>
      <summary class="settings-summary">&#9881; Settings</summary>
      <p class="translation">Choose para/juz and you will be redirected to Read Quran at the correct start page.</p>
      <label class="field-label" for="para-home-select">Para</label>
      <select id="para-home-select" class="select">${buildParaOptions(state.selectedPara)}</select>
      <div class="tool-row">
        <button id="open-para-home-btn" class="action-btn">Open in Read Quran</button>
        <button id="continue-home-btn" class="action-btn">Continue From Bookmark (Page ${state.bookmarkPage})</button>
      </div>
    </details>
    `
  );

  document.getElementById("open-para-home-btn").addEventListener("click", () => {
    const para = Number(document.getElementById("para-home-select").value);
    state.selectedPara = para;
    state.mushafStartPage = getParaStartPage(para);
    navigateTo("readquran", { mushafStartPage: state.mushafStartPage, selectedPara: para });
  });

  document.getElementById("continue-home-btn").addEventListener("click", () => {
    state.mushafStartPage = state.bookmarkPage;
    navigateTo("readquran", { mushafStartPage: state.bookmarkPage });
  });
}

function renderLineOnlyShell() {
  app.innerHTML = card(
    "15 Line (Text View)",
    `
    <details class="settings-panel" open>
      <summary class="settings-summary">&#9881; Settings</summary>
      <div class="controls">
        <label class="field-label" for="line-surah-select">Surah</label>
        <select id="line-surah-select" class="select">${buildSurahOptions()}</select>
      </div>
    </details>
    <div id="line-only-content" class="line-content">
      <p class="translation">Loading Arabic text...</p>
    </div>
    `
  );

  document.getElementById("line-surah-select").addEventListener("change", (event) => {
    state.selectedSurah = Number(event.target.value);
    renderLineOnly();
  });
}

function renderArabicAyat(verses) {
  const container = document.getElementById("line-only-content");
  const html = verses
    .map(
      (verse) => `
      <article class="line-ayah">
        <div class="badge">${verse.verse_key}</div>
        <div class="arabic">${verse.text_uthmani || ""}</div>
      </article>
      `
    )
    .join("");

  container.innerHTML = html || `<p class="translation">No ayat found.</p>`;
}

async function renderLineOnly() {
  const loadKey = Date.now();
  state.currentLoadKey = loadKey;

  try {
    renderLineOnlyShell();
    const data = await fetchJson(`${API_BASE}/quran/verses/uthmani?chapter_number=${state.selectedSurah}`);
    if (state.currentLoadKey !== loadKey) return;
    renderArabicAyat(data.verses || []);
  } catch (error) {
    const target = document.getElementById("line-only-content");
    if (target) {
      target.innerHTML = `<p class="translation">Unable to load Arabic text. (${error.message})</p>`;
    }
  }
}

function getPrayerParams() {
  return PRAYER_CONFIGS[state.prayerSchool] || PRAYER_CONFIGS.hanafi;
}

function parseTimeToDate(timeText) {
  const clean = (timeText || "").split(" ")[0];
  const [h, m] = clean.split(":").map((v) => Number(v));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

function getNextPrayer(timings) {
  const order = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];
  const now = new Date();

  for (const name of order) {
    const t = parseTimeToDate(timings[name]);
    if (t && now < t) return name;
  }
  return "Fajr";
}

async function geocodeCity(cityName) {
  const q = encodeURIComponent(cityName.trim());
  const data = await fetchJson(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${q}`);
  if (!Array.isArray(data) || !data.length) {
    throw new Error("City not found");
  }
  return { lat: Number(data[0].lat), lon: Number(data[0].lon), city: cityName.trim() };
}

async function reverseGeocode(lat, lon) {
  const data = await fetchJson(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`);
  const addr = data.address || {};
  return addr.city || addr.town || addr.village || addr.county || "Current Location";
}

async function refreshPermissionInfo() {
  try {
    if (navigator.permissions && navigator.permissions.query) {
      const loc = await navigator.permissions.query({ name: "geolocation" });
      state.permissionInfo.location = loc.state || "unknown";
    }
  } catch {
    state.permissionInfo.location = "unknown";
  }

  try {
    if (navigator.storage && navigator.storage.persisted) {
      const persisted = await navigator.storage.persisted();
      state.permissionInfo.storage = persisted ? "granted" : "prompt";
    }
  } catch {
    state.permissionInfo.storage = "unknown";
  }
}

async function requestRequiredPermissions() {
  try {
    if (navigator.storage && navigator.storage.persist) {
      await navigator.storage.persist();
    }
  } catch {}

  await new Promise((resolve) => {
    if (!navigator.geolocation) return resolve();
    navigator.geolocation.getCurrentPosition(
      () => resolve(),
      () => resolve(),
      { timeout: 6000 }
    );
  });

  await refreshPermissionInfo();
}

async function loadPrayerTimes(lat, lon) {
  const config = getPrayerParams();
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const fmt = (d) => `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
  const base = `latitude=${lat}&longitude=${lon}&method=${config.method}&school=${config.school}`;
  const todayUrl = `https://api.aladhan.com/v1/timings/${fmt(today)}?${base}`;
  const prevUrl = `https://api.aladhan.com/v1/timings/${fmt(yesterday)}?${base}`;

  const [todayData, prevData] = await Promise.all([fetchJson(todayUrl), fetchJson(prevUrl)]);
  state.prayerTimes = todayData.data || null;
  state.prayerTimesPrev = prevData.data || null;
  state.prayerCoords = { lat, lon };
}

function renderPrayerTimesResult() {
  if (!state.prayerTimes) {
    return `<p class="translation">Search city name or use your current location to load timings.</p>`;
  }

  const timings = state.prayerTimes.timings || {};
  const maghribToday = parseTimeToDate(timings.Maghrib);
  const now = new Date();
  const beforeMaghrib = maghribToday ? now < maghribToday : false;
  const hijriSource = beforeMaghrib && state.prayerTimesPrev ? state.prayerTimesPrev : state.prayerTimes;
  const gDate = state.prayerTimes.date && state.prayerTimes.date.gregorian
    ? state.prayerTimes.date.gregorian.date
    : "Today";
  const hijri = hijriSource && hijriSource.date && hijriSource.date.hijri
    ? `${hijriSource.date.hijri.weekday.ar}، ${hijriSource.date.hijri.day} ${hijriSource.date.hijri.month.ar} ${hijriSource.date.hijri.year}`
    : "-";
  const nextPrayer = getNextPrayer(timings);
  const rows = [
    { key: "Fajr", label: "Fajr / Sehri End" },
    { key: "Sunrise", label: "Sunrise" },
    { key: "Dhuhr", label: "Dhuhr" },
    { key: "Asr", label: "Asr" },
    { key: "Maghrib", label: "Maghrib / Iftar" },
    { key: "Isha", label: "Isha" }
  ];

  return `
    <div class="prayer-grid">
      <article class="prayer-card">
        <h3>Sehri Ends</h3>
        <p class="prayer-time">${timings.Fajr || "-"}</p>
      </article>
      <article class="prayer-card">
        <h3>Iftar Time</h3>
        <p class="prayer-time">${timings.Maghrib || "-"}</p>
      </article>
    </div>
    <div class="prayer-meta">
      <p class="translation"><strong>City:</strong> ${state.prayerCity || "-"}</p>
      <p class="translation"><strong>Hijri:</strong> ${hijri}</p>
      <p class="translation">${beforeMaghrib ? "Before Maghrib: showing current Islamic day." : "After Maghrib: Islamic date changed."}</p>
      <p class="translation"><strong>Gregorian:</strong> ${gDate} | <strong>Calendar:</strong> ${getPrayerParams().label}</p>
    </div>
    <div class="prayer-list">
      ${rows
        .map(
          (row) => `
        <div class="prayer-row ${nextPrayer === row.key ? "next-prayer" : ""}">
          <span>${row.label}</span>
          <strong>${timings[row.key] || "-"}</strong>
        </div>
      `
        )
        .join("")}
    </div>
  `;
}

function renderSehriIftar() {
  const permissionLine = `Location: ${state.permissionInfo.location} | Cache: ${state.permissionInfo.storage}`;
  app.innerHTML = card(
    "Sehri & Iftar by Location",
    `
    <details class="settings-panel" open>
      <summary class="settings-summary">&#9881; Settings</summary>
      <div class="controls">
        <label class="field-label" for="school-select">Calendar / Fiqh</label>
        <select id="school-select" class="select">
          <option value="hanafi" ${state.prayerSchool === "hanafi" ? "selected" : ""}>Hanafi (Default)</option>
          <option value="ahle_hadith" ${state.prayerSchool === "ahle_hadith" ? "selected" : ""}>Ahl-e-Hadith</option>
          <option value="shia" ${state.prayerSchool === "shia" ? "selected" : ""}>Shia (Jafari)</option>
        </select>
        <label class="field-label" for="city-input">City</label>
        <input id="city-input" class="select" type="text" value="${state.prayerCity}" placeholder="e.g. Karachi, Lahore, Delhi" />
        <div class="tool-row">
          <button id="geo-btn" class="action-btn">Use My Location</button>
          <button id="refresh-prayer-btn" class="action-btn">Search City</button>
        </div>
        <div class="tool-row">
          <button id="permission-btn" class="action-btn">Grant Required Permissions</button>
          <span class="translation">${permissionLine}</span>
        </div>
      </div>
    </details>
    <div id="prayer-result">${renderPrayerTimesResult()}</div>
    `
  );

  document.getElementById("school-select").addEventListener("change", async (event) => {
    state.prayerSchool = event.target.value;
    try {
      if (state.prayerCoords) {
        await loadPrayerTimes(state.prayerCoords.lat, state.prayerCoords.lon);
        renderSehriIftar();
      }
    } catch (error) {
      const box = document.getElementById("prayer-result");
      if (box) box.innerHTML = `<p class="translation">Unable to switch calendar. (${error.message})</p>`;
    }
  });

  document.getElementById("geo-btn").addEventListener("click", () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;
          state.prayerCity = await reverseGeocode(lat, lon);
          await loadPrayerTimes(lat, lon);
          renderSehriIftar();
        } catch (error) {
          const box = document.getElementById("prayer-result");
          if (box) box.innerHTML = `<p class="translation">Unable to load timings. (${error.message})</p>`;
        }
      },
      () => {
        const box = document.getElementById("prayer-result");
        if (box) box.innerHTML = `<p class="translation">Location permission denied.</p>`;
      }
    );
  });

  document.getElementById("refresh-prayer-btn").addEventListener("click", async () => {
    try {
      const city = document.getElementById("city-input").value.trim();
      if (!city) {
        const box = document.getElementById("prayer-result");
        if (box) box.innerHTML = `<p class="translation">Enter city name first.</p>`;
        return;
      }
      const { lat, lon, city: normalizedCity } = await geocodeCity(city);
      state.prayerCity = normalizedCity;
      await loadPrayerTimes(lat, lon);
      renderSehriIftar();
    } catch (error) {
      const box = document.getElementById("prayer-result");
      if (box) box.innerHTML = `<p class="translation">Unable to refresh timings. (${error.message})</p>`;
    }
  });

  document.getElementById("permission-btn").addEventListener("click", async () => {
    await requestRequiredPermissions();
    renderSehriIftar();
  });
}

function buildLanguageButtons() {
  const languages = [
    { id: "urdu", label: "Urdu" },
    { id: "roman_urdu", label: "Roman Urdu" },
    { id: "hindi", label: "Hindi" },
    { id: "english", label: "English" },
    { id: "hinglish", label: "Hinglish" }
  ];

  return languages
    .map(
      (lang) => `
      <button class="chip ${state.language === lang.id ? "active" : ""}" data-lang="${lang.id}">${lang.label}</button>
    `
    )
    .join("");
}

function buildSurahOptions() {
  return surahList
    .map(
      (surah) =>
        `<option value="${surah.number}" ${state.selectedSurah === surah.number ? "selected" : ""}>${surah.number}. ${surah.englishName}</option>`
    )
    .join("");
}

function buildResourceOptions(items, selectedId) {
  if (!items.length) {
    return `<option value="">Not available</option>`;
  }

  return items
    .map((item) => {
      const title = `${item.name} - ${item.author_name || "Unknown"}`;
      return `<option value="${item.id}" ${item.id === selectedId ? "selected" : ""}>${title}</option>`;
    })
    .join("");
}

function buildTranslationCheckboxes(items) {
  if (!items.length) {
    return `<p class="translation">No translation authors available.</p>`;
  }

  const selected = new Set(state.translationIds);
  return items
    .map((item) => {
      const checked = selected.has(item.id) ? "checked" : "";
      const label = `${item.name} - ${item.author_name || "Unknown"}`;
      return `
      <label class="author-item">
        <input type="checkbox" class="translation-author" value="${item.id}" ${checked} />
        <span>${label}</span>
      </label>
      `;
    })
    .join("");
}

function buildRomanUrduHindiExternalSources() {
  const links = [
    {
      label: "Archive Item Page",
      url: "https://archive.org/details/quran-roman-urdu-hindi"
    },
    {
      label: "Original PDF",
      url: "https://archive.org/download/quran-roman-urdu-hindi/quran-roman-urdu-hindi.pdf"
    },
    {
      label: "Text PDF (OCR)",
      url: "https://archive.org/download/quran-roman-urdu-hindi/quran-roman-urdu-hindi_text.pdf"
    }
  ];

  return `
    <details class="settings-panel">
      <summary class="settings-summary">&#128214; Roman Urdu/Hindi PDF Sources</summary>
      <p class="translation"><strong>[PDF] Quran in Roman Urdu/Hindi</strong><br>by Faheemuddin Sidduiqui, Abdul Haleem Eliasi, Makatbah as-Sunnah</p>
      <div class="external-links">
        ${links
          .map(
            (link) => `
          <a class="external-link" href="${link.url}" target="_blank" rel="noopener noreferrer">${link.label}</a>
        `
          )
          .join("")}
      </div>
    </details>
  `;
}

function renderLineShell() {
  const { translationOptions, tafsirOptions } = getLanguageResources(state.language);

  app.innerHTML = card(
    "Line by Line with Tarjuma and Tafseer",
    `
    <details class="settings-panel" open>
      <summary class="settings-summary">&#9881; Settings</summary>
      <div class="controls">
        <div class="chip-row">${buildLanguageButtons()}</div>
        <label class="field-label" for="surah-select">Surah</label>
        <select id="surah-select" class="select">${buildSurahOptions()}</select>

        <label class="field-label">Meaning Authors (Multiple)</label>
        <div class="author-list">${buildTranslationCheckboxes(translationOptions)}</div>

        <label class="field-label" for="tafsir-select">Tafseer Author</label>
        <select id="tafsir-select" class="select">${buildResourceOptions(tafsirOptions, state.tafsirId)}</select>
      </div>
    </details>
    ${buildRomanUrduHindiExternalSources()}
    <div id="line-content" class="line-content">
      <p class="translation">Loading verses...</p>
    </div>
    `
  );

  app.querySelectorAll("[data-lang]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.language = btn.dataset.lang;
      normalizeResourceSelection();
      renderLineByLine();
    });
  });

  document.getElementById("surah-select").addEventListener("change", (event) => {
    state.selectedSurah = Number(event.target.value);
    renderLineByLine();
  });

  app.querySelectorAll(".translation-author").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      const selected = Array.from(app.querySelectorAll(".translation-author:checked")).map((item) => Number(item.value));
      state.translationIds = selected.length ? selected : state.translationIds;
      if (!selected.length) {
        checkbox.checked = true;
        return;
      }
      renderLineByLine();
    });
  });

  document.getElementById("tafsir-select").addEventListener("change", (event) => {
    state.tafsirId = event.target.value ? Number(event.target.value) : null;
    renderLineByLine();
  });
}

function renderAyat(verses, tafsirByVerse) {
  const container = document.getElementById("line-content");
  const translationNameMap = new Map(state.translations.map((item) => [item.id, item.name]));
  const html = verses
    .map((verse) => {
      const translationList = (verse.translations || [])
        .map((item) => {
          const author = translationNameMap.get(item.resource_id) || `Author ${item.resource_id}`;
          return `<div class="translation"><strong>${author}:</strong> ${sanitizeHtml(item.text || "")}</div>`;
        })
        .join("");
      const tafsir = tafsirByVerse.get(verse.verse_key) || "Tafseer not available for this verse in selected language/author.";

      return `
      <article class="line-ayah">
        <div class="badge">${verse.verse_key}</div>
        <div class="arabic">${verse.text_uthmani || ""}</div>
        ${translationList || `<div class="translation">Translation not available.</div>`}
        <details class="tafsir-box">
          <summary>Tafseer</summary>
          <div class="tafsir-text">${tafsir}</div>
        </details>
      </article>
    `;
    })
    .join("");

  container.innerHTML = html || `<p class="translation">No ayat found.</p>`;
}

async function renderLineByLine() {
  const loadKey = Date.now();
  state.currentLoadKey = loadKey;

  try {
    await ensureResourcesLoaded();
    normalizeResourceSelection();
    renderLineShell();

    const activeTranslationIds = state.translationIds.length ? state.translationIds : [20];
    const verseUrl = `${API_BASE}/verses/by_chapter/${state.selectedSurah}?language=en&words=false&translations=${activeTranslationIds.join(",")}&fields=text_uthmani,verse_key&per_page=300&page=1`;
    const tafsirUrl = state.tafsirId
      ? `${API_BASE}/tafsirs/${state.tafsirId}/by_chapter/${state.selectedSurah}?per_page=300&page=1`
      : null;

    const versePromise = fetchJson(verseUrl);
    const tafsirPromise = tafsirUrl ? fetchJson(tafsirUrl) : Promise.resolve({ tafsirs: [] });

    const [verseResponse, tafsirResponse] = await Promise.all([versePromise, tafsirPromise]);

    if (state.currentLoadKey !== loadKey) {
      return;
    }

    const tafsirByVerse = new Map(
      (tafsirResponse.tafsirs || []).map((item) => [item.verse_key, sanitizeHtml(item.text || "")])
    );

    renderAyat(verseResponse.verses || [], tafsirByVerse);
  } catch (error) {
    const target = document.getElementById("line-content");
    if (target) {
      target.innerHTML = `<p class="translation">Unable to load live data right now. Please try again. (${error.message})</p>`;
    }
  }
}

function renderSurah() {
  const list = surahList
    .map(
      (surah) => `
      <li class="surah-item">
        <button class="surah-btn" data-surah="${surah.number}">
          <span>${surah.number}. ${surah.englishName}</span>
          <span>${surah.arabicName}</span>
        </button>
      </li>
    `
    )
    .join("");

  app.innerHTML = card("Read by Surah (All 114)", `<ul class="surah-list">${list}</ul>`);

  app.querySelectorAll(".surah-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.selectedSurah = Number(btn.dataset.surah);
      navigateTo("line", { selectedSurah: state.selectedSurah });
    });
  });
}

function renderReadQuran() {
  const startPage = state.mushafStartPage || state.bookmarkPage || 1;
  renderMushaf("Read Quran - Complete 15-Line Mushaf Pages", startPage);
}

function render() {
  cleanupMushafObserver();
  setActiveNav(state.view);

  if (state.view === "home") return renderHome();
  if (state.view === "mushaf") return renderMushaf("15-Line Mushaf", 1);
  if (state.view === "line") return renderLineOnly();
  if (state.view === "translation") return renderLineByLine();
  if (state.view === "surah") return renderSurah();
  if (state.view === "para") return renderPara();
  if (state.view === "readquran") return renderReadQuran();
  if (state.view === "sehri") return renderSehriIftar();

  return renderHome();
}

navButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    navigateTo(btn.dataset.view);
  });
});

app.addEventListener("click", (event) => {
  const backButton = event.target.closest("[data-home-back]");
  if (!backButton) return;
  navigateTo("home");
});

state.bookmarkPage = readBookmarkPage();
state.mushafStartPage = state.bookmarkPage;
state.currentReadingPage = state.bookmarkPage;
state.selectedPara = getParaByPage(state.bookmarkPage);
refreshPermissionInfo();

window.addEventListener("popstate", async (event) => {
  if (event.state) {
    applyRouteState(event.state);
    render();
    return;
  }

  if (state.view !== "home") {
    navigateTo("home", {}, { push: false, replace: true, skipScroll: true });
    return;
  }

  if (exitConfirmArmed) {
    await tryExitApp();
    return;
  }

  exitConfirmArmed = true;
  const shouldExit = await confirmExitApp();
  if (!shouldExit) {
    history.pushState(getRouteState(), "");
    exitConfirmArmed = false;
  }
});

history.replaceState(getRouteState(), "");
history.pushState(getRouteState(), "");

render();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  });
}

if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App && window.Capacitor.Plugins.App.addListener) {
  window.Capacitor.Plugins.App.addListener("backButton", async () => {
    if (state.view !== "home") {
      history.back();
      return;
    }
    await confirmExitApp();
  });
}
