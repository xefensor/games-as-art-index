import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "pages-dist");
const canonicalBase = "https://xefensor.github.io/games-as-art-index/";
const pagesBasePath = "/games-as-art-index/";
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");
const write = (relativePath, content) => {
  const target = path.join(output, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
};
const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
const sourceHost = resource => {
  try { return new URL(resource.url).hostname.replace(/^www\./, ""); }
  catch { return ""; }
};
const routePath = route => route === "/" ? "" : `${route.replace(/^\/+|\/+$/g, "")}/`;
const canonicalUrl = route => new URL(routePath(route), canonicalBase).href;
const routeFile = route => route === "/" ? "index.html" : `${routePath(route)}index.html`;
const relativeRoot = file => {
  const directory = path.posix.dirname(file);
  const depth = directory === "." ? 0 : directory.split("/").length;
  return depth ? "../".repeat(depth) : "./";
};
const relativeRoute = (file, route) => {
  const from = path.posix.dirname(file);
  const target = routePath(route).replace(/\/$/, "") || ".";
  const relative = path.posix.relative(from, target) || ".";
  return `${relative.startsWith(".") ? relative : `./${relative}`}/`;
};

fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });

const template = read("index.html");
const catalogue = JSON.parse(read("public/catalogue.json"));
const thumbnailManifest = JSON.parse(read("public/thumbnail-manifest.json"));

function prepareHtml({ file, route, title, description, main, image, jsonLd, absoluteBase = "" }) {
  const assets = absoluteBase || relativeRoot(file);
  const internalRoute = target => absoluteBase ? `${absoluteBase}${routePath(target)}` : relativeRoute(file, target);
  const canonical = canonicalUrl(route);
  const socialImage = image ? new URL(image.replace(/^\//, ""), canonicalBase).href : new URL("thumbnails/doom-postmortem.webp", canonicalBase).href;
  const metadata = `    <link rel="canonical" href="${escapeHtml(canonical)}">
    <meta property="og:type" content="${route.startsWith("/resource/") ? "article" : "website"}">
    <meta property="og:title" content="${escapeHtml(title)}">
    <meta property="og:description" content="${escapeHtml(description)}">
    <meta property="og:url" content="${escapeHtml(canonical)}">
    <meta property="og:image" content="${escapeHtml(socialImage)}">
    <meta name="twitter:card" content="summary_large_image">${jsonLd ? `
    <script type="application/ld+json">${JSON.stringify(jsonLd).replaceAll("<", "\\u003c")}</script>` : ""}`;
  return template
    .replace('<meta name="description" content="A curated index of game development, history, and criticism.">', `<meta name="description" content="${escapeHtml(description)}">`)
    .replace('<meta name="gaa-site-root" content="/">', `<meta name="gaa-site-root" content="${assets}">`)
    .replace("<title>Games as Art Index — Game development, history, and criticism</title>", `<title>${escapeHtml(title)}</title>`)
    .replace("  </head>", `${metadata}\n  </head>`)
    .replace(/<main id="content" tabindex="-1" aria-live="polite">[\s\S]*?<\/main>/, `<main id="content" tabindex="-1" aria-live="polite">${main}</main>`)
    .replace('href="/styles.css"', `href="${assets}styles.css"`)
    .replace('src="/data.js?', `src="${assets}data.js?`)
    .replace('src="/app.js?', `src="${assets}app.js?`)
    .replace(/href="\/[^"]*" data-index-route="([^"]+)"/g, (_match, target) => `href="${internalRoute(target)}" data-index-route="${target}"`)
    .replaceAll('src="/thumbnails/', `src="${assets}thumbnails/`);
}

const pageFallback = (eyebrow, heading, description) => `<section class="fallback-hero shell"><span class="eyebrow">${escapeHtml(eyebrow)}</span><h1>${escapeHtml(heading)}</h1><p>${escapeHtml(description)}</p><div class="fallback-loading" role="status"><span></span> Opening the Index…</div></section>`;
const homeMain = template.match(/<main id="content" tabindex="-1" aria-live="polite">([\s\S]*?)<\/main>/)?.[1] || pageFallback("Curated resources", "Games as Art Index", "A curated index of game development, history, and criticism.");

const primaryPages = [
  { route: "/", title: "Games as Art Index — Game development, history, and criticism", eyebrow: "Curated game-development resources", heading: "Find the useful thing someone already made.", description: "A curated index of game development, history, and criticism.", main: homeMain },
  { route: "/browse", title: "Browse — Games as Art Index", eyebrow: "Complete catalogue", heading: "Browse game-development knowledge.", description: "Search and filter talks, books, articles, papers, guides, documentation, courses, interviews, and archives." },
  { route: "/collections", title: "Collections — Games as Art Index", eyebrow: "Guided paths", heading: "Start with a curated collection.", description: "Follow focused routes through game design, history, audio, programming, criticism, accessibility, narrative, and individual creators." },
  { route: "/saved", title: "Saved — Games as Art Index", eyebrow: "Stored on this device", heading: "Your learning queue.", description: "Return to resources you want to explore, are currently studying, or have finished." },
  { route: "/suggest", title: "Contribute — Games as Art Index", eyebrow: "Contribute through GitHub", heading: "Choose the smallest useful contribution.", description: "Suggest a resource, report a catalogue problem, or propose an exact correction through the public GitHub workflow." },
  { route: "/about", title: "About — Games as Art Index", eyebrow: "About the Index", heading: "A map to existing knowledge—not another authority.", description: "Learn what the Index includes, how resources are classified, and how editorial review works." },
  { route: "/curator", title: "Editorial workspace — Games as Art Index", eyebrow: "GitHub-backed maintenance", heading: "Maintain the public catalogue.", description: "Inspect deployed link health and prepare structured catalogue changes for GitHub review." }
];

for (const page of primaryPages) {
  const file = routeFile(page.route);
  write(file, prepareHtml({ ...page, file, main: page.main || pageFallback(page.eyebrow, page.heading, page.description) }));
}

for (const resource of catalogue.resources) {
  const route = `/resource/${resource.id}`;
  const file = routeFile(route);
  const thumbnail = thumbnailManifest.resources?.[resource.id]?.path || `/thumbnails/${resource.id}.webp`;
  const main = `<article class="resource-page shell"><p class="breadcrumb"><a href="/browse/" data-index-route="/browse">Browse</a> / ${escapeHtml(resource.type)}</p><div class="resource-hero"><div class="resource-cover cover-large has-image"><img src="${escapeHtml(thumbnail)}" alt="${escapeHtml(resource.type === "Book" ? `Cover of ${resource.title}` : `Thumbnail for ${resource.title}`)}"></div><div class="resource-intro"><div class="card-kicker"><span>${escapeHtml(resource.type)}</span><span>${escapeHtml(resource.access)}</span><span>${escapeHtml(resource.level)}</span></div><h1>${escapeHtml(resource.title)}</h1><p class="resource-byline"><span>By ${escapeHtml(resource.creator)} · ${resource.year}</span><span>Source: ${escapeHtml(resource.publisher)}${sourceHost(resource) ? ` · ${escapeHtml(sourceHost(resource))}` : ""}</span></p><p class="resource-description">${escapeHtml(resource.description)}</p><div class="resource-actions"><a class="primary-action" href="${escapeHtml(resource.url)}">Open original resource ↗</a></div></div></div><section class="resource-detail-grid"><div><span class="eyebrow">Why it is useful</span><p>${escapeHtml(resource.useful)}</p></div><div class="useful-note"><span class="eyebrow">Best for</span><p>${escapeHtml(resource.audience)}</p></div></section></article>`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LearningResource",
    name: resource.title,
    description: resource.description,
    url: canonicalUrl(route),
    sameAs: resource.url,
    creator: { "@type": "Person", name: resource.creator },
    publisher: { "@type": "Organization", name: resource.publisher },
    datePublished: String(resource.year),
    isAccessibleForFree: resource.access === "Free",
    educationalLevel: resource.level,
    keywords: [...resource.subjects, ...resource.topics, ...resource.games].join(", ")
  };
  write(file, prepareHtml({ file, route, title: `${resource.title} — Games as Art Index`, description: resource.description, main, image: thumbnail, jsonLd }));
}

for (const collection of catalogue.collections) {
  const route = `/collection/${collection.id}`;
  const file = routeFile(route);
  const items = collection.resources.map(id => catalogue.resources.find(resource => resource.id === id)).filter(Boolean);
  const main = `<section class="collection-page shell" data-color="${escapeHtml(collection.color)}"><p class="breadcrumb"><a href="/collections/" data-index-route="/collections">Collections</a> / ${escapeHtml(collection.title)}</p><header class="collection-hero"><div><span class="eyebrow">Guided collection · ${items.length} resources</span><h1>${escapeHtml(collection.title)}</h1><p>${escapeHtml(collection.description)}</p></div></header><div class="sequence-heading"><div><span class="eyebrow">Suggested order</span><h2>Work through the collection</h2></div></div><ol class="collection-sequence">${items.map((resource, index) => `<li><span>${String(index + 1).padStart(2, "0")}</span><article class="resource-card"><a class="card-main" href="/resource/${resource.id}/" data-index-route="/resource/${resource.id}"><div class="card-copy"><div class="card-kicker"><span>${escapeHtml(resource.type)}</span><span>${escapeHtml(resource.access)}</span><span>${escapeHtml(resource.length)}</span></div><h3>${escapeHtml(resource.title)}</h3><p class="card-credit">By ${escapeHtml(resource.creator)} · ${resource.year}</p><p class="card-source"><span>Source</span><strong>${escapeHtml(resource.publisher)}</strong>${sourceHost(resource) ? `<small>${escapeHtml(sourceHost(resource))}</small>` : ""}</p><p>${escapeHtml(resource.description)}</p></div></a></article></li>`).join("")}</ol></section>`;
  const jsonLd = { "@context": "https://schema.org", "@type": "ItemList", name: collection.title, description: collection.description, url: canonicalUrl(route), itemListElement: items.map((resource, index) => ({ "@type": "ListItem", position: index + 1, name: resource.title, url: canonicalUrl(`/resource/${resource.id}`) })) };
  write(file, prepareHtml({ file, route, title: `${collection.title} — Games as Art Index`, description: collection.description, main, image: thumbnailManifest.resources?.[items[0]?.id]?.path, jsonLd }));
}

const notFoundMain = pageFallback("Page not found", "This Index page does not exist.", "Use Browse or Collections to find a published resource.");
write("404.html", prepareHtml({ file: "404.html", route: "/", title: "Page not found — Games as Art Index", description: "The requested Games as Art Index page does not exist.", main: notFoundMain, absoluteBase: pagesBasePath }));
write("styles.css", read("styles.css"));
write("data.js", read("public/data.js"));
write("app.js", read("public/app.js"));
write("catalogue.json", read("public/catalogue.json"));
write("link-status.json", read("public/link-status.json"));
write("thumbnail-manifest.json", read("public/thumbnail-manifest.json"));
write(".nojekyll", "");
fs.cpSync(path.join(root, "public", "thumbnails"), path.join(output, "thumbnails"), { recursive: true });

const publicRoutes = [...primaryPages.filter(page => !["/saved", "/curator"].includes(page.route)).map(page => page.route), ...catalogue.resources.map(resource => `/resource/${resource.id}`), ...catalogue.collections.map(collection => `/collection/${collection.id}`)];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${publicRoutes.map(route => `  <url><loc>${escapeHtml(canonicalUrl(route))}</loc></url>`).join("\n")}\n</urlset>\n`;
write("sitemap.xml", sitemap);
write("robots.txt", `User-agent: *\nAllow: /\nSitemap: ${canonicalBase}sitemap.xml\n`);

const required = ["index.html", "404.html", "browse/index.html", "collections/index.html", "styles.css", "data.js", "app.js", "catalogue.json", "link-status.json", "thumbnail-manifest.json", "sitemap.xml", "robots.txt", ".nojekyll"];
for (const relativePath of required) if (!fs.existsSync(path.join(output, relativePath))) throw new Error(`GitHub Pages build is missing ${relativePath}`);
for (const resource of catalogue.resources) if (!fs.existsSync(path.join(output, routeFile(`/resource/${resource.id}`)))) throw new Error(`GitHub Pages build is missing resource route ${resource.id}`);
for (const collection of catalogue.collections) if (!fs.existsSync(path.join(output, routeFile(`/collection/${collection.id}`)))) throw new Error(`GitHub Pages build is missing collection route ${collection.id}`);

const resourceSample = read("pages-dist/resource/doom-postmortem/index.html");
if (!resourceSample.includes("../../styles.css") || !resourceSample.includes('<meta name="gaa-site-root" content="../../">')) throw new Error("Nested resource assets are not relative to the Pages root");
if (!resourceSample.includes('src="../../thumbnails/doom-postmortem.webp"') || !resourceSample.includes('href="../../browse/" data-index-route="/browse"')) throw new Error("Nested resource fallback content is not relative to the Pages root");
if (!resourceSample.includes("Source: Game Developer / GDC · gamedeveloper.com")) throw new Error("Resource fallback source attribution is incomplete");
if (!resourceSample.includes(`${canonicalBase}resource/doom-postmortem/`) || !resourceSample.includes('type="application/ld+json"')) throw new Error("Resource route metadata is incomplete");
const thumbnails = fs.readdirSync(path.join(output, "thumbnails")).filter(name => name.endsWith(".webp"));
if (thumbnails.length !== Object.keys(thumbnailManifest.resources || {}).length) throw new Error("GitHub Pages thumbnail output is incomplete");

console.log(`Built GitHub Pages artifact: ${catalogue.resources.length} resource pages, ${catalogue.collections.length} collection pages, ${primaryPages.length} primary pages, and ${thumbnails.length} thumbnails.`);
