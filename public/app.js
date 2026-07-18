function initializeGamesAsArtLibrary() {
  const data = window.GAA;
  if (!data || window.__GAA_INITIALIZED__) return;

  let content;
  let searchDialog;
  let searchInput;
  let searchResults;
  let themePopover;
  let menu;
  let menuButton;
  let toast;
  function syncShell() {
    content = document.querySelector("#content");
    searchDialog = document.querySelector("#searchDialog");
    searchInput = document.querySelector("#globalSearch");
    searchResults = document.querySelector("#searchResults");
    themePopover = document.querySelector("#themePopover");
    menu = document.querySelector("#mobileNav");
    menuButton = document.querySelector("#menuButton");
    toast = document.querySelector("#toast");
    return Boolean(content && searchDialog && searchInput && searchResults && themePopover && menu && menuButton && toast);
  }
  if (!syncShell()) return;

  window.__GAA_INITIALIZED__ = true;
  const resources = data.resources || [];
  const collections = data.collections || [];
  const githubRepository = "https://github.com/xefensor/games-as-art-index";
  const githubUrls = {
    repository: githubRepository,
    suggestions: `${githubRepository}/issues/new?template=resource-suggestion.yml`,
    problems: `${githubRepository}/issues/new?template=broken-link.yml`,
    issues: `${githubRepository}/issues`,
    pulls: `${githubRepository}/pulls`,
    actions: `${githubRepository}/actions`,
    contributing: `${githubRepository}/blob/main/CONTRIBUTING.md`,
    records: `${githubRepository}/tree/main/content/resources`
  };
  const githubProblemUrl = item => `${githubUrls.problems}&title=${encodeURIComponent(`Catalogue problem: ${item.title}`)}`;
  const githubResourceFileUrl = item => `${githubRepository}/blob/main/content/resources/${encodeURIComponent(item.id)}.json`;
  const locationHref = location.href || `${location.origin}${location.pathname}${location.search || ""}${location.hash || ""}`;
  const siteRootUrl = new URL(document.querySelector('meta[name="gaa-site-root"]')?.content || "/", locationHref);
  const siteRootPath = siteRootUrl.pathname.endsWith("/") ? siteRootUrl.pathname : `${siteRootUrl.pathname}/`;
  const routeParts = route => {
    const [pathname, query = ""] = String(route || "/").split("?");
    const normalized = pathname === "/" ? "" : `${pathname.replace(/^\/+|\/+$/g, "")}/`;
    return { pathname: normalized, query };
  };
  const routeHref = route => {
    const { pathname, query } = routeParts(route);
    const target = new URL(pathname, siteRootUrl);
    target.search = query;
    return `${target.pathname}${target.search}`;
  };
  const assetHref = value => {
    if (!value || !value.startsWith("/")) return value || "";
    const target = new URL(value.slice(1), siteRootUrl);
    return `${target.pathname}${target.search}`;
  };
  const storage = {
    get(key, fallback) {
      try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
    }
  };
  const routeFromLocation = state => {
    if (location.hash.startsWith("#/")) return location.hash.slice(1);
    if (!location.pathname.startsWith(siteRootPath)) return state?.gaaRoute || "/";
    const relative = location.pathname.slice(siteRootPath.length).replace(/(?:^|\/)index\.html$/, "").replace(/\/+$/, "");
    return `${relative ? `/${relative}` : "/"}${location.search || ""}`;
  };
  let routeSpec = routeFromLocation(history.state);
  const frameworkNavigate = window.__VINEXT_RSC_NAVIGATE__;
  if (typeof frameworkNavigate === "function" && !frameworkNavigate.__gaaLibraryWrapped) {
    const wrappedNavigate = function (href, redirectCount, kind, ...rest) {
      const target = new URL(href, window.location.origin);
      if (kind === "traverse" && target.origin === window.location.origin && target.pathname.startsWith(siteRootPath)) return Promise.resolve();
      return frameworkNavigate.call(this, href, redirectCount, kind, ...rest);
    };
    Object.defineProperty(wrappedNavigate, "__gaaLibraryWrapped", { value: true });
    window.__VINEXT_RSC_NAVIGATE__ = wrappedNavigate;
  }

  const escapeHtml = (value = "") => String(value).replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character]));
  const resource = id => resources.find(item => item.id === id);
  const collection = id => collections.find(item => item.id === id);
  const queueStatuses = ["want", "progress", "finished"];
  const queueLabels = { want: "Want to explore", progress: "In progress", finished: "Finished" };
  const queueBadgeLabels = { want: "Want", progress: "In progress", finished: "Finished" };
  const queueMap = () => {
    const stored = storage.get("gaa-library-queue", null);
    if (stored && typeof stored === "object" && !Array.isArray(stored)) return Object.fromEntries(Object.entries(stored).filter(([id, entry]) => resource(id) && queueStatuses.includes(entry?.status)).map(([id, entry]) => [id, { status: entry.status, updatedAt: entry.updatedAt || new Date(0).toISOString() }]));
    const migrated = Object.fromEntries(storage.get("gaa-library-saved", []).filter(id => resource(id)).map(id => [id, { status: "want", updatedAt: new Date().toISOString() }]));
    storage.set("gaa-library-queue", migrated);
    return migrated;
  };
  const saveQueueMap = queue => {
    storage.set("gaa-library-queue", queue);
    storage.set("gaa-library-saved", Object.keys(queue));
  };
  const queueStatus = id => queueMap()[id]?.status || "";
  const savedIds = () => Object.entries(queueMap()).sort(([, left], [, right]) => String(right.updatedAt).localeCompare(String(left.updatedAt))).map(([id]) => id);
  const isSaved = id => Boolean(queueStatus(id));
  const setQueueStatus = (id, status) => {
    const queue = queueMap();
    if (queueStatuses.includes(status)) queue[id] = { status, updatedAt: new Date().toISOString() };
    else delete queue[id];
    saveQueueMap(queue);
    return queue[id]?.status || "";
  };
  const isVisited = id => storage.get("gaa-library-history", []).includes(id);
  const linkChecks = new Map((data.linkStatus?.results || []).map(result => [result.id, result]));
  const resourceUrl = item => item.url;
  const youtubeVideoId = item => {
    const configuredId = item.embed?.provider === "youtube" ? item.embed.videoId : "";
    if (/^[A-Za-z0-9_-]{11}$/.test(configuredId || "")) return configuredId;
    try {
      const url = new URL(resourceUrl(item));
      const host = url.hostname.replace(/^www\./, "");
      const id = host === "youtu.be" ? url.pathname.split("/").filter(Boolean)[0] : ["youtube.com", "m.youtube.com"].includes(host) ? url.searchParams.get("v") : "";
      return /^[A-Za-z0-9_-]{11}$/.test(id || "") ? id : "";
    } catch { return ""; }
  };
  const trustStates = {
    working: { label: "Working", priority: 3 },
    redirected: { label: "Redirected", priority: 2 },
    "needs-rechecking": { label: "Needs rechecking", priority: 1 },
    broken: { label: "Broken", priority: 0 }
  };
  const trustState = item => {
    const check = linkChecks.get(item.id);
    let key = "working";
    if (check?.status === "broken") key = "broken";
    else if (check?.redirected) key = "redirected";
    else if (check && check.status !== "ok") key = "needs-rechecking";
    else if (!check && (Date.now() - Date.parse(`${item.lastChecked}T00:00:00Z`)) / 86400000 > 180) key = "needs-rechecking";
    const checkedAt = check?.checkedAt || `${item.lastChecked}T00:00:00Z`;
    const detail = check?.checkMethod === "manual" ? check.note || "A curator opened and verified the original source." : key === "working" ? "The original link responded successfully at the latest check." : key === "redirected" ? "The source now redirects to a different URL and should be reviewed." : key === "broken" ? "The latest automated check received a broken response." : check ? "The automated checker could not confirm the source and a person should review it." : "The catalogue verification date is older than six months.";
    return { key, label: trustStates[key].label, priority: trustStates[key].priority, checkedAt, check, detail };
  };
  const trustBadge = (item, compact = false) => {
    const trust = trustState(item);
    return `<span class="trust-badge ${compact ? "compact" : ""}" data-trust="${trust.key}" title="${escapeHtml(trust.detail)}">${trust.label}<small>${checkedDate(trust.checkedAt)}</small></span>`;
  };
  const problemReports = () => storage.get("gaa-resource-reports", []).filter(report => resource(report.resourceId));
  const saveProblemReports = reports => storage.set("gaa-resource-reports", reports);
  const reportButton = item => `<a class="report-control" href="${githubProblemUrl(item)}" target="_blank" rel="noreferrer" aria-label="Report a problem with ${escapeHtml(item.title)} on GitHub" title="Report a problem on GitHub">⚑</a>`;
  const resourceMinutes = item => {
    const minutes = String(item.length || "").match(/([\d,]+)\s*min/i);
    if (minutes) return Number(minutes[1].replace(/,/g, ""));
    const pages = String(item.length || "").match(/([\d,]+)\s*pages?/i);
    if (pages) return Number(pages[1].replace(/,/g, "")) * 2;
    return 0;
  };
  const formatCommitment = items => {
    const minutes = items.reduce((total, item) => total + resourceMinutes(item), 0);
    const openEnded = items.some(item => !resourceMinutes(item));
    if (!minutes) return "Open-ended reference";
    const time = minutes < 60 ? `${minutes} min` : minutes % 60 && minutes < 600 ? `${Math.floor(minutes / 60)} hr ${minutes % 60} min` : `${Math.round(minutes / 60)} hr`;
    return `Approx. ${time}${openEnded ? " + reference material" : ""}`;
  };
  const collectionProgress = item => {
    const items = item.resources.map(resource).filter(Boolean);
    const statuses = items.map(entry => queueStatus(entry.id));
    const finished = statuses.filter(status => status === "finished").length;
    const queued = statuses.filter(Boolean).length;
    return { items, finished, queued, total: items.length, percent: items.length ? Math.round(finished / items.length * 100) : 0, next: items.find(entry => queueStatus(entry.id) !== "finished") || items[0], commitment: formatCommitment(items) };
  };
  const personalizationEnabled = () => storage.get("gaa-personalization-enabled", true) !== false;
  const personalizationProfile = () => {
    const subjectScores = new Map();
    const formatScores = new Map();
    const relevanceScores = new Map();
    const addSignal = (item, weight) => {
      if (!item) return;
      item.subjects.forEach(value => subjectScores.set(value, (subjectScores.get(value) || 0) + weight));
      item.relevance.forEach(value => relevanceScores.set(value, (relevanceScores.get(value) || 0) + weight));
      formatScores.set(item.type, (formatScores.get(item.type) || 0) + Math.max(1, weight / 2));
    };
    const queue = queueMap();
    Object.entries(queue).forEach(([id, entry]) => addSignal(resource(id), entry.status === "progress" ? 6 : entry.status === "want" ? 4 : 2));
    storage.get("gaa-library-history", []).slice(0, 12).forEach((id, index) => addSignal(resource(id), Math.max(1, 3 - index * .2)));
    const ranked = map => [...map.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
    return { subjects: ranked(subjectScores), formats: ranked(formatScores), relevance: ranked(relevanceScores), hasSignals: subjectScores.size > 0 || formatScores.size > 0 };
  };
  const personalizedResources = (profile, limit = 6) => {
    const queue = queueMap();
    const history = new Set(storage.get("gaa-library-history", []).slice(0, 8));
    return resources.filter(item => !queue[item.id] && !history.has(item.id)).map(item => {
      const subjectMatches = item.subjects.map(value => [value, profile.subjects.find(([subject]) => subject === value)?.[1] || 0]).filter(([, score]) => score).sort((left, right) => right[1] - left[1]);
      const relevanceScore = item.relevance.reduce((total, value) => total + (profile.relevance.find(([label]) => label === value)?.[1] || 0), 0);
      const formatScore = profile.formats.find(([format]) => format === item.type)?.[1] || 0;
      const score = subjectMatches.reduce((total, [, value]) => total + value * 3, 0) + relevanceScore + formatScore;
      const reason = subjectMatches[0]?.[0] ? `Because you explored ${subjectMatches[0][0]}` : formatScore ? `Because you often explore ${item.type.toLowerCase()} resources` : "Related to your local index activity";
      return { item, score, reason };
    }).filter(entry => entry.score > 0).sort((left, right) => right.score - left.score || resourceOrder.get(left.item.id) - resourceOrder.get(right.item.id)).slice(0, limit);
  };
  const suggestionQueue = () => storage.get("gaa-suggestion-queue", []);
  const saveSuggestionQueue = queue => storage.set("gaa-suggestion-queue", queue);
  const catalogueDrafts = () => storage.get("gaa-catalogue-drafts", []);
  const saveCatalogueDrafts = drafts => storage.set("gaa-catalogue-drafts", drafts);
  const suggestionStatuses = ["draft", "reviewed", "published", "needs-rechecking", "rejected"];
  const searchable = item => [item.title, item.creator, item.publisher, item.type, item.level, item.access, item.length, item.lengthClass, item.description, item.useful, item.audience, ...item.learning, ...item.subjects, ...item.relevance, ...item.topics, ...item.games].join(" ");
  const normalizeSearch = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9+#]+/g, " ").trim();
  const searchAliases = {
    beginner: ["introductory", "first"], beginners: ["introductory", "first"], code: ["programming"], coding: ["programming"],
    sound: ["audio"], audio: ["sound", "music"], story: ["narrative", "dialogue"], storytelling: ["narrative"],
    graphics: ["rendering", "visual"], art: ["visual"], making: ["production"], teamwork: ["production"],
    inclusive: ["accessibility"], accessible: ["accessibility"], preservation: ["history", "archive"], criticism: ["theory"]
  };
  const suggestionGroups = [
    { keys: ["level", "level design", "mapping", "space"], values: ["spatial design", "player guidance", "environment art"] },
    { keys: ["audio", "sound", "music"], values: ["adaptive music", "procedural audio", "sound implementation"] },
    { keys: ["story", "narrative", "writing", "dialogue"], values: ["interactive fiction", "procedural narrative", "game writing"] },
    { keys: ["art", "visual", "graphics", "animation"], values: ["art direction", "rendering", "environment art"] },
    { keys: ["code", "programming", "technical"], values: ["game architecture", "shaders", "networking"] },
    { keys: ["beginner", "introductory", "first"], values: ["first project", "game design basics", "getting started"] },
    { keys: ["accessibility", "accessible", "inclusive"], values: ["inclusive design", "player barriers", "accessibility testing"] },
    { keys: ["history", "preservation", "archive"], values: ["game preservation", "postmortem", "platform history"] },
    { keys: ["production", "team", "scope"], values: ["finishing a game", "teamwork", "sustainable production"] }
  ];
  const editDistance = (left, right) => {
    if (left === right) return 0;
    const row = Array.from({ length: right.length + 1 }, (_, index) => index);
    for (let i = 1; i <= left.length; i += 1) {
      let diagonal = row[0];
      row[0] = i;
      for (let j = 1; j <= right.length; j += 1) {
        const previous = row[j];
        row[j] = Math.min(row[j] + 1, row[j - 1] + 1, diagonal + (left[i - 1] === right[j - 1] ? 0 : 1));
        diagonal = previous;
      }
    }
    return row[right.length];
  };
  const relatedTermsFor = query => {
    const term = normalizeSearch(query);
    if (term.length < 2) return [];
    const group = suggestionGroups.find(entry => entry.keys.some(key => term.includes(key) || (term.length > 3 && key.includes(term))));
    return group ? group.values.filter(value => normalizeSearch(value) !== term).slice(0, 3) : [];
  };
  const searchScore = (item, query) => {
    const term = normalizeSearch(query);
    if (!term) return 1;
    const haystack = normalizeSearch(searchable(item));
    const phraseIndex = haystack.indexOf(term);
    if (phraseIndex >= 0) return 1000 - Math.min(phraseIndex, 500);
    if (haystack.replace(/ /g, "").includes(term.replace(/ /g, ""))) return 850;
    const words = [...new Set(haystack.split(" ").filter(Boolean))];
    let score = 0;
    for (const token of term.split(" ").filter(Boolean)) {
      const options = [token, ...(searchAliases[token] || [])];
      let best = 0;
      for (const option of options) {
        for (const word of words) {
          if (word === option) best = Math.max(best, 100);
          else if (option.length >= 3 && word.startsWith(option)) best = Math.max(best, 70);
          else if (option.length >= 4 && word.includes(option)) best = Math.max(best, 55);
          else if (option.length >= 4) {
            const allowance = option.length >= 5 ? 2 : 1;
            if (Math.abs(word.length - option.length) <= allowance && editDistance(option, word) <= allowance) best = Math.max(best, 40);
          }
        }
      }
      if (!best) return 0;
      score += best;
    }
    return score;
  };
  const resourceOrder = new Map(resources.map((item, index) => [item.id, index]));
  const unique = values => [...new Set(values)].sort((a, b) => a.localeCompare(b));
  const checkedDate = value => {
    if (!value) return "Not recorded";
    const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value);
    return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(date);
  };
  const types = unique(resources.map(item => item.type));
  const topics = unique(resources.flatMap(item => item.topics));
  const taxonomy = data.taxonomy || {};
  const subjects = taxonomy.subjects || unique(resources.flatMap(item => item.subjects || []));
  const levels = taxonomy.levels || unique(resources.map(item => item.level));
  const accessTypes = taxonomy.access || unique(resources.map(item => item.access));
  const lengthClasses = taxonomy.lengths || unique(resources.map(item => item.lengthClass));
  const relevanceTypes = taxonomy.relevance || unique(resources.flatMap(item => item.relevance || []));

  const thumbnailEntry = item => data.thumbnails?.resources?.[item.id] || (resourceOrder.has(item.id) ? { path: `/thumbnails/${item.id}.webp`, method: "local" } : null);
  const thumbnailUrl = item => assetHref(thumbnailEntry(item)?.path || item.image || "");
  const googleBooksIsbn = item => item.type === "Book" ? resourceUrl(item).match(/(?:978|979)\d{10}/)?.[0] || "" : "";
  const embedPanel = item => {
    const videoId = youtubeVideoId(item);
    const bookIsbn = googleBooksIsbn(item);
    const title = escapeHtml(item.title);
    if (videoId) {
      const youtubeUrl = item.embed?.provider === "youtube" ? `https://www.youtube.com/watch?v=${videoId}` : resourceUrl(item);
      return `<section class="resource-embed" aria-labelledby="embed-title-${item.id}"><header><div><span class="eyebrow">Watch here</span><h2 id="embed-title-${item.id}">${title}</h2></div><a href="${escapeHtml(youtubeUrl)}" target="_blank" rel="noreferrer">Open video on YouTube ↗</a></header><div class="embed-frame" data-youtube-embed="${videoId}" data-resource-id="${item.id}"><button class="embed-consent" type="button" data-load-youtube="${videoId}" aria-label="Play ${title} using the YouTube player"><img src="${escapeHtml(thumbnailUrl(item))}" alt="" loading="lazy"><span class="embed-play" aria-hidden="true">▶</span><strong>Load YouTube player</strong></button></div><p>YouTube loads only after you choose play. The original catalogue source remains available above; if embedding is disabled, open the video on YouTube instead.</p></section>`;
    }
    if (item.embed?.provider === "pdf") {
      const documentUrl = escapeHtml(item.embed.url);
      return `<section class="resource-embed document-embed" aria-labelledby="embed-title-${item.id}"><header><div><span class="eyebrow">Read here</span><h2 id="embed-title-${item.id}">${title}</h2></div><a href="${documentUrl}" target="_blank" rel="noreferrer">Open PDF ↗</a></header><div class="embed-frame document-frame" data-document-embed data-resource-id="${item.id}"><button class="embed-consent" type="button" data-load-document="${documentUrl}" aria-label="Read ${title} in the embedded PDF viewer"><img src="${escapeHtml(thumbnailUrl(item))}" alt="" loading="lazy"><span class="embed-play embed-document-icon" aria-hidden="true">PDF</span><strong>Load PDF reader</strong></button></div><p>The document loads from its original publisher only after you choose to read it. If your browser cannot display the PDF here, use the direct PDF link.</p></section>`;
    }
    if (bookIsbn) return `<section class="resource-embed book-embed" aria-labelledby="embed-title-${item.id}"><header><div><span class="eyebrow">Preview here</span><h2 id="embed-title-${item.id}">${title}</h2></div><a href="${escapeHtml(resourceUrl(item))}" target="_blank" rel="noreferrer">Open publisher page ↗</a></header><div class="embed-frame document-frame book-frame" data-google-books-embed data-resource-id="${item.id}"><button class="embed-consent" type="button" data-load-google-book="${bookIsbn}" aria-label="Check for a Google Books preview of ${title}"><img src="${escapeHtml(thumbnailUrl(item))}" alt="" loading="lazy"><span class="embed-play embed-document-icon" aria-hidden="true">BOOK</span><strong>Check for book preview</strong></button></div><p>Google Books loads only after you request a preview. Availability can vary by edition and region; the publisher link always remains available.</p></section>`;
    return "";
  };

  let googleBooksApiPromise;
  const loadGoogleBooksApi = () => {
    if (window.google?.books?.DefaultViewer) return Promise.resolve();
    if (googleBooksApiPromise) return googleBooksApiPromise;
    googleBooksApiPromise = new Promise((resolve, reject) => {
      let settled = false;
      const finish = callback => value => { if (settled) return; settled = true; clearTimeout(timeout); callback(value); };
      const ready = finish(resolve);
      const failed = finish(reject);
      const initialize = () => {
        try {
          if (!window.google?.books) throw new Error("Google Books API did not initialize");
          window.google.books.load({ language: "en" });
          window.google.books.setOnLoadCallback(ready);
        } catch (error) { failed(error); }
      };
      const timeout = setTimeout(() => failed(new Error("Google Books preview timed out")), 12000);
      const existing = document.querySelector('script[data-google-books-api]');
      if (existing) { existing.addEventListener("load", initialize, { once: true }); existing.addEventListener("error", failed, { once: true }); }
      else {
        const script = document.createElement("script");
        script.src = "https://www.google.com/books/jsapi.js";
        script.dataset.googleBooksApi = "";
        script.addEventListener("load", initialize, { once: true });
        script.addEventListener("error", failed, { once: true });
        document.head.appendChild(script);
      }
    });
    return googleBooksApiPromise;
  };

  const loadGoogleBook = async (frame, item, isbn) => {
    const unavailable = () => {
      frame.classList.add("is-unavailable");
      frame.innerHTML = `<div class="embed-unavailable"><span class="eyebrow">Preview unavailable</span><h3>Google Books cannot embed this edition here.</h3><p>The preview may be unavailable for this ISBN or in your region.</p><a class="primary-action" href="${escapeHtml(resourceUrl(item))}" target="_blank" rel="noreferrer">Open publisher page ↗</a></div>`;
    };
    frame.innerHTML = `<div class="embed-loading"><span></span>Checking Google Books preview…</div>`;
    try {
      await loadGoogleBooksApi();
      const canvas = document.createElement("div");
      canvas.className = "google-books-canvas";
      frame.replaceChildren(canvas);
      const viewer = new window.google.books.DefaultViewer(canvas);
      viewer.load(`ISBN:${isbn}`, unavailable, () => frame.classList.add("is-loaded"));
    } catch { unavailable(); }
  };

  function cover(item, large = false) {
    const initials = item.title.split(/\s+/).filter(word => !/^(the|of|a|an|and|to|with)$/i.test(word)).slice(0, 2).map(word => word[0]).join("").toUpperCase();
    const thumbnail = thumbnailEntry(item);
    const image = thumbnailUrl(item);
    const displayMethod = thumbnail?.method || (image ? "catalogue" : "none");
    const imageAlt = thumbnail?.method === "generated" && image === thumbnail.path ? `Generated cover for ${item.title}` : item.type === "Book" ? `Cover of ${item.title}` : `Thumbnail for ${item.title}`;
    return `<div class="resource-cover ${large ? "cover-large" : ""} ${image ? "has-image" : ""}" data-format="${item.type.toLowerCase()}" data-thumbnail-method="${displayMethod}">
      ${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(imageAlt)}" loading="${large ? "eager" : "lazy"}" referrerpolicy="no-referrer" onerror="this.parentElement.classList.remove('has-image');this.remove()">` : ""}
      <span class="cover-format">${item.type}</span><strong>${initials}</strong><small>${item.year}</small>
    </div>`;
  }

  function saveButton(item, compact = false) {
    const saved = isSaved(item.id);
    return `<button class="save-control ${saved ? "is-saved" : ""} ${compact ? "compact" : ""}" type="button" data-save="${item.id}" aria-label="${saved ? "Remove" : "Save"} ${escapeHtml(item.title)}">${saved ? "Saved ✓" : compact ? "+ Save" : "Save resource"}</button>`;
  }

  function queueControl(item, compact = false) {
    const status = queueStatus(item.id);
    if (!status) return saveButton(item, compact);
    return `<label class="queue-control ${compact ? "compact" : ""}"><span class="visually-hidden">Queue status for ${escapeHtml(item.title)}</span><select data-queue-status="${item.id}" aria-label="Queue status for ${escapeHtml(item.title)}">${queueStatuses.map(value => `<option value="${value}" ${value === status ? "selected" : ""}>${queueLabels[value]}</option>`).join("")}<option value="remove">Remove from queue</option></select></label>`;
  }

  function resourceCard(item, recommendationReason = "") {
    const saved = isSaved(item.id);
    const visited = isVisited(item.id);
    const status = queueStatus(item.id);
    const state = saved ? queueBadgeLabels[status] : visited ? "Visited" : "";
    return `<article class="resource-card ${saved ? "is-saved" : ""} ${visited ? "is-visited" : ""}" data-resource-id="${item.id}" data-queue-state="${status}">
      <a class="card-main" href="#/resource/${item.id}">${cover(item)}${state ? `<span class="cover-state">${state}</span>` : ""}<div class="card-copy">
        <div class="card-kicker"><span>${item.type}</span><span>${item.access}</span><span>${item.length}</span></div>
        <div class="card-trust">${trustBadge(item)}</div>
        <h3>${item.title}</h3><p class="card-credit">${item.creator} · ${item.year}</p>
        <p>${item.description}</p>
        ${typeof recommendationReason === "string" && recommendationReason ? `<p class="card-reason"><strong>Why this appears</strong>${escapeHtml(recommendationReason)}</p>` : ""}
        <p class="card-audience"><strong>Best for</strong>${item.audience}</p>
        <div class="topic-row">${item.subjects.slice(0, 3).map(subject => `<span>${subject}</span>`).join("")}<span class="relevance-tag">${item.relevance[0]}</span></div>
      </div></a><div class="card-controls">${queueControl(item, true)}<div class="card-external-actions"><a class="direct-control" href="${escapeHtml(resourceUrl(item))}" target="_blank" rel="noreferrer" aria-label="Open original resource: ${escapeHtml(item.title)}">Open original ↗</a>${reportButton(item)}</div></div>
    </article>`;
  }

  function resourceListItem(item) {
    const saved = isSaved(item.id);
    const visited = isVisited(item.id);
    const status = queueStatus(item.id);
    const state = saved ? queueBadgeLabels[status] : visited ? "Visited" : "";
    return `<article class="resource-list-item ${saved ? "is-saved" : ""} ${visited ? "is-visited" : ""}" data-resource-id="${item.id}" data-queue-state="${status}"><a class="list-main" href="#/resource/${item.id}"><div class="list-title"><span>${item.type}</span><strong>${item.title}</strong><small>${item.creator} · ${item.year}</small></div><dl><div><dt>Subject</dt><dd>${item.subjects[0]}</dd></div><div><dt>Access</dt><dd>${item.access}</dd></div><div><dt>Length</dt><dd>${item.length}</dd></div><div><dt>Level</dt><dd>${item.level}</dd></div><div><dt>Verified</dt><dd>${trustBadge(item, true)}</dd></div></dl><span class="list-state ${state ? "" : "is-empty"}" aria-hidden="${state ? "false" : "true"}">${state || "Status"}</span></a><div class="list-actions">${queueControl(item, true)}<a class="direct-control" href="${escapeHtml(resourceUrl(item))}" target="_blank" rel="noreferrer" aria-label="Open original resource: ${escapeHtml(item.title)}">Open original ↗</a>${reportButton(item)}</div></article>`;
  }

  function collectionCard(item) {
    const progress = collectionProgress(item);
    const action = progress.finished === progress.total && progress.total ? "Review collection" : progress.queued ? "Continue collection" : "Open collection";
    return `<a class="collection-card" data-color="${item.color}" href="#/collection/${item.id}">
      <span class="collection-number">${String(progress.total).padStart(2, "0")}</span>
      <div><span class="eyebrow">Curated collection</span><h3>${item.title}</h3><p>${item.description}</p></div>
      <div class="collection-progress"><span><i style="width:${progress.percent}%"></i></span><small>${progress.finished} of ${progress.total} finished · ${progress.commitment}</small></div><b>${action} →</b>
    </a>`;
  }

  function siteFooter() {
    return `<footer class="site-footer shell"><div><a class="brand footer-brand" href="#/"><span class="brand-bars"><i></i><i></i><i></i></span><span>Games <em>as</em> Art <small>Index</small></span></a><p>A curated index of game development, history, and criticism.</p></div><nav><a href="#/browse">Browse all</a><a href="#/collections">Collections</a><a href="#/saved">Saved locally</a><a href="#/suggest">Contribute</a><a href="#/about">About the index</a></nav><small>${resources.length} records · English · Browsing needs no account · Contributions reviewed on GitHub</small></footer>`;
  }

  function personalizedHomeView() {
    if (!personalizationEnabled()) return `<section class="home-section personalization-off shell"><div><span class="eyebrow">Local personalization is off</span><h2>Your homepage is using the general catalogue view.</h2><p>Your queue and viewing history are still stored on this device and have not been deleted.</p></div><button type="button" data-toggle-personalization>Enable local suggestions</button></section>`;
    const profile = personalizationProfile();
    if (!profile.hasSignals) return "";
    const queue = queueMap();
    const activeResources = savedIds().map(resource).filter(item => item && queue[item.id]?.status === "progress").slice(0, 3);
    const activeCollections = collections.map(item => ({ item, progress: collectionProgress(item) })).filter(({ progress }) => progress.queued > 0 && progress.finished < progress.total).sort((left, right) => right.progress.finished - left.progress.finished || right.progress.queued - left.progress.queued).slice(0, 3).map(entry => entry.item);
    const recommendations = personalizedResources(profile, 3);
    const recommendationIds = new Set(recommendations.map(entry => entry.item.id));
    const followedSubjects = profile.subjects.slice(0, 2).map(([subject]) => subject);
    const recent = resources.filter(item => !queue[item.id] && !recommendationIds.has(item.id) && item.subjects.some(subject => followedSubjects.includes(subject))).sort((left, right) => String(right.addedAt).localeCompare(String(left.addedAt)) || resourceOrder.get(left.id) - resourceOrder.get(right.id)).slice(0, 3);
    const controls = `<div class="personalization-controls"><button type="button" data-toggle-personalization>Turn off</button><button type="button" data-reset-personalization>Clear viewing signals</button></div>`;
    const continueMarkup = activeResources.length || activeCollections.length ? `<div class="personal-home-block continue-home"><header><div><span class="eyebrow">Your local activity</span><h3>Continue learning</h3></div><a href="#/saved">Open learning queue →</a></header>${activeResources.length ? `<div class="resource-grid">${activeResources.map(item => resourceCard(item)).join("")}</div>` : ""}${activeCollections.length ? `<div class="collection-grid personal-collections">${activeCollections.map(collectionCard).join("")}</div>` : ""}</div>` : "";
    const recommendationMarkup = recommendations.length ? `<div class="personal-home-block recommendation-home"><header><div><span class="eyebrow">Based only on this browser</span><h3>Recommended for you</h3></div><p>Matched from ${followedSubjects.join(" and ") || "your recent activity"}.</p></header><div class="resource-grid">${recommendations.map(({ item, reason }) => resourceCard(item, reason)).join("")}</div></div>` : "";
    const recentMarkup = recent.length ? `<div class="personal-home-block recent-interests"><header><div><span class="eyebrow">Recently catalogued</span><h3>Newer entries in your subjects</h3></div><a href="#/browse?sort=recently-added">Browse recent additions →</a></header><div class="resource-grid">${recent.map(item => resourceCard(item, `Recently catalogued in ${item.subjects.find(subject => followedSubjects.includes(subject)) || item.subjects[0]}`)).join("")}</div></div>` : "";
    return `<section class="home-section personal-home shell"><header class="personal-home-header"><div><span class="eyebrow">Your local homepage</span><h2>Pick up where you stopped—or find the next useful thing.</h2><p>These sections use only your learning queue and viewing history stored in this browser.</p></div>${controls}</header>${continueMarkup}${recommendationMarkup}${recentMarkup}</section>`;
  }

  function homeView() {
    const featured = resources.filter(item => item.featured).slice(0, 6);
    const freeCount = resources.filter(item => item.access === "Free").length;
    const personalized = personalizedHomeView();
    const personalizedActive = personalizationEnabled() && personalizationProfile().hasSignals;
    return `<section class="library-hero shell"><div class="hero-copy"><span class="eyebrow">A curated index of games knowledge</span><h1>Find the useful thing someone already made.</h1><p>Game development, history, and criticism through talks, books, articles, documentation, courses, papers, and archives—described plainly and organized for better searching.</p>
      <button class="hero-search" type="button" data-open-search><span>⌕</span><strong>Search by topic, creator, game, or format</strong><kbd>/</kbd></button>
      <div class="popular-topics"><span>Popular:</span>${["Level design", "Game design", "Programming", "Audio", "Game history"].map(topic => `<a href="#/browse?q=${encodeURIComponent(topic)}">${topic}</a>`).join("")}</div>
    </div><aside class="catalogue-summary"><span class="eyebrow">Index at a glance</span><dl><div><dt>${resources.length}</dt><dd>resources</dd></div><div><dt>${freeCount}</dt><dd>free to access</dd></div><div><dt>${types.length}</dt><dd>formats</dd></div><div><dt>${topics.length}</dt><dd>topics</dd></div></dl><a href="#/browse">Browse the complete index →</a></aside></section>${personalized}
    <section class="home-section shell"><header class="section-header"><div><span class="eyebrow">Choose a route in</span><h2>Curated starting points</h2></div><a href="#/collections">View all collections →</a></header><div class="collection-grid">${collections.slice(0, 3).map(collectionCard).join("")}</div></section>
    ${personalizedActive ? "" : `<section class="home-section featured-resources shell"><header class="section-header"><div><span class="eyebrow">A mixed shelf</span><h2>Recommended resources</h2></div><a href="#/browse">View all ${resources.length} →</a></header><div class="resource-grid">${featured.map(resourceCard).join("")}</div></section>`}
    <section class="format-browser shell"><span class="eyebrow">Browse by format</span><div>${types.map(type => `<a href="#/browse?type=${encodeURIComponent(type)}"><strong>${type}</strong><span>${resources.filter(item => item.type === type).length}</span></a>`).join("")}</div></section>${siteFooter()}`;
  }

  function browseView() {
    const params = new URLSearchParams(routeSpec.split("?")[1] || "");
    const legacyTopic = params.get("topic");
    const preferredView = storage.get("gaa-browse-view", "cards");
    const initial = {
      q: params.get("q") || "",
      type: types.includes(params.get("type")) ? params.get("type") : "all",
      subject: subjects.includes(params.get("subject")) ? params.get("subject") : subjects.includes(legacyTopic) ? legacyTopic : "all",
      level: levels.includes(params.get("level")) ? params.get("level") : "all",
      access: accessTypes.includes(params.get("access")) ? params.get("access") : "all",
      length: lengthClasses.includes(params.get("length")) ? params.get("length") : "all",
      relevance: relevanceTypes.includes(params.get("relevance")) ? params.get("relevance") : "all",
      trust: Object.keys(trustStates).includes(params.get("trust")) ? params.get("trust") : "all",
      sort: ["recommended", "newest", "oldest", "title", "shortest", "introductory", "free", "recently-added", "recently-verified"].includes(params.get("sort")) ? params.get("sort") : "recommended",
      view: ["cards", "list"].includes(params.get("view")) ? params.get("view") : ["cards", "list"].includes(preferredView) ? preferredView : "cards"
    };
    const selected = (value, current) => value === current ? "selected" : "";
    return `<section class="browse-page shell"><header class="page-heading"><div><span class="eyebrow">Complete index</span><h1>Browse resources</h1><p>Filter the index without losing the context needed to judge whether a resource is worth opening.</p></div><div class="page-count"><strong>${resources.length}</strong><span>indexed records</span></div></header>
      <div class="browse-tools"><div class="browse-search-row"><label class="browse-search"><span>⌕</span><input id="browseQuery" type="search" value="${escapeHtml(initial.q)}" placeholder="Search title, creator, game, or subject" autocomplete="off"></label><button class="filter-toggle" id="filterToggle" type="button" aria-controls="filterPanel" aria-expanded="false">Filters <span id="filterCount">0</span></button></div>
        <div class="search-related" id="searchRelated" aria-live="polite"></div>
        <div class="filter-panel" id="filterPanel"><header class="filter-panel-header"><div><span class="eyebrow">Refine the catalogue</span><strong>Filters</strong></div><button id="closeFilters" type="button" aria-label="Close filters">Close ×</button></header><div class="filter-row">
          <label><span>Format</span><select id="filterType"><option value="all">All formats</option>${types.map(type => `<option value="${type}" ${selected(type, initial.type)}>${type}</option>`).join("")}</select></label>
          <label><span>Subject</span><select id="filterSubject"><option value="all">All subjects</option>${subjects.map(subject => `<option value="${subject}" ${selected(subject, initial.subject)}>${subject}</option>`).join("")}</select></label>
          <label><span>Level</span><select id="filterLevel"><option value="all">Any level</option>${levels.map(level => `<option value="${level}" ${selected(level, initial.level)}>${level}</option>`).join("")}</select></label>
          <label><span>Access</span><select id="filterAccess"><option value="all">Any access</option>${accessTypes.map(access => `<option value="${access}" ${selected(access, initial.access)}>${access}</option>`).join("")}</select></label>
          <label><span>Length</span><select id="filterLength"><option value="all">Any length</option>${lengthClasses.map(length => `<option value="${length}" ${selected(length, initial.length)}>${length}</option>`).join("")}</select></label>
          <label><span>Best used for</span><select id="filterRelevance"><option value="all">Any purpose</option>${relevanceTypes.map(relevance => `<option value="${relevance}" ${selected(relevance, initial.relevance)}>${relevance}</option>`).join("")}</select></label>
          <label><span>Link state</span><select id="filterTrust"><option value="all">Any verification state</option>${Object.entries(trustStates).map(([key, state]) => `<option value="${key}" ${selected(key, initial.trust)}>${state.label}</option>`).join("")}</select></label>
          <label><span>Sort</span><select id="filterSort"><option value="recommended" ${selected("recommended", initial.sort)}>Recommended</option><option value="recently-added" ${selected("recently-added", initial.sort)}>Recently added</option><option value="recently-verified" ${selected("recently-verified", initial.sort)}>Recently verified</option><option value="newest" ${selected("newest", initial.sort)}>Newest publication</option><option value="oldest" ${selected("oldest", initial.sort)}>Oldest publication</option><option value="title" ${selected("title", initial.sort)}>Title A–Z</option><option value="shortest" ${selected("shortest", initial.sort)}>Shortest first</option><option value="introductory" ${selected("introductory", initial.sort)}>Introductory first</option><option value="free" ${selected("free", initial.sort)}>Free first</option></select></label>
          <button type="button" id="clearFilters">Clear all</button>
        </div></div>
        <div class="active-filters" id="activeFilters" aria-live="polite"></div>
      </div>
      <div class="results-line"><strong id="browseStatus"></strong><div class="results-controls"><button class="sticky-filter-trigger" type="button" data-open-filters>Filters <span>↕</span></button><div class="view-toggle" aria-label="Result view"><button type="button" data-view-mode="cards" class="${initial.view === "cards" ? "active" : ""}" aria-pressed="${initial.view === "cards"}">Detailed</button><button type="button" data-view-mode="list" class="${initial.view === "list" ? "active" : ""}" aria-pressed="${initial.view === "list"}">Compact</button></div></div></div><div class="${initial.view === "cards" ? "resource-grid" : "resource-list"}" id="browseGrid"></div>
    </section>${siteFooter()}`;
  }

  function collectionsView() {
    return `<section class="collections-page shell"><header class="page-heading"><div><span class="eyebrow">Editorial paths through the catalogue</span><h1>Curated collections</h1><p>Small reading and watching lists for a goal, discipline, or research question. Collections contain links, not new essays.</p></div></header><div class="collection-grid collection-grid-all">${collections.map(collectionCard).join("")}</div></section>${siteFooter()}`;
  }

  function collectionView(item) {
    const progress = collectionProgress(item);
    const remaining = progress.total - progress.finished;
    const allQueued = progress.queued === progress.total;
    return `<section class="collection-page shell" data-color="${item.color}" data-collection-id="${item.id}"><p class="breadcrumb"><a href="#/collections">Collections</a> / ${item.title}</p><header class="collection-hero"><div><span class="eyebrow">Guided collection · ${progress.total} resources</span><h1>${item.title}</h1><p>${item.description}</p></div><aside><div class="collection-stat-grid"><div><strong>${progress.finished}/${progress.total}</strong><span>finished</span></div><div><strong>${remaining}</strong><span>remaining</span></div><div><strong>${progress.commitment}</strong><span>estimated commitment</span></div></div><div class="collection-progress large"><span><i style="width:${progress.percent}%"></i></span><small>${progress.percent}% complete</small></div><div class="collection-actions"><button type="button" data-add-collection="${item.id}" ${allQueued ? "disabled" : ""}>${allQueued ? "All resources in queue" : "Add collection to queue"}</button>${progress.next ? `<a class="primary-action" href="#/resource/${progress.next.id}">${progress.finished === progress.total ? "Review from the beginning" : progress.queued ? "Continue collection" : "Start collection"} →</a>` : ""}</div></aside></header><div class="sequence-heading"><div><span class="eyebrow">Suggested order</span><h2>Work through the collection</h2></div><p>Status controls update your local learning queue. You can follow the order or open any resource directly.</p></div><ol class="collection-sequence">${progress.items.map((entry, index) => `<li><span>${String(index + 1).padStart(2, "0")}</span>${resourceCard(entry)}</li>`).join("")}</ol></section>${siteFooter()}`;
  }

  function resourceView(item) {
    const curated = (item.next || []).map(resource).filter(Boolean);
    const fallback = resources.filter(candidate => candidate.id !== item.id && candidate.subjects.some(subject => item.subjects.includes(subject)));
    const related = [...curated, ...fallback].filter((candidate, index, list) => list.findIndex(entry => entry.id === candidate.id) === index).slice(0, 3);
    const trust = trustState(item);
    return `<article class="resource-page shell"><p class="breadcrumb"><a href="#/browse">Browse</a> / ${item.type}</p><div class="resource-hero">${cover(item, true)}<div class="resource-intro"><div class="card-kicker"><span>${item.type}</span><span>${item.access}</span><span>${item.level}</span></div><div class="resource-trust">${trustBadge(item)}<p>${trust.detail}</p></div><h1>${item.title}</h1><p class="resource-byline">${item.creator} · ${item.publisher} · ${item.year}</p><p class="resource-description">${item.description}</p><div class="resource-actions"><a class="primary-action" href="${escapeHtml(resourceUrl(item))}" target="_blank" rel="noreferrer">Open original resource ↗</a>${queueControl(item)}<a class="source-record-control" href="${githubResourceFileUrl(item)}" target="_blank" rel="noreferrer">View source record ↗</a>${reportButton(item)}</div></div></div>
      ${embedPanel(item)}
      <div class="resource-detail-grid"><dl class="resource-metadata"><div><dt>Format</dt><dd>${item.type}</dd></div><div><dt>Time</dt><dd>${item.length}</dd></div><div><dt>Length category</dt><dd>${item.lengthClass}</dd></div><div><dt>Access</dt><dd>${item.access}</dd></div><div><dt>Level</dt><dd>${item.level}</dd></div><div><dt>Published</dt><dd>${item.year}</dd></div><div><dt>Source</dt><dd>${item.publisher}</dd></div><div><dt>Primary use</dt><dd>${item.relevance.join(" · ")}</dd></div><div><dt>Link checked</dt><dd>${checkedDate(trust.checkedAt)}</dd></div><div><dt>Link state</dt><dd>${trust.label}</dd></div></dl><section class="useful-note"><span class="eyebrow">Why it is in the index</span><h2>${item.useful}</h2><p>This is a short index annotation, not a review or a substitute for the original resource.</p></section></div>
      <section class="resource-guidance"><div class="learning-panel"><span class="eyebrow">What you will learn</span><ul>${item.learning.map(point => `<li>${point}</li>`).join("")}</ul></div><div class="audience-panel"><span class="eyebrow">Who it is for</span><p>${item.audience}</p><div class="classification-line"><span>${item.level}</span>${item.relevance.map(value => `<span>${value}</span>`).join("")}</div></div></section>
      <section class="resource-subjects"><div><span class="eyebrow">Main subjects</span><div class="topic-row large">${item.subjects.map(subject => `<a href="#/browse?subject=${encodeURIComponent(subject)}">${subject}</a>`).join("")}</div></div><div><span class="eyebrow">Detailed topics</span><div class="topic-row large">${item.topics.map(topic => `<a href="#/browse?q=${encodeURIComponent(topic)}">${topic}</a>`).join("")}</div></div>${item.games.length ? `<div><span class="eyebrow">Games and platforms</span><div class="topic-row large">${item.games.map(game => `<a href="#/browse?q=${encodeURIComponent(game)}">${game}</a>`).join("")}</div></div>` : ""}</section>
      ${related.length ? `<section class="related-section"><header class="section-header"><div><span class="eyebrow">A useful next step</span><h2>Continue exploring</h2></div></header><div class="resource-grid">${related.map(resourceCard).join("")}</div></section>` : ""}
    </article>${siteFooter()}`;
  }

  function savedView() {
    const queue = queueMap();
    const saved = savedIds().map(resource).filter(Boolean);
    const inProgress = saved.filter(item => queue[item.id]?.status === "progress").slice(0, 3);
    const visited = storage.get("gaa-library-history", []).map(resource).filter(Boolean).filter(item => !saved.some(savedItem => savedItem.id === item.id)).slice(0, 6);
    const counts = Object.fromEntries(queueStatuses.map(status => [status, saved.filter(item => queue[item.id]?.status === status).length]));
    return `<section class="saved-page shell"><header class="page-heading"><div><span class="eyebrow">Stored only in this browser</span><h1>Your learning queue</h1><p>Organize resources you want to explore, keep active material close, and mark work as finished—without creating an account.</p></div><div class="page-count"><strong id="libraryCount">${saved.length}</strong><span>saved resources</span></div></header>
      <div class="queue-summary" aria-label="Learning queue summary">${queueStatuses.map(status => `<div data-summary-status="${status}"><strong>${counts[status]}</strong><span>${queueLabels[status]}</span></div>`).join("")}</div>
      ${inProgress.length ? `<section class="saved-section continue-section"><header class="saved-section-header"><div><span class="eyebrow">Active material</span><h2>Continue where you left off</h2></div><p>Your most recently updated in-progress resources.</p></header><div class="resource-grid">${inProgress.map(resourceCard).join("")}</div></section>` : ""}
      <section class="saved-section queue-section"><header class="saved-section-header"><div><span class="eyebrow">Your local collection</span><h2>Learning queue</h2></div><div class="library-backup-actions"><button type="button" id="exportLibrary">Export backup</button><label>Import backup<input id="importLibrary" type="file" accept="application/json,.json"></label></div></header>
        ${saved.length ? `<div class="queue-toolbar" aria-label="Filter learning queue"><button type="button" class="active" data-queue-filter="all" aria-pressed="true">All <span>${saved.length}</span></button>${queueStatuses.map(status => `<button type="button" data-queue-filter="${status}" aria-pressed="false">${queueLabels[status]} <span>${counts[status]}</span></button>`).join("")}</div><p class="queue-filter-status" id="queueFilterStatus" aria-live="polite">Showing all ${saved.length} resources</p><div class="resource-grid" id="queueGrid">${saved.map(resourceCard).join("")}</div>` : `<div class="empty-state"><h3>Your learning queue is empty.</h3><p>Save any resource to add it as “Want to explore.”</p><a href="#/browse">Browse the index →</a></div>`}
      </section>
      ${visited.length ? `<section class="saved-section"><header class="saved-section-header"><div><span class="eyebrow">Not in your queue</span><h2>Recently viewed</h2></div></header><div class="resource-grid">${visited.map(resourceCard).join("")}</div></section>` : ""}
    </section>${siteFooter()}`;
  }

  function suggestView() {
    return `<section class="suggest-page shell"><header class="page-heading contribution-heading"><div><span class="eyebrow">Contribute through GitHub</span><h1>Choose the smallest useful contribution.</h1><p>The Index does not have a separate account or submission database. GitHub provides the public inbox, discussion, file history, review, and automated checks.</p></div><div class="page-count"><strong>3</strong><span>ways to contribute</span></div></header>
      <div class="contribution-options">
        <article><span class="contribution-number">01</span><div><span class="eyebrow">No code needed</span><h2>Suggest a new resource</h2><p>Open the short issue form with its original URL, creator, format, and a concrete reason it would help developers or people studying games.</p></div><a class="primary-action" href="${githubUrls.suggestions}" target="_blank" rel="noreferrer">Suggest on GitHub ↗</a></article>
        <article><span class="contribution-number">02</span><div><span class="eyebrow">No code needed</span><h2>Report an existing entry</h2><p>Use this for a broken or redirected link, incorrect description, embed or thumbnail failure, duplicate, or other factual problem.</p></div><a href="${githubUrls.problems}" target="_blank" rel="noreferrer">Report on GitHub ↗</a></article>
        <article><span class="contribution-number">03</span><div><span class="eyebrow">Direct contribution</span><h2>Propose an exact edit</h2><p>If you already know the correction, edit the relevant JSON source file or prepare a complete change and open a pull request.</p></div><a href="${githubUrls.contributing}" target="_blank" rel="noreferrer">Read the pull-request guide ↗</a></article>
      </div>
      <div class="contribution-decision"><header><span class="eyebrow">What happens after you contribute</span><h2>GitHub records the proposal. Editorial review decides the catalogue.</h2></header><div><article><strong>1 · Issue or pull request</strong><p>Your suggestion, report, or exact edit becomes a public GitHub item that can be discussed and linked to later work.</p></article><article><strong>2 · Source verification</strong><p>A maintainer checks the original source, metadata, relevance, wording, access, and whether the material fits the Index.</p></article><article><strong>3 · Automated checks</strong><p>A pull request validates record structure, relationships, thumbnails, browser behavior, and the production build.</p></article><article><strong>4 · Merge and deployment</strong><p>Only a maintainer can merge an accepted change. Merging to <code>main</code> automatically republishes the website.</p></article></div></div>
      <div class="contribution-guidance"><section><span class="eyebrow">A useful report includes</span><h2>Enough evidence to verify the change.</h2><ul><li>The resource title or its Index page.</li><li>The original URL and what happened when you opened it.</li><li>A verified replacement link or source when one exists.</li><li>For suggestions: what the resource contains and who it helps.</li></ul></section><aside><span class="eyebrow">Accounts and permissions</span><h3>The Index itself remains account-free.</h3><p>You need a GitHub account only when creating an issue or pull request. Signing into GitHub does not give anyone publishing access; repository maintainers still review and merge changes.</p><a href="${githubUrls.issues}" target="_blank" rel="noreferrer">View open issues ↗</a><a href="${githubUrls.pulls}" target="_blank" rel="noreferrer">View pull requests ↗</a><a href="#/curator?tab=catalogue">Optional JSON preparation helper →</a></aside></div>
    </section>${siteFooter()}`;
  }

  function catalogueBuilderView() {
    const draftCount = catalogueDrafts().length;
    const optionList = values => values.map(value => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("");
    return `<section class="catalogue-builder"><header class="saved-section-header"><div><span class="eyebrow">Pull-request preparation tool</span><h2>Prepare catalogue records</h2></div><p>Create or revise records locally, run the same structural checks in the browser, then download JSON for a GitHub pull request. This tool does not publish changes by itself.</p></header>
      <div class="catalogue-builder-toolbar"><label><span>Edit a published record</span><select id="catalogueRecordSource"><option value="">Choose a record</option>${resources.map(item => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.title)}</option>`).join("")}</select></label><button type="button" id="editCatalogueRecord">Copy into editor</button><button type="button" id="newCatalogueRecord">+ New record</button><label class="catalogue-import-control">Import CSV or JSON<input id="importCatalogueRecords" type="file" accept=".csv,.json,text/csv,application/json"></label><button type="button" id="downloadCatalogueTemplate">CSV template</button></div>
      <div class="catalogue-builder-layout"><aside class="catalogue-draft-rail"><header><strong>Staged records</strong><span id="catalogueDraftCount">${draftCount}</span></header><div id="catalogueDraftList"></div></aside>
        <div class="catalogue-editor-shell"><div class="catalogue-editor-empty" id="catalogueEditorEmpty"><span class="eyebrow">Nothing selected</span><h3>Start a new record or edit an existing one.</h3><p>Imported records will also appear in the staged list.</p></div><form id="catalogueEditorForm" hidden novalidate>
          <header><div><span class="eyebrow" id="catalogueEditorMode">New catalogue record</span><h3 id="catalogueEditorTitle">Untitled record</h3></div><button type="button" id="deleteCatalogueDraft">Remove draft</button></header>
          <div class="catalogue-editor-fields"><label><span>Record ID *</span><input name="id" required placeholder="lowercase-hyphenated-id"></label><label><span>Format *</span><select name="type"><option value="">Choose</option>${optionList(types)}</select></label><label class="wide"><span>Title *</span><input name="title" required></label><label><span>Creator or author *</span><input name="creator" required></label><label><span>Publisher or channel *</span><input name="publisher" required></label><label class="wide"><span>Original URL *</span><input name="url" type="url" required placeholder="https://"></label><label><span>Year *</span><input name="year" type="number" min="1950" max="${new Date().getUTCFullYear()}"></label><label><span>Length *</span><input name="length" placeholder="60 min, 320 pages, Reference"></label><label><span>Access *</span><select name="access"><option value="">Choose</option>${optionList(accessTypes)}</select></label><label><span>Level *</span><select name="level"><option value="">Choose</option>${optionList(levels)}</select></label><label><span>Length category *</span><select name="lengthClass"><option value="">Choose</option>${optionList(lengthClasses)}</select></label><label><span>Subjects *</span><input name="subjects" list="catalogueSubjects" placeholder="Game design, History"><datalist id="catalogueSubjects">${subjects.map(value => `<option value="${escapeHtml(value)}">`).join("")}</datalist></label><label><span>Use *</span><input name="relevance" placeholder="Practical, Historical"></label><label class="wide"><span>What it is *</span><textarea name="description" rows="4" placeholder="A factual description of the contents."></textarea></label><label class="wide"><span>Why it is useful *</span><textarea name="useful" rows="3" placeholder="What a developer, student, or researcher can gain from it."></textarea></label><label class="wide"><span>Best for *</span><textarea name="audience" rows="2" placeholder="The people and situations this resource suits."></textarea></label><label><span>Topics</span><input name="topics" placeholder="level design, spatial teaching"></label><label><span>Games</span><input name="games" placeholder="Half-Life, Portal"></label><label class="wide"><span>Three learning outcomes *</span><textarea name="learning" rows="4" placeholder="One outcome per line"></textarea></label><label class="wide"><span>Three related record IDs *</span><input name="next" placeholder="record-one, record-two, record-three"></label><label class="wide"><span>Image URL</span><input name="image" type="url" placeholder="https://"></label><label><span>Link checked *</span><input name="lastChecked" type="date"></label><label><span>Added *</span><input name="addedAt" type="date"></label><label><span>Editorial status *</span><select name="editorialStatus">${optionList(data.editorialStatuses || ["draft", "reviewed", "published", "needs-rechecking"])}</select></label><label><span>Reviewed *</span><input name="editorialReviewedAt" type="date"></label><label class="wide"><span>Editorial note</span><textarea name="editorialNote" rows="2"></textarea></label><label class="catalogue-featured"><input name="featured" type="checkbox"><span>Feature this resource in general catalogue selections</span></label></div>
          <footer><button type="button" id="suggestCatalogueMetadata">Suggest missing metadata</button><span id="catalogueAutosaveStatus" role="status" aria-live="polite">Changes save automatically on this device.</span></footer>
        </form></div>
        <aside class="catalogue-quality-panel"><section><span class="eyebrow">Record check</span><div id="catalogueValidation"><p>Select a staged record to see its checks.</p></div></section><section><span class="eyebrow">Catalogue preview</span><div id="catalogueRecordPreview"><p>The reader-facing preview will appear here.</p></div></section></aside></div>
      <div class="catalogue-builder-export"><div><strong id="catalogueExportSummary">${draftCount ? `${draftCount} staged` : "No staged changes"}</strong><span>One valid draft downloads as <code>content/resources/&lt;id&gt;.json</code>. Multiple drafts download as a review bundle that can be split into record files before opening a pull request.</span></div><button type="button" id="exportUpdatedCatalogue" disabled>Download staged JSON</button></div><p class="catalogue-import-status" id="catalogueImportStatus" role="status" aria-live="polite"></p>
    </section>`;
  }

  function curatorView() {
    const maintenance = resources.map(item => ({ item, trust: trustState(item) })).sort((left, right) => left.trust.priority - right.trust.priority || String(left.trust.checkedAt).localeCompare(String(right.trust.checkedAt)));
    const attention = maintenance.filter(entry => entry.trust.key !== "working");
    const issueCount = attention.length;
    const trustCounts = Object.fromEntries(Object.keys(trustStates).map(key => [key, maintenance.filter(entry => entry.trust.key === key).length]));
    const linkGenerated = data.linkStatus?.generatedAt ? checkedDate(data.linkStatus.generatedAt) : "No automated snapshot loaded";
    const curatorTabs = ["health", "catalogue", "suggestions"];
    const requestedTab = new URLSearchParams(routeSpec.split("?")[1] || "").get("tab");
    const rememberedTab = storage.get("gaa-curator-tab", "health");
    const activeTab = curatorTabs.includes(requestedTab) ? requestedTab : curatorTabs.includes(rememberedTab) ? rememberedTab : "health";
    const tabButton = (id, label, count) => `<button type="button" id="curator-tab-${id}" class="${activeTab === id ? "active" : ""}" role="tab" data-curator-tab="${id}" aria-controls="curator-panel-${id}" aria-selected="${activeTab === id}"><span>${label}</span><small>${count}</small></button>`;
    return `<section class="curator-page shell"><p class="breadcrumb"><a href="#/suggest">Contribute</a> / Editorial workspace</p><header class="curator-heading"><div><span class="eyebrow">GitHub-backed editorial workflow</span><h1>Maintain the public catalogue.</h1><p>Use the deployed link-health snapshot to find problems, prepare structured record files in the browser, and send every lasting change through a reviewed GitHub pull request.</p></div><div class="page-count"><strong>${issueCount}</strong><span>resources need attention</span></div></header>
      <nav class="curator-tabs" role="tablist" aria-label="Catalogue maintenance sections">${tabButton("health", "Link health", issueCount)}${tabButton("catalogue", "Prepare records", catalogueDrafts().length)}${tabButton("suggestions", "GitHub workflow", "4 steps")}</nav>
      <div class="curator-tab-panel" id="curator-panel-health" role="tabpanel" aria-labelledby="curator-tab-health" data-curator-panel="health" ${activeTab === "health" ? "" : "hidden"}><section class="maintenance-dashboard"><header><div><span class="eyebrow">Published verification snapshot</span><h2>What needs checking first</h2><p>Latest automated snapshot: ${linkGenerated}. The list below reflects deployed catalogue data. Report findings on GitHub so they are visible, reviewable, and connected to the eventual fix.</p></div><div class="maintenance-actions"><a href="${githubUrls.problems}" target="_blank" rel="noreferrer">Report a problem ↗</a><a href="${githubUrls.actions}" target="_blank" rel="noreferrer">View automated checks ↗</a><a href="${assetHref("/link-status.json")}" target="_blank" rel="noreferrer">Open snapshot JSON ↗</a></div></header><div class="maintenance-stats">${Object.entries(trustStates).map(([key, state]) => `<div data-trust="${key}"><strong>${trustCounts[key]}</strong><span>${state.label}</span></div>`).join("")}<div><strong>${issueCount}</strong><span>needs attention</span></div></div><div class="maintenance-list">${attention.length ? attention.map(entry => `<article data-maintenance-resource="${entry.item.id}"><div class="maintenance-state">${trustBadge(entry.item)}</div><strong>${entry.item.title}</strong><small>${entry.item.creator} · Last verified ${checkedDate(entry.trust.checkedAt)}</small><div class="maintenance-row-actions"><a href="${escapeHtml(resourceUrl(entry.item))}" target="_blank" rel="noreferrer">Open source ↗</a><a href="${githubResourceFileUrl(entry.item)}" target="_blank" rel="noreferrer">View record ↗</a><a href="${githubProblemUrl(entry.item)}" target="_blank" rel="noreferrer">Report ↗</a></div></article>`).join("") : `<div class="empty-state"><h3>No maintenance alerts.</h3><p>Every resource in the latest deployed snapshot is currently classified as working.</p></div>`}</div></section></div>
      <div class="curator-tab-panel" id="curator-panel-catalogue" role="tabpanel" aria-labelledby="curator-tab-catalogue" data-curator-panel="catalogue" ${activeTab === "catalogue" ? "" : "hidden"}>${catalogueBuilderView()}</div>
      <div class="curator-tab-panel" id="curator-panel-suggestions" role="tabpanel" aria-labelledby="curator-tab-suggestions" data-curator-panel="suggestions" ${activeTab === "suggestions" ? "" : "hidden"}><section class="github-workflow"><header><span class="eyebrow">One public source of truth</span><h2>How a change reaches the Index</h2><p>GitHub holds the catalogue, discussion, review history, and deployment checks. Local browser drafts are only preparation material until their JSON is included in a pull request.</p></header><ol><li><span>01</span><div><strong>Open an issue</strong><p>Use a structured resource suggestion or problem report so the idea can be checked before anyone edits the catalogue.</p></div></li><li><span>02</span><div><strong>Verify the source</strong><p>Confirm the original URL, creator, publisher, format, access, length, metadata, and why the resource is useful.</p></div></li><li><span>03</span><div><strong>Open a pull request</strong><p>Add or update one file in <code>content/resources/</code>. Automated validation checks the catalogue, thumbnails, links, and reader interface.</p></div></li><li><span>04</span><div><strong>Review, merge, deploy</strong><p>After editorial review, merging to <code>main</code> rebuilds the catalogue and publishes the GitHub Pages site.</p></div></li></ol><div class="github-workflow-actions"><a class="primary-action" href="${githubUrls.suggestions}" target="_blank" rel="noreferrer">Suggest a resource ↗</a><a href="${githubUrls.problems}" target="_blank" rel="noreferrer">Report a problem ↗</a><a href="${githubUrls.pulls}" target="_blank" rel="noreferrer">View pull requests ↗</a><a href="${githubUrls.contributing}" target="_blank" rel="noreferrer">Contribution guide ↗</a></div></section></div>
    </section>${siteFooter()}`;
  }

  function aboutView() {
    return `<section class="about-page shell"><header class="page-heading"><div><span class="eyebrow">About the index</span><h1>A map to existing knowledge—not another authority.</h1><p>The index helps people locate useful work by developers, researchers, authors, archivists, and educators.</p></div></header><div class="about-grid"><section><span>01</span><h2>What is indexed</h2><p>Talks, books, articles, papers, guides, documentation, courses, interviews, and archives related to making, studying, and preserving digital games.</p></section><section><span>02</span><h2>What each record explains</h2><p>What the resource is, why it may be useful, what it teaches, who it suits, how much time it needs, how it can be accessed, and what to explore afterward.</p></section><section><span>03</span><h2>How records are classified</h2><p>A controlled set of formats, broad subjects, experience levels, access types, length categories, and practical, historical, or theoretical uses supports consistent filtering.</p></section><section><span>04</span><h2>What it does not claim</h2><p>Inclusion is not a guarantee that every argument is correct. Annotations are not reviews, summaries are not replacements, and external resources remain responsible for their content.</p></section></div><div class="editorial-note"><span class="eyebrow">Public catalogue</span><p>The index currently contains ${resources.length} English-language records. It favors durable educational and historical material over news, product promotion, and release coverage. Suggestions and corrections are reviewed in the public GitHub repository.</p></div></section>${siteFooter()}`;
  }

  function normalizeInternalLinks(root = document) {
    root.querySelectorAll('a[href^="#/"]').forEach(link => {
      const route = link.getAttribute("href").slice(1);
      link.dataset.indexRoute = route;
      link.setAttribute("href", routeHref(route));
    });
    root.querySelectorAll("a[data-index-route]").forEach(link => link.setAttribute("href", routeHref(link.dataset.indexRoute || "/")));
  }

  function render() {
    if (!syncShell()) return;
    const route = routeSpec.split("?")[0] || "/";
    const resourceId = route.match(/^\/resource\/([^/]+)$/)?.[1];
    const collectionId = route.match(/^\/collection\/([^/]+)$/)?.[1];
    try {
      if (resourceId && resource(resourceId)) content.innerHTML = resourceView(resource(resourceId));
      else if (collectionId && collection(collectionId)) content.innerHTML = collectionView(collection(collectionId));
      else if (route === "/browse") content.innerHTML = browseView();
      else if (route === "/collections") content.innerHTML = collectionsView();
      else if (route === "/saved") content.innerHTML = savedView();
      else if (route === "/suggest") content.innerHTML = suggestView();
      else if (route === "/curator") content.innerHTML = curatorView();
      else if (route === "/about") content.innerHTML = aboutView();
      else content.innerHTML = homeView();
    } catch (error) {
      console.error("The resource index could not render", route, error);
      content.innerHTML = `<section class="runtime-error shell"><span class="eyebrow">Page error</span><h1>This page could not be displayed.</h1><p><a href="#/">Return to the index homepage →</a></p></section>`;
    }
    normalizeInternalLinks();
    document.body.dataset.view = route;
    document.body.classList.remove("filters-open");
    document.title = resourceId && resource(resourceId) ? `${resource(resourceId).title} — Games as Art Index` : collectionId && collection(collectionId) ? `${collection(collectionId).title} — Games as Art Index` : route === "/browse" ? "Browse — Games as Art Index" : route === "/collections" ? "Collections — Games as Art Index" : route === "/saved" ? "Saved — Games as Art Index" : route === "/suggest" ? "Contribute — Games as Art Index" : route === "/curator" ? "Editorial workspace — Games as Art Index" : route === "/about" ? "About — Games as Art Index" : "Games as Art Index — Game development, history, and criticism";
    menu.classList.remove("open");
    menuButton.setAttribute("aria-expanded", "false");
    window.scrollTo(0, 0);
    if (route === "/browse") setupBrowse();
    if (route === "/saved") setupSaved();
    if (collectionId && collection(collectionId)) setupCollection(collection(collectionId));
    if (route === "/") setupHome();
    if (route === "/curator") setupCurator();
    if (resourceId && resource(resourceId)) rememberResource(resourceId);
    normalizeInternalLinks();
  }

  function navigate(nextRoute, { replace = false } = {}) {
    const next = nextRoute || "/";
    routeSpec = next;
    history[replace ? "replaceState" : "pushState"]({ gaaRoute: routeSpec, gaaLibraryRoute: true }, "", routeHref(next));
    render();
  }

  function rememberResource(id) {
    const historyItems = storage.get("gaa-library-history", []).filter(item => item !== id);
    historyItems.unshift(id);
    storage.set("gaa-library-history", historyItems.slice(0, 20));
  }

  function setupBrowse() {
    const query = document.querySelector("#browseQuery");
    const type = document.querySelector("#filterType");
    const subject = document.querySelector("#filterSubject");
    const access = document.querySelector("#filterAccess");
    const level = document.querySelector("#filterLevel");
    const length = document.querySelector("#filterLength");
    const relevance = document.querySelector("#filterRelevance");
    const trust = document.querySelector("#filterTrust");
    const sort = document.querySelector("#filterSort");
    const grid = document.querySelector("#browseGrid");
    const status = document.querySelector("#browseStatus");
    const clear = document.querySelector("#clearFilters");
    const active = document.querySelector("#activeFilters");
    const related = document.querySelector("#searchRelated");
    const filterPanel = document.querySelector("#filterPanel");
    const filterToggle = document.querySelector("#filterToggle");
    const filterCount = document.querySelector("#filterCount");
    const closeFilters = document.querySelector("#closeFilters");
    const viewButtons = [...document.querySelectorAll("[data-view-mode]")];
    const stickyFilterTrigger = document.querySelector("[data-open-filters]");
    if (!query || !grid || !status || !active || !related) return;

    const controls = { q: query, type, subject, level, access, length, relevance, trust, sort };
    const defaults = { q: "", type: "all", subject: "all", level: "all", access: "all", length: "all", relevance: "all", trust: "all", sort: "recommended", view: "cards" };
    const labels = { q: "Search", type: "Format", subject: "Subject", level: "Level", access: "Access", length: "Length", relevance: "Use", trust: "Link state", sort: "Sort" };
    let viewMode = viewButtons.find(button => button.classList.contains("active"))?.dataset.viewMode || "cards";
    let visibleCount = 24;
    const values = () => ({ ...Object.fromEntries(Object.entries(controls).map(([key, control]) => [key, control?.value || defaults[key]])), view: viewMode });
    const structuredFilterCount = state => ["type", "subject", "level", "access", "length", "relevance", "trust", "sort"].filter(key => state[key] !== defaults[key]).length;
    const setFilterPanel = open => {
      filterPanel?.classList.toggle("open", open);
      filterToggle?.setAttribute("aria-expanded", String(open));
      document.body.classList.toggle("filters-open", open);
      if (open) setTimeout(() => closeFilters?.focus(), 0);
    };
    const syncBrowseUrl = (state, mode) => {
      const params = new URLSearchParams();
      Object.entries(state).forEach(([key, value]) => { if (value && value !== defaults[key]) params.set(key, value.trim ? value.trim() : value); });
      const nextRoute = `/browse${params.size ? `?${params.toString()}` : ""}`;
      if (nextRoute === routeSpec) return;
      routeSpec = nextRoute;
      history[mode === "push" ? "pushState" : "replaceState"]({ gaaRoute: routeSpec, gaaLibraryRoute: true }, "", routeHref(routeSpec));
    };
    const renderChips = state => {
      const chips = Object.entries(state).filter(([key, value]) => key !== "view" && value && value !== defaults[key]);
      active.innerHTML = chips.length ? `<span>Active</span>${chips.map(([key, value]) => `<button type="button" data-clear-filter="${key}">${labels[key]}: <strong>${escapeHtml(value)}</strong> ×</button>`).join("")}${chips.length > 1 ? `<button class="clear-filter-chips" type="button" data-clear-all>Clear all</button>` : ""}` : "";
      const count = structuredFilterCount(state);
      if (filterCount) filterCount.textContent = String(count);
      filterToggle?.classList.toggle("has-filters", count > 0);
    };
    const renderRelated = state => {
      const suggestions = relatedTermsFor(state.q);
      related.innerHTML = suggestions.length ? `<span>Related searches</span>${suggestions.map(value => `<button type="button" data-related-query="${escapeHtml(value)}">${escapeHtml(value)}</button>`).join("")}` : "";
      return suggestions;
    };
    const clearStructuredFilters = () => {
      [type, subject, level, access, length, relevance, trust].forEach(control => { control.value = "all"; });
      sort.value = "recommended";
    };
    const draw = ({ sync = true, mode = "replace" } = {}) => {
      const state = values();
      const term = state.q.trim();
      let matches = resources.map(item => ({ item, score: searchScore(item, term) })).filter(({ item, score }) => score > 0 && (state.type === "all" || item.type === state.type) && (state.subject === "all" || item.subjects.includes(state.subject)) && (state.access === "all" || item.access === state.access) && (state.level === "all" || item.level === state.level) && (state.length === "all" || item.lengthClass === state.length) && (state.relevance === "all" || item.relevance.includes(state.relevance)) && (state.trust === "all" || trustState(item).key === state.trust));
      const original = (a, b) => resourceOrder.get(a.item.id) - resourceOrder.get(b.item.id);
      const byTitle = (a, b) => a.item.title.localeCompare(b.item.title);
      if (state.sort === "recommended") matches.sort(term ? (a, b) => b.score - a.score || original(a, b) : original);
      if (state.sort === "newest") matches.sort((a, b) => b.item.year - a.item.year || byTitle(a, b));
      if (state.sort === "oldest") matches.sort((a, b) => a.item.year - b.item.year || byTitle(a, b));
      if (state.sort === "title") matches.sort(byTitle);
      if (state.sort === "shortest") { const rank = { "Under 30 min": 0, "30–120 min": 1, "Long-form": 2, Reference: 3 }; matches.sort((a, b) => rank[a.item.lengthClass] - rank[b.item.lengthClass] || original(a, b)); }
      if (state.sort === "introductory") { const rank = { Introductory: 0, "All levels": 1, Intermediate: 2, Advanced: 3 }; matches.sort((a, b) => rank[a.item.level] - rank[b.item.level] || original(a, b)); }
      if (state.sort === "free") { const rank = { Free: 0, Mixed: 1, Paid: 2 }; matches.sort((a, b) => rank[a.item.access] - rank[b.item.access] || original(a, b)); }
      if (state.sort === "recently-added") matches.sort((a, b) => String(b.item.addedAt).localeCompare(String(a.item.addedAt)) || original(a, b));
      if (state.sort === "recently-verified") matches.sort((a, b) => String(b.item.lastChecked).localeCompare(String(a.item.lastChecked)) || original(a, b));

      const suggestions = renderRelated(state);
      renderChips(state);
      const shown = Math.min(visibleCount, matches.length);
      status.textContent = matches.length ? `Showing ${shown} of ${matches.length} ${matches.length === 1 ? "resource" : "resources"}` : "0 resources";
      grid.className = state.view === "list" ? "resource-list" : "resource-grid";
      viewButtons.forEach(button => { const activeView = button.dataset.viewMode === state.view; button.classList.toggle("active", activeView); button.setAttribute("aria-pressed", String(activeView)); });
      if (matches.length) {
        const visible = matches.slice(0, visibleCount).map(({ item }) => state.view === "list" ? resourceListItem(item) : resourceCard(item)).join("");
        const remaining = matches.length - shown;
        grid.innerHTML = `${visible}${remaining > 0 ? `<div class="show-more"><button type="button" data-show-more>Show ${Math.min(24, remaining)} more <span>${shown} of ${matches.length}</span></button></div>` : ""}`;
      }
      else {
        const searchOnlyCount = term ? resources.filter(item => searchScore(item, term) > 0).length : resources.length;
        const hasStructuredFilters = structuredFilterCount({ ...state, sort: "recommended" }) > 0;
        const explanation = term && searchOnlyCount && hasStructuredFilters ? `${searchOnlyCount} resources match “${escapeHtml(term)}” before the other filters are applied.` : term ? `Nothing in the catalogue closely matches “${escapeHtml(term)}”.` : "The selected filters do not overlap.";
        grid.innerHTML = `<div class="empty-state browse-empty"><span class="eyebrow">No results</span><h3>Try a wider route through the index.</h3><p>${explanation}</p><div>${hasStructuredFilters ? `<button type="button" data-empty-clear="filters">Clear filters${term ? ", keep search" : ""}</button>` : ""}${suggestions.map(value => `<button type="button" data-related-query="${escapeHtml(value)}">Search ${escapeHtml(value)}</button>`).join("")}<button type="button" data-empty-clear="all">Show the full index</button></div></div>`;
      }
      normalizeInternalLinks(grid);
      if (sync) syncBrowseUrl(state, mode);
    };

    query.addEventListener("input", () => { visibleCount = 24; draw({ mode: "replace" }); });
    [type, subject, access, level, length, relevance, trust, sort].forEach(control => control.addEventListener("change", () => { visibleCount = 24; draw({ mode: "push" }); }));
    clear.addEventListener("click", () => { query.value = ""; clearStructuredFilters(); visibleCount = 24; draw({ mode: "push" }); query.focus(); });
    active.addEventListener("click", event => {
      const chip = event.target.closest("[data-clear-filter]");
      if (chip) { const key = chip.dataset.clearFilter; controls[key].value = defaults[key]; visibleCount = 24; draw({ mode: "push" }); }
      if (event.target.closest("[data-clear-all]")) { query.value = ""; clearStructuredFilters(); visibleCount = 24; draw({ mode: "push" }); }
    });
    const useRelatedQuery = event => { const button = event.target.closest("[data-related-query]"); if (button) { query.value = button.dataset.relatedQuery; visibleCount = 24; draw({ mode: "push" }); query.focus(); } };
    related.addEventListener("click", useRelatedQuery);
    grid.addEventListener("click", event => {
      useRelatedQuery(event);
      if (event.target.closest("[data-show-more]")) { visibleCount += 24; draw({ sync: false }); }
      const clearEmpty = event.target.closest("[data-empty-clear]");
      if (clearEmpty?.dataset.emptyClear === "filters") { clearStructuredFilters(); visibleCount = 24; draw({ mode: "push" }); }
      if (clearEmpty?.dataset.emptyClear === "all") { query.value = ""; clearStructuredFilters(); visibleCount = 24; draw({ mode: "push" }); }
    });
    filterToggle?.addEventListener("click", () => setFilterPanel(!filterPanel.classList.contains("open")));
    stickyFilterTrigger?.addEventListener("click", () => setFilterPanel(true));
    closeFilters?.addEventListener("click", () => { setFilterPanel(false); filterToggle?.focus(); });
    viewButtons.forEach(button => button.addEventListener("click", () => { viewMode = button.dataset.viewMode; visibleCount = 24; storage.set("gaa-browse-view", viewMode); draw({ mode: "push" }); }));
    draw({ sync: false });
  }

  function exportLibraryBackup() {
    const queue = queueMap();
    const payload = {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      queue: savedIds().map(id => ({ id, status: queue[id].status, updatedAt: queue[id].updatedAt })),
      history: storage.get("gaa-library-history", []).filter(id => resource(id))
    };
    const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: "application/json" });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = `games-as-art-index-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(href), 0);
  }

  function setupCollection(item) {
    const addButton = document.querySelector(`[data-add-collection="${item.id}"]`);
    addButton?.addEventListener("click", () => {
      const queue = queueMap();
      const now = new Date().toISOString();
      let added = 0;
      item.resources.forEach(id => {
        if (!resource(id) || queue[id]) return;
        queue[id] = { status: "want", updatedAt: now };
        added += 1;
      });
      saveQueueMap(queue);
      toast.textContent = added ? `Added ${added} ${added === 1 ? "resource" : "resources"} to Want to explore` : "Every resource is already in your queue";
      toast.classList.add("show"); clearTimeout(window.__GAA_TOAST_TIMER__); window.__GAA_TOAST_TIMER__ = setTimeout(() => toast.classList.remove("show"), 2400);
      render();
    });
  }

  function setupHome() {
    document.querySelectorAll("[data-toggle-personalization]").forEach(button => button.addEventListener("click", () => {
      const enabling = !personalizationEnabled();
      storage.set("gaa-personalization-enabled", enabling);
      toast.textContent = enabling ? "Local suggestions enabled" : "Local suggestions turned off";
      toast.classList.add("show"); clearTimeout(window.__GAA_TOAST_TIMER__); window.__GAA_TOAST_TIMER__ = setTimeout(() => toast.classList.remove("show"), 1800);
      render();
    }));
    document.querySelector("[data-reset-personalization]")?.addEventListener("click", () => {
      storage.set("gaa-library-history", []);
      toast.textContent = "Viewing signals cleared; your learning queue was kept";
      toast.classList.add("show"); clearTimeout(window.__GAA_TOAST_TIMER__); window.__GAA_TOAST_TIMER__ = setTimeout(() => toast.classList.remove("show"), 2200);
      render();
    });
  }

  function setupSaved() {
    const grid = document.querySelector("#queueGrid");
    const status = document.querySelector("#queueFilterStatus");
    const filterButtons = [...document.querySelectorAll("[data-queue-filter]")];
    const exportButton = document.querySelector("#exportLibrary");
    const importInput = document.querySelector("#importLibrary");
    const applyFilter = filter => {
      if (!grid) return;
      const cards = [...grid.querySelectorAll("[data-resource-id]")];
      const shown = cards.filter(card => filter === "all" || card.dataset.queueState === filter);
      cards.forEach(card => { card.hidden = !shown.includes(card); });
      filterButtons.forEach(button => { const activeFilter = button.dataset.queueFilter === filter; button.classList.toggle("active", activeFilter); button.setAttribute("aria-pressed", String(activeFilter)); });
      if (status) status.textContent = filter === "all" ? `Showing all ${shown.length} resources` : `Showing ${shown.length} marked ${queueLabels[filter].toLowerCase()}`;
    };
    filterButtons.forEach(button => button.addEventListener("click", () => applyFilter(button.dataset.queueFilter)));
    exportButton?.addEventListener("click", () => {
      exportLibraryBackup();
      toast.textContent = "Index backup downloaded";
      toast.classList.add("show"); clearTimeout(window.__GAA_TOAST_TIMER__); window.__GAA_TOAST_TIMER__ = setTimeout(() => toast.classList.remove("show"), 1800);
    });
    importInput?.addEventListener("change", async () => {
      const file = importInput.files?.[0];
      if (!file) return;
      try {
        const payload = JSON.parse(await file.text());
        if (!Array.isArray(payload.queue) || !Array.isArray(payload.history)) throw new Error("This is not a Games as Art Index backup.");
        const merged = queueMap();
        let imported = 0;
        payload.queue.forEach(entry => {
          if (!resource(entry?.id) || !queueStatuses.includes(entry?.status)) return;
          merged[entry.id] = { status: entry.status, updatedAt: entry.updatedAt || new Date().toISOString() };
          imported += 1;
        });
        saveQueueMap(merged);
        const currentHistory = storage.get("gaa-library-history", []);
        const importedHistory = payload.history.filter(id => resource(id));
        storage.set("gaa-library-history", [...new Set([...importedHistory, ...currentHistory])].slice(0, 20));
        toast.textContent = `Imported ${imported} queue ${imported === 1 ? "item" : "items"}`;
        toast.classList.add("show"); clearTimeout(window.__GAA_TOAST_TIMER__); window.__GAA_TOAST_TIMER__ = setTimeout(() => toast.classList.remove("show"), 2200);
        render();
      } catch (error) {
        importInput.value = "";
        toast.textContent = error.message || "The backup could not be imported";
        toast.classList.add("show"); clearTimeout(window.__GAA_TOAST_TIMER__); window.__GAA_TOAST_TIMER__ = setTimeout(() => toast.classList.remove("show"), 2600);
      }
    });
  }

  function exportSuggestions(items, label = "all") {
    const payload = JSON.stringify({ exportedAt: new Date().toISOString(), count: items.length, suggestions: items }, null, 2);
    const blob = new Blob([`${payload}\n`], { type: "application/json" });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = `games-as-art-index-suggestions-${label}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(href), 0);
  }

  function exportProblemReports() {
    const reports = problemReports();
    const payload = JSON.stringify({ exportedAt: new Date().toISOString(), count: reports.length, reports }, null, 2);
    const blob = new Blob([`${payload}\n`], { type: "application/json" });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = `games-as-art-index-problem-reports-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(href), 0);
  }

  function exportLinkReviews() {
    const reviews = Object.entries(linkReviews()).map(([resourceId, review]) => {
      const item = resource(resourceId);
      return { resourceId, title: item?.title || resourceId, originalUrl: item?.url || "", ...review };
    });
    const payload = JSON.stringify({ exportedAt: new Date().toISOString(), count: reviews.length, reviews }, null, 2);
    const blob = new Blob([`${payload}\n`], { type: "application/json" });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = `games-as-art-index-link-reviews-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(href), 0);
  }

  function stageReviewedLink(item, url, note) {
    const drafts = catalogueDrafts();
    const today = new Date().toISOString().slice(0, 10);
    const now = new Date().toISOString();
    const existing = drafts.find(draft => draft.baseId === item.id);
    if (existing) {
      existing.record.url = url;
      existing.record.lastChecked = today;
      existing.record.editorial = { ...existing.record.editorial, reviewedAt: today, note: note || existing.record.editorial?.note || "" };
      existing.updatedAt = now;
    } else {
      const record = JSON.parse(JSON.stringify(item));
      record.url = url;
      record.lastChecked = today;
      record.editorial = { ...record.editorial, reviewedAt: today, note: note || record.editorial?.note || "" };
      drafts.unshift({ draftId: `catalogue-draft-${Date.now().toString(36)}-link`, baseId: item.id, source: "link-review", record, updatedAt: now });
    }
    saveCatalogueDrafts(drafts);
  }

  function setupSuggestionForm() {
    const form = document.querySelector("#suggestionForm");
    const status = document.querySelector("#suggestionStatus");
    const count = document.querySelector("#suggestionCount");
    const clearDraft = document.querySelector("#clearSuggestionDraft");
    if (!form || !status) return;
    const fields = [...form.querySelectorAll("[name]")];
    const controlValue = control => control.value ?? control.querySelector?.("option[selected]")?.value ?? "";
    const readDraft = () => Object.fromEntries(fields.map(control => [control.name, String(controlValue(control)).trim()]));
    const resetForm = () => { if (typeof form.reset === "function") form.reset(); else fields.forEach(control => { if (control.tagName === "SELECT") control.querySelectorAll("option").forEach((option, index) => option.toggleAttribute("selected", index === 0)); else control.value = ""; }); };
    const savedDraft = storage.get("gaa-suggestion-draft", {});
    fields.forEach(control => { if (savedDraft?.[control.name]) { control.value = savedDraft[control.name]; control.querySelectorAll?.("option").forEach(option => option.toggleAttribute("selected", option.value === savedDraft[control.name])); } });
    form.addEventListener("input", () => { storage.set("gaa-suggestion-draft", readDraft()); status.textContent = "Draft saved on this device."; });
    clearDraft?.addEventListener("click", () => { resetForm(); storage.set("gaa-suggestion-draft", null); status.textContent = "Draft cleared."; form.querySelector('[name="title"]')?.focus(); });
    form.addEventListener("submit", event => {
      event.preventDefault();
      const draft = readDraft();
      try { const parsed = new URL(draft.url); if (!/^https?:$/.test(parsed.protocol)) throw new Error("Unsupported URL"); } catch { status.textContent = "Enter a complete original URL beginning with http or https."; form.querySelector('[name="url"]')?.focus(); return; }
      const queue = suggestionQueue();
      if (resources.some(item => item.url === draft.url) || queue.some(item => item.url === draft.url)) { status.textContent = "That URL is already in the catalogue or this review queue."; return; }
      queue.unshift({ id: `suggestion-${Date.now().toString(36)}`, ...draft, keywords: draft.keywords.split(",").map(value => value.trim()).filter(Boolean), status: "draft", submittedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
      saveSuggestionQueue(queue);
      storage.set("gaa-suggestion-draft", null);
      resetForm();
      if (count) count.textContent = String(queue.length);
      document.querySelectorAll("[data-export-suggestions]").forEach(button => { button.disabled = false; });
      status.innerHTML = `Suggestion saved locally. <a href="#/curator">Review it in the curator workbench →</a>`;
    });
    document.querySelectorAll("[data-export-suggestions]").forEach(button => button.addEventListener("click", () => exportSuggestions(suggestionQueue())));
  }

  function setupCatalogueBuilder() {
    const form = document.querySelector("#catalogueEditorForm");
    const empty = document.querySelector("#catalogueEditorEmpty");
    const list = document.querySelector("#catalogueDraftList");
    const draftCount = document.querySelector("#catalogueDraftCount");
    const validation = document.querySelector("#catalogueValidation");
    const preview = document.querySelector("#catalogueRecordPreview");
    const exportButton = document.querySelector("#exportUpdatedCatalogue");
    const exportSummary = document.querySelector("#catalogueExportSummary");
    const importInput = document.querySelector("#importCatalogueRecords");
    const importStatus = document.querySelector("#catalogueImportStatus");
    if (!form || !list || !validation || !preview) return;

    const today = new Date().toISOString().slice(0, 10);
    const publishedById = new Map(resources.map(item => [item.id, item]));
    const clone = value => JSON.parse(JSON.stringify(value));
    const normalizeUrl = value => String(value || "").trim().replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, "").toLowerCase();
    const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value || "") && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
    const splitValues = value => Array.isArray(value) ? value.map(entry => String(entry).trim()).filter(Boolean) : String(value || "").split(/\s*(?:,|\||\r?\n)\s*/).filter(Boolean);
    const splitLines = value => Array.isArray(value) ? value.map(entry => String(entry).trim()).filter(Boolean) : String(value || "").split(/\r?\n|\s*\|\s*/).map(entry => entry.trim()).filter(Boolean);
    const slugify = value => normalizeSearch(value).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70);
    const inferMetadata = candidate => {
      const haystack = normalizeSearch([candidate.title, candidate.description, candidate.useful, candidate.url, ...(candidate.topics || [])].join(" "));
      let subject = "Game design";
      if (/accessib|inclusive|disabil|barrier/.test(haystack)) subject = "Accessibility";
      else if (/history|archive|preserv|postmortem|museum/.test(haystack)) subject = "History";
      else if (/critic|theory|philosoph|aesthetic|meaning|art form/.test(haystack)) subject = "Criticism & theory";
      else if (/audio|sound|music|composer/.test(haystack)) subject = "Audio";
      else if (/narrative|story|writing|dialogue|character/.test(haystack)) subject = "Narrative";
      else if (/animation|visual|art direction|concept art|modeling|lighting/.test(haystack)) subject = "Visual art";
      else if (/program|code|shader|render|network|engine|architecture/.test(haystack)) subject = "Programming";
      else if (/production|team|scope|project management|workflow/.test(haystack)) subject = "Production";
      let type = "Article";
      if (/youtube|youtu be|gdc|talk|lecture|keynote|conference/.test(haystack)) type = "Talk";
      else if (/book|isbn|press/.test(haystack)) type = "Book";
      else if (/paper|journal|proceedings|arxiv|doi|\.pdf/.test(haystack)) type = "Paper";
      else if (/documentation|\bdocs\b|manual|reference/.test(haystack)) type = "Documentation";
      else if (/course|class|curriculum|tutorial series/.test(haystack)) type = "Course";
      else if (/archive|collection|repository/.test(haystack)) type = "Archive";
      const level = /beginner|introduct|fundament|getting started|first/.test(haystack) ? "Introductory" : /advanced|deep dive|expert|low level/.test(haystack) ? "Advanced" : "All levels";
      return { subject, type: types.includes(type) ? type : types[0], level };
    };
    const inferLengthClass = value => {
      const text = String(value || "").toLowerCase();
      const minutes = Number(text.match(/(\d+)\s*min/)?.[1]);
      if (minutes && minutes < 30) return "Under 30 min";
      if (minutes && minutes <= 120) return "30–120 min";
      if (/reference|documentation|archive/.test(text)) return "Reference";
      return "Long-form";
    };
    const recordFrom = candidate => {
      const editorial = candidate.editorial || {};
      const topicsValue = candidate.topics?.length ? candidate.topics : candidate.keywords;
      const subjectsValue = candidate.subjects?.length ? candidate.subjects : candidate.subject;
      const inferred = inferMetadata({ ...candidate, topics: splitValues(topicsValue) });
      const length = String(candidate.length || "").trim();
      return {
        id: String(candidate.id || slugify(candidate.title)).trim(),
        type: String(candidate.type || inferred.type).trim(),
        title: String(candidate.title || "").trim(),
        creator: String(candidate.creator || "").trim(),
        publisher: String(candidate.publisher || "").trim(),
        year: Number(candidate.year) || new Date().getUTCFullYear(),
        length,
        access: String(candidate.access || "Free").trim(),
        level: String(candidate.level || inferred.level).trim(),
        topics: splitValues(topicsValue),
        games: splitValues(candidate.games),
        description: String(candidate.description || "").trim(),
        useful: String(candidate.useful || "").trim(),
        url: String(candidate.url || "").trim(),
        image: String(candidate.image || "").trim(),
        featured: candidate.featured === true || String(candidate.featured).toLowerCase() === "true",
        subjects: splitValues(subjectsValue).length ? splitValues(subjectsValue) : [inferred.subject],
        lengthClass: String(candidate.lengthClass || inferLengthClass(length)).trim(),
        relevance: splitValues(candidate.relevance).length ? splitValues(candidate.relevance) : ["Practical"],
        audience: String(candidate.audience || "").trim(),
        learning: splitLines(candidate.learning),
        next: splitValues(candidate.next),
        lastChecked: String(candidate.lastChecked || today).slice(0, 10),
        addedAt: String(candidate.addedAt || today).slice(0, 10),
        editorial: {
          status: String(editorial.status || candidate.editorialStatus || "draft"),
          reviewedAt: String(editorial.reviewedAt || candidate.editorialReviewedAt || today).slice(0, 10),
          note: String(editorial.note || candidate.editorialNote || "")
        }
      };
    };
    const makeDraft = (candidate = {}, baseId = null, source = "manual") => ({
      draftId: `catalogue-draft-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      baseId,
      source,
      record: recordFrom(candidate),
      updatedAt: new Date().toISOString()
    });
    let drafts = catalogueDrafts().filter(draft => draft?.draftId && draft?.record).map(draft => ({ ...draft, record: recordFrom(draft.record) }));
    let activeId = drafts[0]?.draftId || null;

    const finalIds = () => new Set([...resources.map(item => item.id), ...drafts.map(draft => draft.record.id).filter(Boolean)]);
    const validateDraft = draft => {
      const item = draft.record;
      const errors = [];
      const warnings = [];
      const required = ["id", "type", "title", "creator", "publisher", "length", "access", "level", "description", "useful", "url", "lengthClass", "audience", "lastChecked", "addedAt"];
      required.forEach(field => { if (!String(item[field] ?? "").trim()) errors.push(`${field} is required.`); });
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.id || "")) errors.push("Record ID must use lowercase words separated by hyphens.");
      if (draft.baseId && item.id !== draft.baseId) errors.push("The ID of a published record cannot be changed because collections may reference it.");
      const otherPublished = resources.filter(entry => entry.id !== draft.baseId);
      const otherDrafts = drafts.filter(entry => entry.draftId !== draft.draftId);
      if (otherPublished.some(entry => entry.id === item.id) || otherDrafts.some(entry => entry.record.id === item.id)) errors.push("Record ID is already used.");
      try { const parsed = new URL(item.url); if (!/^https?:$/.test(parsed.protocol)) throw new Error(); } catch { errors.push("Original URL must be a complete HTTP or HTTPS address."); }
      if (item.image) { try { const parsed = new URL(item.image); if (!/^https?:$/.test(parsed.protocol)) throw new Error(); } catch { errors.push("Image URL must be a complete HTTP or HTTPS address."); } }
      const url = normalizeUrl(item.url);
      const duplicateUrl = otherPublished.find(entry => normalizeUrl(entry.url) === url) || otherDrafts.find(entry => normalizeUrl(entry.record.url) === url)?.record;
      if (url && duplicateUrl) errors.push(`URL duplicates “${duplicateUrl.title}”.`);
      const title = normalizeSearch(item.title);
      const duplicateTitle = otherPublished.find(entry => normalizeSearch(entry.title) === title) || otherDrafts.find(entry => normalizeSearch(entry.record.title) === title)?.record;
      if (title && duplicateTitle) errors.push(`Title duplicates “${duplicateTitle.title}”.`);
      if (!duplicateTitle && title.length > 7) {
        const closeTitle = otherPublished.find(entry => { const compared = normalizeSearch(entry.title); return Math.abs(compared.length - title.length) <= 3 && editDistance(compared, title) <= 3; });
        if (closeTitle) warnings.push(`Title is similar to “${closeTitle.title}”; check that this is a different resource.`);
      }
      if (!Number.isInteger(item.year) || item.year < 1950 || item.year > new Date().getUTCFullYear()) errors.push("Year is outside the accepted range.");
      if (!types.includes(item.type)) errors.push("Format is not in the catalogue taxonomy.");
      if (!accessTypes.includes(item.access)) errors.push("Access is not in the catalogue taxonomy.");
      if (!levels.includes(item.level)) errors.push("Level is not in the catalogue taxonomy.");
      if (!lengthClasses.includes(item.lengthClass)) errors.push("Length category is not in the catalogue taxonomy.");
      if (!item.subjects.length) errors.push("At least one subject is required.");
      item.subjects.filter(value => !subjects.includes(value)).forEach(value => errors.push(`Unknown subject: ${value}.`));
      if (!item.relevance.length) errors.push("At least one use is required.");
      item.relevance.filter(value => !relevanceTypes.includes(value)).forEach(value => errors.push(`Unknown use: ${value}.`));
      if (item.learning.length !== 3) errors.push("Add exactly three learning outcomes.");
      if (item.next.length !== 3) errors.push("Add exactly three related record IDs.");
      item.next.filter(id => !finalIds().has(id)).forEach(id => errors.push(`Related record does not exist: ${id}.`));
      if (item.next.includes(item.id)) errors.push("A resource cannot relate to itself.");
      if (!validDate(item.lastChecked)) errors.push("Link checked date is invalid.");
      if (!validDate(item.addedAt)) errors.push("Added date is invalid.");
      if (!(data.editorialStatuses || []).includes(item.editorial.status)) errors.push("Editorial status is invalid.");
      if (!validDate(item.editorial.reviewedAt)) errors.push("Reviewed date is invalid.");
      if (item.description.length > 0 && item.description.length < 80) warnings.push("Description is unusually short; aim for at least 80 characters.");
      if (item.useful.length > 0 && item.useful.length < 45) warnings.push("Usefulness note is unusually short; aim for at least 45 characters.");
      return { errors: [...new Set(errors)], warnings: [...new Set(warnings)] };
    };
    const setControl = (name, value) => {
      const control = form.querySelector(`[name="${name}"]`);
      if (!control) return;
      if (control.type === "checkbox") control.checked = Boolean(value);
      else {
        control.value = value ?? "";
        control.querySelectorAll?.("option").forEach(option => option.toggleAttribute("selected", option.value === String(value ?? "")));
      }
    };
    const fillForm = item => {
      Object.entries(item).forEach(([name, value]) => {
        if (Array.isArray(value)) setControl(name, name === "learning" ? value.join("\n") : value.join(", "));
        else if (name !== "editorial") setControl(name, value);
      });
      setControl("editorialStatus", item.editorial.status);
      setControl("editorialReviewedAt", item.editorial.reviewedAt);
      setControl("editorialNote", item.editorial.note);
    };
    const valueOf = name => {
      const control = form.querySelector(`[name="${name}"]`);
      if (!control) return "";
      return control.type === "checkbox" ? control.checked : String(control.value ?? "").trim();
    };
    const readForm = () => recordFrom({
      id: valueOf("id"), type: valueOf("type"), title: valueOf("title"), creator: valueOf("creator"), publisher: valueOf("publisher"), url: valueOf("url"), year: valueOf("year"), length: valueOf("length"), access: valueOf("access"), level: valueOf("level"), lengthClass: valueOf("lengthClass"), subjects: splitValues(valueOf("subjects")), relevance: splitValues(valueOf("relevance")), description: valueOf("description"), useful: valueOf("useful"), audience: valueOf("audience"), topics: splitValues(valueOf("topics")), games: splitValues(valueOf("games")), learning: splitLines(valueOf("learning")), next: splitValues(valueOf("next")), image: valueOf("image"), featured: valueOf("featured"), lastChecked: valueOf("lastChecked"), addedAt: valueOf("addedAt"), editorialStatus: valueOf("editorialStatus"), editorialReviewedAt: valueOf("editorialReviewedAt"), editorialNote: valueOf("editorialNote")
    });
    const renderPreview = item => {
      const initials = item.title ? item.title.split(/\s+/).slice(0, 2).map(word => word[0]).join("").toUpperCase() : "—";
      const previewImage = thumbnailUrl(item);
      preview.innerHTML = `<article class="catalogue-record-preview"><div class="catalogue-preview-cover">${previewImage ? `<img src="${escapeHtml(previewImage)}" alt="" referrerpolicy="no-referrer" onerror="this.remove()">` : ""}<span>${escapeHtml(item.type || "Format")}</span><strong>${escapeHtml(initials)}</strong><small>${item.year || "Year"}</small></div><div><span>${escapeHtml(item.access || "Access")} · ${escapeHtml(item.length || "Length")}</span><h4>${escapeHtml(item.title || "Untitled record")}</h4><small>${escapeHtml(item.creator || "Creator")}</small><p>${escapeHtml(item.description || "A factual description will appear here.")}</p><strong>Best for</strong><p>${escapeHtml(item.audience || "Add the intended audience.")}</p><div>${item.subjects.map(value => `<span>${escapeHtml(value)}</span>`).join("")}</div></div></article>`;
    };
    const renderValidation = result => {
      validation.innerHTML = result.errors.length || result.warnings.length ? `${result.errors.length ? `<div class="catalogue-check-errors"><strong>${result.errors.length} ${result.errors.length === 1 ? "error" : "errors"}</strong><ul>${result.errors.map(message => `<li>${escapeHtml(message)}</li>`).join("")}</ul></div>` : `<p class="catalogue-check-pass">No blocking errors.</p>`}${result.warnings.length ? `<div class="catalogue-check-warnings"><strong>${result.warnings.length} ${result.warnings.length === 1 ? "warning" : "warnings"}</strong><ul>${result.warnings.map(message => `<li>${escapeHtml(message)}</li>`).join("")}</ul></div>` : ""}` : `<p class="catalogue-check-pass">Ready to export. All required metadata and categories are valid.</p>`;
    };
    const updateExportState = () => {
      const invalid = drafts.filter(draft => validateDraft(draft).errors.length);
      if (draftCount) draftCount.textContent = String(drafts.length);
      if (exportSummary) exportSummary.textContent = !drafts.length ? "No staged changes" : invalid.length ? `${drafts.length} staged · ${invalid.length} need work` : `${drafts.length} staged · ready to export`;
      if (exportButton) exportButton.disabled = !drafts.length || Boolean(invalid.length);
    };
    const save = () => { saveCatalogueDrafts(drafts); updateExportState(); };
    const drawList = () => {
      list.innerHTML = drafts.length ? drafts.map(draft => { const check = validateDraft(draft); return `<button type="button" class="${draft.draftId === activeId ? "active" : ""}" data-catalogue-draft="${escapeHtml(draft.draftId)}"><span>${draft.baseId ? "Edit" : "New"}</span><strong>${escapeHtml(draft.record.title || "Untitled record")}</strong><small>${check.errors.length ? `${check.errors.length} to fix` : check.warnings.length ? `${check.warnings.length} warnings` : "Ready"}</small></button>`; }).join("") : `<div class="catalogue-draft-empty"><p>No staged records yet.</p></div>`;
      updateExportState();
    };
    const showActive = () => {
      const draft = drafts.find(entry => entry.draftId === activeId);
      form.hidden = !draft;
      empty.hidden = Boolean(draft);
      if (!draft) { validation.innerHTML = "<p>Select a staged record to see its checks.</p>"; preview.innerHTML = "<p>The reader-facing preview will appear here.</p>"; return; }
      fillForm(draft.record);
      document.querySelector("#catalogueEditorMode").textContent = draft.baseId ? "Editing a published record" : draft.source === "import" ? "Imported record" : "New catalogue record";
      document.querySelector("#catalogueEditorTitle").textContent = draft.record.title || "Untitled record";
      renderValidation(validateDraft(draft));
      renderPreview(draft.record);
    };
    const activate = id => { activeId = id; drawList(); showActive(); };
    const addDraft = draft => { drafts.unshift(draft); save(); activate(draft.draftId); };
    const csvRows = text => {
      const rows = [];
      let row = [], field = "", quoted = false;
      for (let index = 0; index <= text.length; index += 1) {
        const character = text[index] ?? "\n";
        if (quoted && character === '"' && text[index + 1] === '"') { field += '"'; index += 1; }
        else if (character === '"') quoted = !quoted;
        else if (!quoted && character === ",") { row.push(field); field = ""; }
        else if (!quoted && (character === "\n" || character === "\r")) { if (character === "\r" && text[index + 1] === "\n") index += 1; row.push(field); field = ""; if (row.some(value => value.trim())) rows.push(row); row = []; }
        else field += character;
      }
      if (rows.length < 2) return [];
      const headers = rows[0].map(value => value.trim());
      return rows.slice(1).map(values => Object.fromEntries(headers.map((header, index) => [header, values[index] || ""])));
    };
    const download = (filename, body, type) => {
      const blob = new Blob([body], { type });
      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href; link.download = filename; document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(href), 0);
    };

    form.addEventListener("input", event => {
      const draft = drafts.find(entry => entry.draftId === activeId);
      if (!draft) return;
      if (event.target.name === "title" && !valueOf("id")) setControl("id", slugify(event.target.value));
      draft.record = readForm();
      draft.updatedAt = new Date().toISOString();
      save(); drawList();
      document.querySelector("#catalogueEditorTitle").textContent = draft.record.title || "Untitled record";
      renderValidation(validateDraft(draft)); renderPreview(draft.record);
      document.querySelector("#catalogueAutosaveStatus").textContent = "Saved locally just now.";
    });
    form.addEventListener("change", () => form.dispatchEvent(new Event("input", { bubbles: true })));
    list.addEventListener("click", event => { const button = event.target.closest("[data-catalogue-draft]"); if (button) activate(button.dataset.catalogueDraft); });
    document.querySelector("#newCatalogueRecord")?.addEventListener("click", () => addDraft(makeDraft({ year: new Date().getUTCFullYear(), access: "Free", level: "All levels", relevance: ["Practical"], lastChecked: today, addedAt: today })));
    document.querySelector("#editCatalogueRecord")?.addEventListener("click", () => {
      const id = document.querySelector("#catalogueRecordSource")?.value;
      if (!id || !publishedById.has(id)) { if (importStatus) importStatus.textContent = "Choose a published record first."; return; }
      const existing = drafts.find(draft => draft.baseId === id);
      if (existing) { activate(existing.draftId); if (importStatus) importStatus.textContent = "That record is already staged; its draft is now open."; return; }
      addDraft(makeDraft(clone(publishedById.get(id)), id, "published"));
      if (importStatus) importStatus.textContent = `Copied “${publishedById.get(id).title}” into the local editor.`;
    });
    document.querySelector("#deleteCatalogueDraft")?.addEventListener("click", () => {
      const index = drafts.findIndex(draft => draft.draftId === activeId);
      if (index < 0) return;
      drafts.splice(index, 1); activeId = drafts[0]?.draftId || null; save(); drawList(); showActive();
      if (importStatus) importStatus.textContent = "Draft removed. The published catalogue was not changed.";
    });
    document.querySelector("#suggestCatalogueMetadata")?.addEventListener("click", () => {
      const draft = drafts.find(entry => entry.draftId === activeId);
      if (!draft) return;
      const inferred = inferMetadata(draft.record);
      if (!draft.record.id) draft.record.id = slugify(draft.record.title);
      draft.record.type = inferred.type;
      draft.record.subjects = [inferred.subject];
      draft.record.level = inferred.level;
      if (!draft.record.access) draft.record.access = "Free";
      if (!draft.record.lengthClass) draft.record.lengthClass = inferLengthClass(draft.record.length);
      draft.updatedAt = new Date().toISOString(); save(); drawList(); showActive();
      document.querySelector("#catalogueAutosaveStatus").textContent = `Applied suggested metadata: ${inferred.subject}, ${inferred.type}, ${inferred.level}. Review it before export.`;
    });
    importInput?.addEventListener("change", async () => {
      const file = importInput.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        let candidates;
        if (/\.csv$/i.test(file.name || "") || String(file.type || "").includes("csv")) candidates = csvRows(text);
        else { const payload = JSON.parse(text); candidates = Array.isArray(payload) ? payload : payload.resources || payload.suggestions || []; }
        if (!Array.isArray(candidates) || !candidates.length) throw new Error("No resource records were found in that file.");
        let added = 0, updated = 0;
        for (const candidate of candidates) {
          const record = recordFrom(candidate);
          const matchedBase = publishedById.get(record.id) || resources.find(item => normalizeUrl(item.url) && normalizeUrl(item.url) === normalizeUrl(record.url));
          const existing = drafts.find(draft => draft.baseId === matchedBase?.id || (!draft.baseId && draft.record.id === record.id));
          if (existing) { existing.record = record; existing.updatedAt = new Date().toISOString(); existing.source = "import"; updated += 1; }
          else { drafts.push(makeDraft(record, matchedBase?.id || null, "import")); added += 1; }
        }
        activeId = drafts.at(-1)?.draftId || activeId; save(); drawList(); showActive(); importInput.value = "";
        if (importStatus) importStatus.textContent = `Imported ${candidates.length} ${candidates.length === 1 ? "record" : "records"}: ${added} staged, ${updated} updated. Review the checks before exporting.`;
      } catch (error) {
        importInput.value = "";
        if (importStatus) importStatus.textContent = error.message || "The catalogue file could not be imported.";
      }
    });
    document.querySelector("#downloadCatalogueTemplate")?.addEventListener("click", () => {
      const headers = ["id", "type", "title", "creator", "publisher", "year", "length", "access", "level", "subjects", "lengthClass", "relevance", "topics", "games", "description", "useful", "audience", "learning", "next", "url", "image"];
      download("games-as-art-index-catalogue-template.csv", `${headers.join(",")}\n`, "text/csv");
    });
    exportButton?.addEventListener("click", () => {
      const invalid = drafts.filter(draft => validateDraft(draft).errors.length);
      if (!drafts.length || invalid.length) { if (importStatus) importStatus.textContent = "Resolve every blocking record error before exporting."; return; }
      const stagedRecords = drafts.map(draft => clone(draft.record));
      if (stagedRecords.length === 1) {
        const record = stagedRecords[0];
        download(`${record.id}.json`, `${JSON.stringify(record, null, 2)}\n`, "application/json");
        if (importStatus) importStatus.textContent = `Downloaded ${record.id}.json. Place it in content/resources/ in your pull request.`;
        return;
      }
      const payload = { schemaVersion: 1, preparedAt: today, targetDirectory: "content/resources", resources: stagedRecords };
      download(`games-as-art-index-staged-records-${today}.json`, `${JSON.stringify(payload, null, 2)}\n`, "application/json");
      if (importStatus) importStatus.textContent = `Downloaded ${stagedRecords.length} staged records as a review bundle. Split them into one <id>.json file per resource before opening a pull request.`;
    });
    drawList(); showActive();
  }

  function setupCurator() {
    const container = document.querySelector("#curatorQueue");
    const summary = document.querySelector("#curatorSummary");
    const count = document.querySelector("#curatorCount");
    const exportPublished = document.querySelector("#exportPublished");
    const tabButtons = [...document.querySelectorAll("[data-curator-tab]")];
    const openTab = tab => {
      if (!tabButtons.some(button => button.dataset.curatorTab === tab)) return;
      storage.set("gaa-curator-tab", tab);
      navigate(`/curator?tab=${tab}`);
    };
    tabButtons.forEach(button => button.addEventListener("click", () => openTab(button.dataset.curatorTab)));
    document.querySelector(".curator-tabs")?.addEventListener("keydown", event => {
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      const current = tabButtons.findIndex(button => button === document.activeElement);
      if (current < 0) return;
      event.preventDefault();
      const direction = event.key === "ArrowRight" ? 1 : -1;
      const next = tabButtons[(current + direction + tabButtons.length) % tabButtons.length];
      next.focus(); openTab(next.dataset.curatorTab);
    });
    setupCatalogueBuilder();
    if (!container || !summary) return;
    let queue = suggestionQueue().map(item => ({ ...item, status: suggestionStatuses.includes(item.status) ? item.status : "draft" }));
    const draw = () => {
      if (count) count.textContent = String(queue.length);
      summary.innerHTML = suggestionStatuses.map(value => `<span><strong>${queue.filter(item => item.status === value).length}</strong>${value.replace("-", " ")}</span>`).join("");
      container.innerHTML = queue.length ? queue.map(item => `<article class="curator-card" data-suggestion-id="${escapeHtml(item.id)}"><header><div><span class="status-pill" data-status="${item.status}">${item.status.replace("-", " ")}</span><small>${new Date(item.submittedAt).toLocaleDateString("en-GB")}</small></div><select data-suggestion-status aria-label="Editorial status for ${escapeHtml(item.title)}">${suggestionStatuses.map(value => `<option value="${value}" ${item.status === value ? "selected" : ""}>${value.replace("-", " ")}</option>`).join("")}</select></header><div class="curator-fields"><label><span>Title</span><input data-suggestion-field="title" value="${escapeHtml(item.title)}"></label><label><span>Creator</span><input data-suggestion-field="creator" value="${escapeHtml(item.creator)}"></label><label class="wide"><span>Original URL</span><input data-suggestion-field="url" value="${escapeHtml(item.url)}"></label><label><span>Format</span><select data-suggestion-field="type">${types.map(value => `<option ${item.type === value ? "selected" : ""}>${value}</option>`).join("")}</select></label><label><span>Subject</span><select data-suggestion-field="subject">${subjects.map(value => `<option ${item.subject === value ? "selected" : ""}>${value}</option>`).join("")}</select></label><label class="wide"><span>What it is</span><textarea data-suggestion-field="description" rows="3">${escapeHtml(item.description)}</textarea></label><label class="wide"><span>Why it is useful</span><textarea data-suggestion-field="useful" rows="3">${escapeHtml(item.useful)}</textarea></label></div><footer><span>Updated ${new Date(item.updatedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</span><a href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">Check original ↗</a></footer></article>`).join("") : `<div class="empty-state"><h3>The local queue is empty.</h3><p>Suggestions saved through this browser will appear here for review.</p><a href="#/suggest">Suggest a resource →</a></div>`;
      const published = queue.filter(item => item.status === "published");
      if (exportPublished) exportPublished.disabled = !published.length;
      document.querySelectorAll("[data-export-suggestions]").forEach(button => { button.disabled = !queue.length; });
    };
    container.addEventListener("change", event => {
      const card = event.target.closest("[data-suggestion-id]");
      if (!card) return;
      const item = queue.find(entry => entry.id === card.dataset.suggestionId);
      if (!item) return;
      if (event.target.matches("[data-suggestion-status]")) item.status = event.target.value;
      if (event.target.matches("[data-suggestion-field]")) item[event.target.dataset.suggestionField] = event.target.value.trim();
      item.updatedAt = new Date().toISOString();
      saveSuggestionQueue(queue);
      draw();
    });
    container.addEventListener("input", event => {
      if (!event.target.matches("textarea[data-suggestion-field], input[data-suggestion-field]")) return;
      const card = event.target.closest("[data-suggestion-id]");
      const item = queue.find(entry => entry.id === card?.dataset.suggestionId);
      if (!item) return;
      item[event.target.dataset.suggestionField] = event.target.value;
      item.updatedAt = new Date().toISOString();
      saveSuggestionQueue(queue);
    });
    document.querySelectorAll("[data-export-suggestions]").forEach(button => button.addEventListener("click", () => exportSuggestions(queue)));
    exportPublished?.addEventListener("click", () => exportSuggestions(queue.filter(item => item.status === "published"), "publication-ready"));
    document.querySelector("[data-export-link-reviews]")?.addEventListener("click", exportLinkReviews);
    document.querySelector("[data-export-problem-reports]")?.addEventListener("click", exportProblemReports);
    document.querySelector(".maintenance-list")?.addEventListener("click", event => {
      const reviewToggle = event.target.closest("[data-review-link]");
      if (reviewToggle) {
        const form = document.querySelector(`[data-link-review-form="${reviewToggle.dataset.reviewLink}"]`);
        if (!form) return;
        const opening = form.hidden;
        form.hidden = !opening;
        reviewToggle.setAttribute("aria-expanded", String(opening));
        if (opening) form.querySelector('[name="reviewUrl"]')?.focus();
        return;
      }
      const form = event.target.closest("[data-link-review-form]");
      if (!form) return;
      const item = resource(form.dataset.linkReviewForm);
      if (!item) return;
      const decision = event.target.closest("[data-link-review-status]");
      if (!decision) return;
      const url = String(form.querySelector('[name="reviewUrl"]')?.value || "").trim();
      const note = String(form.querySelector('[name="reviewNote"]')?.value || "").trim();
      const feedback = form.querySelector(".link-review-feedback");
      try { const parsed = new URL(url); if (!/^https?:$/.test(parsed.protocol)) throw new Error(); } catch {
        if (feedback) feedback.textContent = "Enter a complete HTTP or HTTPS URL before recording a decision.";
        form.querySelector('[name="reviewUrl"]')?.focus();
        return;
      }
      const reviews = linkReviews();
      reviews[item.id] = { status: decision.dataset.linkReviewStatus, url, note, reviewedAt: new Date().toISOString() };
      saveLinkReviews(reviews);
      if (decision.dataset.linkReviewStatus === "working") stageReviewedLink(item, url, note);
      const label = trustStates[decision.dataset.linkReviewStatus]?.label || "Reviewed";
      toast.textContent = `${item.title}: ${label.toLowerCase()} locally`;
      toast.classList.add("show"); clearTimeout(window.__GAA_TOAST_TIMER__); window.__GAA_TOAST_TIMER__ = setTimeout(() => toast.classList.remove("show"), 2400);
      render();
    });
    document.querySelector(".problem-report-queue")?.addEventListener("click", event => {
      const button = event.target.closest("[data-resolve-report]");
      if (!button) return;
      const reports = problemReports();
      const report = reports.find(entry => entry.id === button.dataset.resolveReport);
      if (!report) return;
      report.status = report.status === "resolved" ? "open" : "resolved";
      report.updatedAt = new Date().toISOString();
      saveProblemReports(reports);
      render();
    });
    draw();
  }

  function search(query = "") {
    if (!syncShell()) return;
    const term = query.trim();
    const matches = (term ? resources.map(item => ({ item, score: searchScore(item, term) })).filter(result => result.score > 0).sort((a, b) => b.score - a.score || resourceOrder.get(a.item.id) - resourceOrder.get(b.item.id)).map(result => result.item) : resources.filter(item => item.featured)).slice(0, 7);
    const suggestions = relatedTermsFor(term);
    const noResults = term && !matches.length ? `<div class="search-no-results"><strong>No close match yet.</strong><p>Try a related catalogue term:</p>${suggestions.map(value => `<button type="button" data-search="${escapeHtml(value)}">${escapeHtml(value)}</button>`).join("")}</div>` : "";
    searchResults.innerHTML = `<p class="search-status">${term ? `${matches.length} close ${matches.length === 1 ? "match" : "matches"} shown` : "Recommended starting points"}</p>${matches.map(item => `<a href="#/resource/${item.id}" data-search-route><span>${item.type}</span><strong>${item.title}</strong><small>${item.creator} · ${item.year}</small><b>→</b></a>`).join("")}${noResults}${term ? `<a class="all-results" href="#/browse?q=${encodeURIComponent(query)}" data-search-route>Browse all matching resources →</a>` : ""}`;
    normalizeInternalLinks(searchResults);
  }

  function setTheme(mode) {
    if (!syncShell()) return;
    try { localStorage.setItem("gaa-theme", mode); } catch {}
    const systemDark = typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches;
    const dark = mode === "dark" || (mode === "auto" && systemDark);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    document.documentElement.dataset.themeMode = mode;
    document.querySelectorAll("[data-theme-mode]").forEach(button => button.classList.toggle("active", button.dataset.themeMode === mode));
    const trigger = document.querySelector("#themeButton");
    if (trigger) {
      const systemOrder = systemDark ? ["auto", "light", "dark"] : ["auto", "dark", "light"];
      const nextTheme = systemOrder[(systemOrder.indexOf(mode) + 1) % systemOrder.length];
      const modeName = mode === "auto" ? "Automatic" : mode[0].toUpperCase() + mode.slice(1);
      const nextName = nextTheme === "auto" ? "Automatic" : nextTheme[0].toUpperCase() + nextTheme.slice(1);
      trigger.setAttribute("aria-label", `Theme: ${modeName}. Click to use ${nextName}`);
      trigger.setAttribute("title", `Theme: ${modeName}. Click to use ${nextName}`);
      const icon = trigger.querySelector("span");
      if (icon) icon.textContent = mode === "auto" ? "◐" : mode === "dark" ? "☾" : "☀";
      const label = trigger.querySelector("small");
      if (label) label.textContent = mode === "auto" ? "Auto" : modeName;
    }
    const mobileLabel = document.querySelector("#mobileTheme span");
    if (mobileLabel) mobileLabel.textContent = mode[0].toUpperCase() + mode.slice(1);
    themePopover.hidden = true;
  }

  function refreshQueueResource(id) {
    const item = resource(id);
    if (!item) return;
    const status = queueStatus(id);
    document.querySelectorAll(`[data-save="${id}"], [data-queue-status="${id}"]`).forEach(control => {
      const wrapper = control.closest(".queue-control") || control;
      const compact = wrapper.classList.contains("compact");
      wrapper.outerHTML = queueControl(item, compact);
    });
    document.querySelectorAll(`[data-resource-id="${id}"]`).forEach(container => {
      const visited = isVisited(id);
      const label = status ? queueBadgeLabels[status] : visited ? "Visited" : "";
      container.dataset.queueState = status;
      container.classList.toggle("is-saved", Boolean(status));
      container.classList.toggle("is-visited", visited);
      let badge = container.querySelector(".cover-state, .list-state");
      if (!label) {
        if (container.classList.contains("resource-list-item") && badge) {
          badge.textContent = "Status";
          badge.classList.add("is-empty");
          badge.setAttribute("aria-hidden", "true");
        } else badge?.remove();
        return;
      }
      if (!badge) {
        badge = document.createElement("span");
        badge.className = container.classList.contains("resource-list-item") ? "list-state" : "cover-state";
        container.querySelector(container.classList.contains("resource-list-item") ? ".list-main" : ".card-main")?.appendChild(badge);
      }
      badge.textContent = label;
      badge.classList.remove("is-empty");
      badge.setAttribute("aria-hidden", "false");
    });
  }

  document.addEventListener("click", event => {
    if (!syncShell()) return;
    const youtubeTrigger = event.target.closest("[data-load-youtube]");
    if (youtubeTrigger) {
      event.preventDefault();
      const frame = youtubeTrigger.closest("[data-youtube-embed]");
      const item = resource(frame?.dataset.resourceId);
      const videoId = youtubeTrigger.dataset.loadYoutube;
      if (frame && item && /^[A-Za-z0-9_-]{11}$/.test(videoId || "")) {
        const player = document.createElement("iframe");
        player.src = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&playsinline=1`;
        player.title = `YouTube video player: ${item.title}`;
        player.loading = "lazy";
        player.referrerPolicy = "strict-origin-when-cross-origin";
        player.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
        player.setAttribute("allowfullscreen", "");
        frame.replaceChildren(player);
      }
      return;
    }
    const documentTrigger = event.target.closest("[data-load-document]");
    if (documentTrigger) {
      event.preventDefault();
      const frame = documentTrigger.closest("[data-document-embed]");
      const item = resource(frame?.dataset.resourceId);
      let documentUrl;
      try {
        const candidate = new URL(documentTrigger.dataset.loadDocument);
        if (candidate.protocol === "https:" && candidate.pathname.toLowerCase().endsWith(".pdf")) documentUrl = candidate.href;
      } catch {}
      if (frame && item && documentUrl) {
        const viewer = document.createElement("iframe");
        viewer.src = documentUrl;
        viewer.title = `PDF reader: ${item.title}`;
        viewer.loading = "lazy";
        viewer.referrerPolicy = "strict-origin-when-cross-origin";
        frame.replaceChildren(viewer);
      }
      return;
    }
    const bookTrigger = event.target.closest("[data-load-google-book]");
    if (bookTrigger) {
      event.preventDefault();
      const frame = bookTrigger.closest("[data-google-books-embed]");
      const item = resource(frame?.dataset.resourceId);
      const isbn = bookTrigger.dataset.loadGoogleBook;
      if (frame && item && /^(?:978|979)\d{10}$/.test(isbn || "")) loadGoogleBook(frame, item, isbn);
      return;
    }
    const routeLink = event.target.closest('a[data-index-route], a[href^="#/"]');
    if (routeLink) {
      event.preventDefault();
      const legacyRoute = routeLink.getAttribute("href")?.startsWith("#/") ? routeLink.getAttribute("href").slice(1) : "";
      navigate(routeLink.dataset.indexRoute || legacyRoute || "/");
    }
    const openSearch = event.target.closest("[data-open-search]") || event.target.closest("#openSearch");
    if (openSearch) { search(""); searchDialog.showModal(); setTimeout(() => searchInput.focus(), 30); }
    const suggestion = event.target.closest("[data-search]");
    if (suggestion) { searchInput.value = suggestion.dataset.search; search(suggestion.dataset.search); }
    const saver = event.target.closest("[data-save]");
    if (saver) {
      event.preventDefault();
      const id = saver.dataset.save;
      setQueueStatus(id, "want");
      if (document.body.dataset.view === "/" || document.body.dataset.view.startsWith("/collection/")) render();
      else refreshQueueResource(id);
      toast.textContent = "Added to Want to explore";
      toast.classList.add("show"); clearTimeout(window.__GAA_TOAST_TIMER__); window.__GAA_TOAST_TIMER__ = setTimeout(() => toast.classList.remove("show"), 2200);
    }
    const themeTrigger = event.target.closest("#themeButton");
    if (themeTrigger) {
      event.preventDefault();
      const systemDark = typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches;
      const modes = systemDark ? ["auto", "light", "dark"] : ["auto", "dark", "light"];
      const currentMode = document.documentElement.dataset.themeMode || "auto";
      const nextTheme = modes[(modes.indexOf(currentMode) + 1) % modes.length];
      setTheme(nextTheme);
      toast.textContent = nextTheme === "auto" ? "Automatic theme — follows your device" : `${nextTheme[0].toUpperCase() + nextTheme.slice(1)} theme`;
      toast.classList.add("show");
      clearTimeout(window.__GAA_TOAST_TIMER__);
      window.__GAA_TOAST_TIMER__ = setTimeout(() => toast.classList.remove("show"), 1600);
    }
    const themeMode = event.target.closest("[data-theme-mode]");
    if (themeMode) setTheme(themeMode.dataset.themeMode);
    const mobileTheme = event.target.closest("#mobileTheme");
    if (mobileTheme) { const modes = ["auto", "light", "dark"]; let current = "auto"; try { current = localStorage.getItem("gaa-theme") || "auto"; } catch {} setTheme(modes[(modes.indexOf(current) + 1) % modes.length]); }
    if (event.target.closest("#menuButton")) { const open = !menu.classList.contains("open"); menu.classList.toggle("open", open); menuButton.setAttribute("aria-expanded", String(open)); }
    if (event.target.closest("[data-search-route]")) searchDialog.close();
    if (!event.target.closest("#themeButton") && !event.target.closest(".theme-popover")) themePopover.hidden = true;
  });

  document.addEventListener("change", event => {
    const control = event.target.closest("[data-queue-status]");
    if (!control) return;
    const id = control.dataset.queueStatus;
    const nextStatus = control.value;
    setQueueStatus(id, nextStatus);
    if (document.body.dataset.view === "/" || document.body.dataset.view === "/saved" || document.body.dataset.view.startsWith("/collection/")) render();
    else refreshQueueResource(id);
    toast.textContent = nextStatus === "remove" ? "Removed from your queue" : `Moved to ${queueLabels[nextStatus]}`;
    toast.classList.add("show"); clearTimeout(window.__GAA_TOAST_TIMER__); window.__GAA_TOAST_TIMER__ = setTimeout(() => toast.classList.remove("show"), 2000);
  });

  document.addEventListener("input", event => { if (event.target.matches("#globalSearch")) search(event.target.value); });
  document.addEventListener("keydown", event => {
    if (event.key === "/" && !/input|textarea|select/i.test(document.activeElement.tagName)) { event.preventDefault(); search(""); searchDialog.showModal(); setTimeout(() => searchInput.focus(), 30); }
    if (event.key === "Escape") {
      themePopover.hidden = true;
      const filterPanel = document.querySelector("#filterPanel");
      const filterToggle = document.querySelector("#filterToggle");
      if (filterPanel?.classList.contains("open")) { filterPanel.classList.remove("open"); document.body.classList.remove("filters-open"); filterToggle?.setAttribute("aria-expanded", "false"); filterToggle?.focus(); }
    }
  });
  const restoreRoute = (state, force = false) => {
    const nextRoute = routeFromLocation(state);
    const fallbackVisible = document.querySelector("#content .fallback-loading");
    if (!force && nextRoute === routeSpec && !fallbackVisible) return;
    routeSpec = nextRoute;
    render();
  };
  window.addEventListener("popstate", event => restoreRoute(event.state, true));
  window.addEventListener("hashchange", () => {
    if (location.hash.startsWith("#/")) navigate(location.hash.slice(1), { replace: true });
  });
  window.addEventListener("pageshow", event => { if (event.persisted) restoreRoute(history.state, true); });
  window.__GAA_RESTORE__ = () => restoreRoute(history.state, true);
  if (typeof matchMedia === "function") {
    const colorScheme = matchMedia("(prefers-color-scheme: dark)");
    const followSystem = () => { let mode = "auto"; try { mode = localStorage.getItem("gaa-theme") || "auto"; } catch {} if (mode === "auto") setTheme("auto"); };
    if (colorScheme.addEventListener) colorScheme.addEventListener("change", followSystem); else if (colorScheme.addListener) colorScheme.addListener(followSystem);
  }

  let initialTheme = "auto";
  try { initialTheme = localStorage.getItem("gaa-theme") || "auto"; } catch {}
  setTheme(initialTheme);
  navigate(routeSpec, { replace: true });
}

if (window.GAA) initializeGamesAsArtLibrary();
else document.addEventListener("gaa-ready", initializeGamesAsArtLibrary, { once: true });

document.addEventListener("gaa-error", event => {
  const content = document.querySelector("#content");
  if (!content) return;
  content.innerHTML = `<section class="runtime-error shell"><span class="eyebrow">Index unavailable</span><h1>The index data could not be loaded.</h1><p>${event.detail?.message || "Please refresh to try again."}</p><p><button type="button" onclick="location.reload()">Reload the index</button></p></section>`;
});

if (window.__GAA_CATALOGUE_ERROR__) document.dispatchEvent(new CustomEvent("gaa-error", { detail: { message: window.__GAA_CATALOGUE_ERROR__.message } }));
