import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { parseHTML } from "linkedom";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const catalogue = JSON.parse(await readFile(new URL("../public/catalogue.json", import.meta.url), "utf8"));
const linkSnapshot = JSON.parse(await readFile(new URL("../public/link-status.json", import.meta.url), "utf8"));
const thumbnailManifest = JSON.parse(await readFile(new URL("../public/thumbnail-manifest.json", import.meta.url), "utf8"));
catalogue.thumbnails = thumbnailManifest;

function createLibrary(route = "#/browse", seed = {}, libraryData = catalogue) {
  const { window } = parseHTML(html);
  const values = new Map(Object.entries(seed));
  const initial = new URL(route.startsWith("#") ? `/${route}` : route, "https://example.test");
  const location = { origin: initial.origin, pathname: initial.pathname, search: initial.search, hash: initial.hash };
  Object.defineProperty(location, "href", { get() { return `${this.origin}${this.pathname}${this.search}${this.hash}`; } });
  const applyLocation = href => {
    const target = new URL(href, location.href);
    location.pathname = target.pathname;
    location.search = target.search;
    location.hash = target.hash;
  };
  const history = {
    state: null,
    pushState(state, _title, href) { this.state = state; applyLocation(href); },
    replaceState(state, _title, href) { this.state = state; applyLocation(href); }
  };
  Object.assign(window, {
    __GAA_INITIALIZED__: false,
    __GAA_RESTORE__: undefined,
    GAA: libraryData,
    location,
    history,
    localStorage: {
      getItem: key => values.has(key) ? values.get(key) : null,
      setItem: (key, value) => values.set(key, String(value))
    },
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    scrollTo() {},
    URL,
    URLSearchParams,
    console
  });
  window.document.querySelectorAll("dialog").forEach(dialog => {
    dialog.showModal = () => { dialog.open = true; };
    dialog.close = () => { dialog.open = false; };
  });
  const context = vm.createContext(window);
  vm.runInContext(app, context);
  return { window, document: window.document, location, history, values };
}

const initial = createLibrary();
assert.match(initial.document.querySelector(".brand").textContent, /Index/, "the public brand uses the Games as Art Index name");
assert.match(initial.document.title, /Games as Art Index/, "page titles use the Index identity");
assert.equal(initial.location.pathname, "/browse/", "legacy hash routes are replaced with clean paths on startup");
assert.equal(initial.location.hash, "", "clean navigation removes the legacy route hash");
assert.equal(initial.document.querySelectorAll(".resource-card").length, 24, "detailed view starts with 24 cards");
assert.equal(initial.document.querySelectorAll(".resource-card .resource-cover.has-image img").length, 24, "every detailed resource card starts with a thumbnail");
assert.equal(Object.keys(thumbnailManifest.resources).length, catalogue.resources.length, "the thumbnail manifest covers the complete catalogue");
assert.ok(catalogue.resources.every(item => thumbnailManifest.resources[item.id]?.path), "every catalogue record resolves to a local thumbnail fallback");
assert.ok([...initial.document.querySelectorAll(".resource-card .resource-cover img")].every(image => image.getAttribute("src").startsWith("/thumbnails/")), "all resource cards use the unified local thumbnail set");
assert.match(initial.document.querySelector('[data-resource-id="doom-behind-music"] .resource-cover img').getAttribute("src"), /^\/thumbnails\//, "old externally hosted artwork is replaced by the unified thumbnail set");
const firstCatalogueResource = catalogue.resources[0];
const firstSourceHost = new URL(firstCatalogueResource.url).hostname.replace(/^www\./, "");
assert.match(initial.document.querySelector(`[data-resource-id="${firstCatalogueResource.id}"] .card-source`).textContent, new RegExp(firstCatalogueResource.publisher.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), "resource cards identify the publisher or channel");
assert.match(initial.document.querySelector(`[data-resource-id="${firstCatalogueResource.id}"] .card-source`).textContent, new RegExp(firstSourceHost.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), "resource cards identify the original host site");
initial.document.querySelector("#openSearch").click();
assert.ok([...initial.document.querySelectorAll(".search-result-copy small")].every(node => node.textContent.includes("Source:")), "global search results identify their source");
assert.match(initial.document.querySelector("#browseStatus").textContent, new RegExp(`Showing 24 of ${catalogue.resources.length}`));
initial.document.querySelector("[data-show-more]").click();
assert.equal(initial.document.querySelectorAll(".resource-card").length, 48, "show more reveals the next 24 cards");

initial.document.querySelector('[data-view-mode="list"]').click();
assert.equal(initial.document.querySelectorAll(".resource-list-item").length, 24, "compact view starts with 24 rows");
assert.equal(initial.document.querySelectorAll(".resource-card").length, 0, "compact view replaces cards");
assert.equal(initial.document.querySelectorAll(".resource-list-item .list-state").length, 24, "every compact row reserves the status column");
assert.ok(initial.document.querySelector(".resource-list-item .list-state.is-empty"), "unmarked rows keep an invisible alignment placeholder");
assert.equal(initial.document.querySelector(".resource-list-item .list-source dt").textContent, "Source", "compact rows expose a dedicated source field");
assert.match(initial.document.querySelector(".resource-list-item .list-source").textContent, new RegExp(firstCatalogueResource.publisher.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), "compact rows show the publisher or channel");
assert.equal(initial.location.pathname, "/browse/", "compact view remains on the clean browse path");
assert.equal(initial.location.search, "?view=list", "compact view is reflected in the query string");
assert.equal(initial.values.get("gaa-browse-view"), '"list"', "compact preference is saved locally");
assert.ok(initial.document.querySelector(".resource-list-item .direct-control[href^=\"http\"]"), "compact rows include direct links");

const first = initial.document.querySelector(".resource-list-item");
first.querySelector("[data-save]").click();
assert.ok(first.classList.contains("is-saved"), "saving marks the current row");
assert.equal(first.querySelector(".list-state").textContent, "Want", "saving starts the resource in Want to explore");
assert.equal(first.querySelector("[data-queue-status]").value, "want", "saving replaces the button with a queue status control");
let statusControl = first.querySelector("[data-queue-status]");
statusControl.querySelector('option[value="progress"]').selected = true;
statusControl.dispatchEvent(new initial.window.Event("change", { bubbles: true }));
assert.equal(first.querySelector(".list-state").textContent, "In progress", "changing status updates the visible row label");
assert.equal(JSON.parse(initial.values.get("gaa-library-queue"))[first.dataset.resourceId].status, "progress", "queue status is stored locally");
statusControl = first.querySelector("[data-queue-status]");
statusControl.querySelector('option[value="remove"]').selected = true;
statusControl.dispatchEvent(new initial.window.Event("change", { bubbles: true }));
assert.ok(first.querySelector(".list-state").classList.contains("is-empty"), "removing an unvisited save keeps the alignment placeholder");

const remembered = createLibrary("#/browse", { "gaa-browse-view": '"list"' });
assert.equal(remembered.document.querySelectorAll(".resource-list-item").length, 24, "local compact preference is restored");
const urlOverride = createLibrary("#/browse?view=cards", { "gaa-browse-view": '"list"' });
assert.equal(urlOverride.document.querySelectorAll(".resource-card").length, 24, "URL view overrides the local preference");

const firstId = catalogue.resources[0].id;
const cleanBrowse = createLibrary("/browse/");
const firstCleanLink = cleanBrowse.document.querySelector(`[data-resource-id="${firstId}"] .card-main`);
assert.equal(firstCleanLink.getAttribute("href"), `/resource/${firstId}/`, "rendered resource cards expose crawlable clean links");
assert.equal(firstCleanLink.dataset.indexRoute, `/resource/${firstId}`, "clean links retain their client-side route target");
const directResource = createLibrary(`/resource/${firstId}/`);
assert.match(directResource.document.querySelector(".resource-intro h1").textContent, new RegExp(catalogue.resources[0].title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), "a resource renders when loaded directly from its clean path");
assert.match(directResource.document.querySelector(".resource-byline").textContent, /Source:/, "resource pages label their original source explicitly");
assert.match(directResource.document.querySelector(".resource-byline").textContent, new RegExp(firstSourceHost.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), "resource pages show the original host site");
directResource.document.querySelector('.breadcrumb a[data-index-route="/browse"]').click();
assert.equal(directResource.location.pathname, "/browse/", "client navigation changes the clean pathname without a reload");
const visited = createLibrary(`#/resource/${firstId}`);
assert.equal(visited.location.pathname, `/resource/${firstId}/`, "legacy resource hashes upgrade to canonical resource paths");
assert.equal(JSON.parse(visited.values.get("gaa-library-history"))[0], firstId, "opening a resource records it as visited");
visited.location.hash = "#/browse?view=list";
visited.window.dispatchEvent(new visited.window.Event("hashchange"));
const visitedRow = visited.document.querySelector(`[data-resource-id="${firstId}"]`);
assert.ok(visitedRow.classList.contains("is-visited"), "returning to browse marks the visited resource");
assert.equal(visitedRow.querySelector(".list-state").textContent, "Visited");

const secondId = catalogue.resources[1].id;
const thirdId = catalogue.resources[2].id;
const legacy = createLibrary("#/saved", { "gaa-library-saved": JSON.stringify([firstId]) });
assert.equal(JSON.parse(legacy.values.get("gaa-library-queue"))[firstId].status, "want", "legacy saved items migrate to Want to explore");
assert.ok(legacy.document.querySelector("#queueGrid"), "migrated items appear in the learning queue");

const learningQueue = {
  [firstId]: { status: "progress", updatedAt: "2026-07-18T12:00:00.000Z" },
  [secondId]: { status: "want", updatedAt: "2026-07-18T11:00:00.000Z" }
};
const learning = createLibrary("#/saved", { "gaa-library-queue": JSON.stringify(learningQueue) });
assert.ok(learning.document.querySelector(".continue-section"), "in-progress resources appear in Continue where you left off");
assert.equal(learning.document.querySelectorAll("#queueGrid .resource-card").length, 2, "the full queue contains every saved resource");
learning.document.querySelector('[data-queue-filter="progress"]').click();
assert.equal([...learning.document.querySelectorAll("#queueGrid .resource-card")].filter(card => !card.hidden).length, 1, "queue status filters show the matching resources");
assert.ok(learning.document.querySelector("#exportLibrary"), "the queue provides a JSON export control");
assert.ok(learning.document.querySelector("#importLibrary"), "the queue provides a JSON import control");
learning.document.querySelector("#exportLibrary").click();
const importInput = learning.document.querySelector("#importLibrary");
Object.defineProperty(importInput, "files", { value: [{ text: async () => JSON.stringify({ schemaVersion: 1, queue: [{ id: thirdId, status: "finished", updatedAt: "2026-07-18T13:00:00.000Z" }], history: [thirdId] }) }] });
importInput.dispatchEvent(new learning.window.Event("change", { bubbles: true }));
await new Promise(resolve => setTimeout(resolve, 0));
assert.equal(JSON.parse(learning.values.get("gaa-library-queue"))[thirdId].status, "finished", "import merges valid queue items into the local index queue");
assert.ok(JSON.parse(learning.values.get("gaa-library-history")).includes(thirdId), "import restores valid browsing history");

const firstCollection = catalogue.collections[0];
const guided = createLibrary(`#/collection/${firstCollection.id}`);
assert.ok(guided.document.querySelector(".collection-stat-grid"), "collection pages show progress and commitment statistics");
assert.match(guided.document.querySelector(".collection-stat-grid").textContent, /estimated commitment/i);
guided.document.querySelector("[data-add-collection]").click();
const guidedQueue = JSON.parse(guided.values.get("gaa-library-queue"));
assert.equal(firstCollection.resources.filter(id => guidedQueue[id]?.status === "want").length, firstCollection.resources.length, "Add collection queues every unsaved resource as Want to explore");
assert.ok(guided.document.querySelector("[data-add-collection]").disabled, "the add-all control disables when the full collection is queued");
const firstCollectionResource = firstCollection.resources[0];
const collectionStatus = guided.document.querySelector(`[data-resource-id="${firstCollectionResource}"] [data-queue-status]`);
collectionStatus.querySelector('option[value="finished"]').selected = true;
collectionStatus.dispatchEvent(new guided.window.Event("change", { bubbles: true }));
assert.match(guided.document.querySelector(".collection-stat-grid strong").textContent, new RegExp(`1/${firstCollection.resources.length}`), "finishing a resource updates collection progress");
assert.ok(guided.document.querySelector(".collection-actions a[href^=\"/resource/\"]"), "collection pages point to the next unfinished resource with a clean URL");

const collectionIndex = createLibrary("#/collections", { "gaa-library-queue": guided.values.get("gaa-library-queue") });
assert.match(collectionIndex.document.querySelector(".collection-card .collection-progress small").textContent, /1 of .* finished/i, "collection cards expose local completion progress");

const blowCollection = catalogue.collections.find(item => item.id === "jonathan-blow");
assert.equal(blowCollection.resources.length, 10, "the Jonathan Blow collection contains the complete curated sequence");
assert.ok(blowCollection.resources.every(id => catalogue.resources.some(item => item.id === id)), "every Jonathan Blow collection entry resolves to a catalogue record");
const blowCollectionPage = createLibrary("#/collection/jonathan-blow");
assert.match(blowCollectionPage.document.querySelector(".collection-hero h1").textContent, /Jonathan Blow/);
assert.equal(blowCollectionPage.document.querySelectorAll(".collection-sequence .resource-card").length, 10, "the Jonathan Blow collection renders every resource");
assert.equal(blowCollectionPage.document.querySelectorAll(".collection-sequence .card-source").length, 10, "collection entries identify every resource source");
assert.equal(blowCollectionPage.document.querySelectorAll(".collection-sequence .direct-control").length, 10, "every collection entry can open its original source directly");

const generalHome = createLibrary("#/");
assert.equal(generalHome.document.querySelector(".personal-home"), null, "the first-visit homepage remains general without local signals");
assert.ok(generalHome.document.querySelector(".featured-resources"), "the general homepage keeps its editorial shelf");

const homeQueue = {
  [firstId]: { status: "progress", updatedAt: "2026-07-18T14:00:00.000Z" },
  [secondId]: { status: "finished", updatedAt: "2026-07-18T13:00:00.000Z" }
};
const personalHome = createLibrary("#/", { "gaa-library-queue": JSON.stringify(homeQueue), "gaa-library-history": JSON.stringify([thirdId]) });
assert.ok(personalHome.document.querySelector(".personal-home"), "local activity adds the personalized home dashboard");
assert.ok(personalHome.document.querySelector(`.continue-home [data-resource-id="${firstId}"]`), "in-progress resources appear in Continue learning");
assert.ok(personalHome.document.querySelector(".continue-home .collection-card"), "active collections appear alongside active resources");
assert.ok(personalHome.document.querySelector(".recommendation-home .card-reason"), "recommendations explain why they appear");
assert.equal(personalHome.document.querySelector(`.recommendation-home [data-resource-id="${secondId}"]`), null, "finished resources are excluded from recommendations");
assert.ok(personalHome.document.querySelector(".recent-interests"), "recently catalogued entries appear in followed subjects");
personalHome.document.querySelector("[data-reset-personalization]").click();
assert.deepEqual(JSON.parse(personalHome.values.get("gaa-library-history")), [], "reset clears viewing signals");
assert.equal(JSON.parse(personalHome.values.get("gaa-library-queue"))[firstId].status, "progress", "reset preserves the learning queue");
personalHome.document.querySelector("[data-toggle-personalization]").click();
assert.equal(personalHome.values.get("gaa-personalization-enabled"), "false", "personalization can be disabled locally");
assert.ok(personalHome.document.querySelector(".personalization-off"), "disabled personalization shows a clear opt-in state");
assert.ok(personalHome.document.querySelector(".featured-resources"), "disabling personalization restores the general editorial shelf");

const trustCatalogue = structuredClone(catalogue);
trustCatalogue.linkStatus = {
  schemaVersion: 1,
  generatedAt: "2026-07-18T15:00:00.000Z",
  results: [
    { id: firstId, status: "ok", redirected: false, checkedAt: "2026-07-18T15:00:00.000Z", httpStatus: 200 },
    { id: secondId, status: "redirected", redirected: true, checkedAt: "2026-07-18T15:00:00.000Z", httpStatus: 200 },
    { id: thirdId, status: "broken", redirected: false, checkedAt: "2026-07-18T15:00:00.000Z", httpStatus: 404 },
    { id: catalogue.resources[3].id, status: "restricted", redirected: false, checkedAt: "2026-07-18T15:00:00.000Z", httpStatus: 403 }
  ]
};
const trustBrowse = createLibrary("#/browse?trust=broken&view=list", {}, trustCatalogue);
assert.equal(trustBrowse.document.querySelectorAll(".resource-list-item").length, 1, "the link-state filter isolates broken resources");
assert.equal(trustBrowse.document.querySelector(".resource-list-item").dataset.resourceId, thirdId);
assert.equal(trustBrowse.document.querySelector(".trust-badge").textContent.trim().startsWith("Broken"), true, "compact rows show the latest verification state");
const browseReport = trustBrowse.document.querySelector(".report-control");
assert.ok(browseReport, "browse results provide a catalogue problem control");
assert.match(browseReport.getAttribute("href"), /^https:\/\/github\.com\/xefensor\/games-as-art-index\/issues\/new\?template=broken-link\.yml/, "problem reports open the public GitHub issue form");
assert.equal(browseReport.getAttribute("target"), "_blank", "GitHub reports do not replace the current catalogue view");

const redirectedDetail = createLibrary(`#/resource/${secondId}`, {}, trustCatalogue);
assert.match(redirectedDetail.document.querySelector(".resource-trust").textContent, /Redirected/, "resource pages explain redirected links");
assert.ok(redirectedDetail.document.querySelector(".resource-actions .report-control"), "resource pages also expose reporting");
assert.match(redirectedDetail.document.querySelector(".resource-actions .source-record-control").getAttribute("href"), new RegExp(`content/resources/${secondId}\\.json$`), "resource pages link directly to their GitHub source record");

const youtubeResources = catalogue.resources.filter(item => /(?:youtube\.com|youtu\.be)/i.test(item.url));
assert.equal(youtubeResources.length, 10, "the current catalogue identifies every supported YouTube resource");
const attachedYoutubeResources = catalogue.resources.filter(item => item.embed?.provider === "youtube");
assert.equal(attachedYoutubeResources.length, 3, "official videos can be attached without replacing original editorial source URLs");
const youtubeDetail = createLibrary("#/resource/doom-behind-music");
assert.ok(youtubeDetail.document.querySelector(".resource-embed"), "YouTube resource pages include an embedded-player section");
assert.equal(youtubeDetail.document.querySelector(".resource-embed iframe"), null, "the YouTube player is not loaded before consent");
youtubeDetail.document.querySelector("[data-load-youtube]").click();
const youtubePlayer = youtubeDetail.document.querySelector(".resource-embed iframe");
assert.match(youtubePlayer.getAttribute("src"), /^https:\/\/www\.youtube-nocookie\.com\/embed\/U4FNBMZsqrY/, "the click-to-load player uses YouTube's privacy-enhanced embed domain");
assert.equal(youtubePlayer.hasAttribute("allowfullscreen"), true, "embedded videos allow fullscreen playback");
const attachedYoutubeDetail = createLibrary("#/resource/doom-postmortem");
assert.equal(attachedYoutubeDetail.document.querySelector(".resource-actions .primary-action").getAttribute("href"), "https://www.gamedeveloper.com/business/video-hall-and-romero-s-i-doom-i-postmortem", "the main resource action preserves the original publisher page");
assert.equal(attachedYoutubeDetail.document.querySelector(".resource-embed header a").getAttribute("href"), "https://www.youtube.com/watch?v=NnkCujnYNSo", "the embedded section links to the verified official video");
attachedYoutubeDetail.document.querySelector("[data-load-youtube]").click();
assert.match(attachedYoutubeDetail.document.querySelector(".resource-embed iframe").getAttribute("src"), /^https:\/\/www\.youtube-nocookie\.com\/embed\/NnkCujnYNSo/, "an attached official video uses the same privacy-enhanced player");
const documentResources = catalogue.resources.filter(item => item.embed?.provider === "pdf");
assert.equal(documentResources.length, 3, "the current catalogue identifies every publisher-hosted PDF reader");
const documentDetail = createLibrary("#/resource/mda-framework");
assert.ok(documentDetail.document.querySelector(".document-embed"), "supported paper pages include an embedded document section");
assert.equal(documentDetail.document.querySelector(".document-embed iframe"), null, "the PDF is not loaded before the reader asks for it");
documentDetail.document.querySelector("[data-load-document]").click();
const documentPlayer = documentDetail.document.querySelector(".document-embed iframe");
assert.equal(documentPlayer.getAttribute("src"), "https://users.cs.northwestern.edu/~hunicke/MDA.pdf", "the embedded reader loads the publisher-hosted PDF");
assert.match(documentPlayer.getAttribute("title"), /PDF reader: MDA/, "the PDF iframe has a descriptive title");
const bookPreviewResources = catalogue.resources.filter(item => item.type === "Book" && /(?:978|979)\d{10}/.test(item.url));
assert.equal(bookPreviewResources.length, 23, "books with publisher-supplied ISBNs are eligible for Google Books previews");
const bookDetail = createLibrary("#/resource/rules-of-play");
assert.ok(bookDetail.document.querySelector(".book-embed"), "eligible book pages offer a click-to-load preview");
assert.equal(bookDetail.document.querySelector(".google-books-canvas"), null, "Google Books is not contacted before the reader requests a preview");
bookDetail.window.google = { books: {
  load() {},
  setOnLoadCallback(callback) { callback(); },
  DefaultViewer: class {
    constructor(container) { this.container = container; }
    load(identifier, _failure, success) { this.container.dataset.loadedBook = identifier; success(); }
  }
} };
bookDetail.document.querySelector("[data-load-google-book]").click();
await new Promise(resolve => setTimeout(resolve, 0));
assert.equal(bookDetail.document.querySelector(".google-books-canvas").dataset.loadedBook, "ISBN:9780262240451", "the official viewer receives the catalogue ISBN");
assert.ok(bookDetail.document.querySelector(".book-frame").classList.contains("is-loaded"), "successful book previews expose their loaded state");
const unsupportedDetail = createLibrary("#/resource/door-problem");
assert.equal(unsupportedDetail.document.querySelector(".resource-embed"), null, "resources without a supported provider do not show an embed");

const contribution = createLibrary("#/suggest");
assert.match(contribution.document.querySelector(".contribution-heading h1").textContent, /smallest useful contribution/i, "the contribution page explains its purpose directly");
assert.equal(contribution.document.querySelectorAll(".contribution-options article").length, 3, "the page separates suggestions, reports, and direct edits");
assert.match(contribution.document.querySelector('.contribution-options a[href*="resource-suggestion.yml"]').getAttribute("href"), /^https:\/\/github\.com\//, "resource suggestions use the public GitHub issue form");
assert.match(contribution.document.querySelector('.contribution-options a[href*="broken-link.yml"]').getAttribute("href"), /^https:\/\/github\.com\//, "catalogue problems use the public GitHub issue form");
assert.match(contribution.document.querySelector('.contribution-options a[href$="CONTRIBUTING.md"]').getAttribute("href"), /^https:\/\/github\.com\//, "exact edits point to the pull-request guide");
assert.equal(contribution.document.querySelectorAll(".contribution-decision article").length, 4, "the page explains review, checks, and deployment");
assert.equal(contribution.document.querySelector("#suggestionForm"), null, "the site no longer implies that browser-local suggestions reach maintainers");

const curator = createLibrary("#/curator", {}, trustCatalogue);
assert.ok(curator.document.querySelector(`[data-maintenance-resource="${thirdId}"]`), "the maintenance dashboard prioritizes broken resources from the deployed snapshot");
const maintenanceBadge = curator.document.querySelector(`[data-maintenance-resource="${thirdId}"] .trust-badge`);
assert.match(maintenanceBadge.textContent, /18 Jul 2026/, "maintenance badges use a short readable verification date");
assert.doesNotMatch(maintenanceBadge.textContent, /T\d{2}:\d{2}/, "maintenance badges never expose raw ISO timestamps");
assert.ok(curator.document.querySelector(".maintenance-stats [data-trust=\"redirected\"]"), "the curator dashboard summarizes every trust state");
assert.match(curator.document.querySelector(".curator-heading .eyebrow").textContent, /GitHub-backed/i, "the editorial workspace identifies GitHub as its source of truth");
assert.ok(curator.document.querySelector(`[data-maintenance-resource="${thirdId}"] a[href*="content/resources/${thirdId}.json"]`), "maintenance rows link to the published source record");
assert.ok(curator.document.querySelector(`[data-maintenance-resource="${thirdId}"] a[href*="broken-link.yml"]`), "maintenance rows can open a structured GitHub report");
assert.equal(curator.document.querySelectorAll("[data-curator-tab]").length, 3, "catalogue maintenance is divided into three focused tabs");
assert.equal(curator.document.querySelector('#curator-tab-health').getAttribute("aria-selected"), "true", "link health is the initial curator tab");
assert.equal(curator.document.querySelector('#curator-panel-catalogue').hasAttribute("hidden"), true, "inactive curator panels do not lengthen the page");
curator.document.querySelector('#curator-tab-catalogue').click();
assert.equal(curator.location.pathname, "/curator/", "the curator keeps a clean path when changing tabs");
assert.equal(curator.location.search, "?tab=catalogue", "tab selection is reflected in the curator query string");
assert.equal(curator.document.querySelector('#curator-tab-catalogue').getAttribute("aria-selected"), "true", "the selected curator tab is exposed accessibly");
assert.equal(curator.document.querySelector('#curator-panel-catalogue').hasAttribute("hidden"), false, "the selected curator panel is visible");
assert.equal(curator.document.querySelector('#curator-panel-health').hasAttribute("hidden"), true, "the previous curator panel is hidden");
assert.equal(curator.values.get("gaa-curator-tab"), '"catalogue"', "curator tab selection is remembered locally");
assert.ok(curator.document.querySelector(".catalogue-builder"), "the curator workbench includes the catalogue builder");
assert.equal(curator.document.querySelector("#importCatalogueRecords").getAttribute("accept").includes(".csv"), true, "the catalogue builder accepts CSV batches");
assert.ok(curator.document.querySelector("#downloadCatalogueTemplate"), "curators can download the CSV template");
const publishedSource = curator.document.querySelector("#catalogueRecordSource");
publishedSource.querySelectorAll("option").forEach(option => option.toggleAttribute("selected", option.value === firstId));
curator.document.querySelector("#editCatalogueRecord").click();
assert.equal(curator.document.querySelector('#catalogueEditorForm [name="title"]').value, catalogue.resources[0].title, "published records can be copied into the editor");
assert.equal(JSON.parse(curator.values.get("gaa-catalogue-drafts")).length, 1, "catalogue edits are staged locally");
assert.equal(curator.document.querySelector("#exportUpdatedCatalogue").disabled, false, "an unchanged valid published record is ready to export");
const stagedUrl = curator.document.querySelector('#catalogueEditorForm [name="url"]');
stagedUrl.value = catalogue.resources[1].url;
stagedUrl.dispatchEvent(new curator.window.Event("input", { bubbles: true }));
assert.match(curator.document.querySelector("#catalogueValidation").textContent, /URL duplicates/i, "duplicate source URLs are reported before export");
assert.equal(curator.document.querySelector("#exportUpdatedCatalogue").disabled, true, "blocking catalogue errors disable export");
stagedUrl.value = catalogue.resources[0].url;
stagedUrl.dispatchEvent(new curator.window.Event("input", { bubbles: true }));
const stagedTitle = curator.document.querySelector('#catalogueEditorForm [name="title"]');
stagedTitle.value = catalogue.resources[1].title;
stagedTitle.dispatchEvent(new curator.window.Event("input", { bubbles: true }));
assert.match(curator.document.querySelector("#catalogueValidation").textContent, /Title duplicates/i, "duplicate resource titles are also reported");
stagedTitle.value = catalogue.resources[0].title;
stagedTitle.dispatchEvent(new curator.window.Event("input", { bubbles: true }));
const importedRecord = structuredClone(catalogue.resources[0]);
Object.assign(importedRecord, { id: "imported-design-resource", title: "Imported Design Resource", url: "https://example.test/imported-design-resource", featured: false });
const catalogueImport = curator.document.querySelector("#importCatalogueRecords");
Object.defineProperty(catalogueImport, "files", { value: [{ name: "catalogue.json", type: "application/json", text: async () => JSON.stringify({ resources: [importedRecord] }) }] });
catalogueImport.dispatchEvent(new curator.window.Event("change", { bubbles: true }));
await new Promise(resolve => setTimeout(resolve, 0));
assert.equal(JSON.parse(curator.values.get("gaa-catalogue-drafts")).length, 2, "JSON imports add complete resources to the staged catalogue");
assert.match(curator.document.querySelector("#catalogueImportStatus").textContent, /Imported 1 record/i, "imports report a human-readable result");
assert.equal(curator.document.querySelector("#exportUpdatedCatalogue").disabled, false, "valid imported records can be exported with staged edits");
const csvCurator = createLibrary("#/curator");
const csvRecord = { ...structuredClone(importedRecord), id: "csv-design-resource", title: "CSV Design Resource", url: "https://example.test/csv-design-resource", editorialStatus: importedRecord.editorial.status, editorialReviewedAt: importedRecord.editorial.reviewedAt, editorialNote: "" };
delete csvRecord.editorial;
const csvHeaders = Object.keys(csvRecord);
const csvCell = value => { const text = Array.isArray(value) ? value.join("|") : String(value ?? ""); return `"${text.replaceAll('"', '""')}"`; };
const csvText = `${csvHeaders.map(csvCell).join(",")}\n${csvHeaders.map(key => csvCell(csvRecord[key])).join(",")}\n`;
const csvInput = csvCurator.document.querySelector("#importCatalogueRecords");
Object.defineProperty(csvInput, "files", { value: [{ name: "catalogue.csv", type: "text/csv", text: async () => csvText }] });
csvInput.dispatchEvent(new csvCurator.window.Event("change", { bubbles: true }));
await new Promise(resolve => setTimeout(resolve, 0));
assert.equal(JSON.parse(csvCurator.values.get("gaa-catalogue-drafts"))[0].record.title, "CSV Design Resource", "CSV rows are parsed into staged catalogue records");
assert.equal(csvCurator.document.querySelector("#exportUpdatedCatalogue").disabled, false, "complete CSV records pass the same validation as JSON imports");
const rememberedCuratorTab = createLibrary("#/curator", { "gaa-curator-tab": '"suggestions"' });
assert.equal(rememberedCuratorTab.document.querySelector('#curator-tab-suggestions').getAttribute("aria-selected"), "true", "the last curator tab is restored on a later visit");
assert.equal(rememberedCuratorTab.document.querySelector('#curator-panel-suggestions').hasAttribute("hidden"), false, "the remembered curator panel opens directly");
assert.equal(rememberedCuratorTab.document.querySelectorAll(".github-workflow li").length, 4, "the GitHub workflow explains the complete issue-to-deployment path");

const currentTrustCatalogue = structuredClone(catalogue);
currentTrustCatalogue.linkStatus = linkSnapshot;
assert.ok(blowCollection.resources.every(id => linkSnapshot.results.find(item => item.id === id)?.status === "ok"), "every Jonathan Blow collection link is verified as working");
const currentBroken = createLibrary("#/browse?trust=broken&view=list", {}, currentTrustCatalogue);
assert.equal(currentBroken.document.querySelectorAll(".resource-list-item").length, linkSnapshot.summary.broken, "the published trust filter reflects the current full link-check snapshot");

console.log("Index UI checks passed: browsing, queue, guided collections, recommendations, trust filters, GitHub contributions, editorial maintenance, saving and visited markers.");
