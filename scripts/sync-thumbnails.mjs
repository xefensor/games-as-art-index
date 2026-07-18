import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const cataloguePath = path.join(root, "public", "catalogue.json");
const outputDirectory = path.join(root, "public", "thumbnails");
const manifestPath = path.join(root, "public", "thumbnail-manifest.json");
const refresh = process.argv.includes("--refresh");
const selectedId = (() => { const index = process.argv.indexOf("--id"); return index >= 0 ? process.argv[index + 1] : ""; })();
const catalogue = JSON.parse(await fs.readFile(cataloguePath, "utf8"));
const previousManifest = await fs.readFile(manifestPath, "utf8").then(JSON.parse).catch(() => ({ resources: {} }));
await fs.mkdir(outputDirectory, { recursive: true });

const palettes = [
  ["#222a35", "#e05a43", "#f2eadb"],
  ["#243229", "#d9a441", "#f0eadc"],
  ["#30263b", "#e1694d", "#f2e9dc"],
  ["#18303a", "#d8a84e", "#edf0e7"],
  ["#352824", "#e2694f", "#f1e9dc"]
];
const userAgent = "Games-as-Art-Index-Thumbnail-Curator/1.0";
const escapeXml = value => String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character]);
const hash = value => [...String(value)].reduce((total, character) => (total * 31 + character.charCodeAt(0)) >>> 0, 0);
const youtubeId = value => String(value || "").match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/)?.[1] || "";
const isLocalImage = value => /^\/thumbnails\/[a-z0-9-]+\.webp$/i.test(value || "");
const isGenericSourceImage = value => /\/(?:default-cubic|open-graph-image)\.(?:png|jpe?g|webp)(?:[?#]|$)/i.test(value || "");
const dateOnly = () => new Date().toISOString().slice(0, 10);

function wrapTitle(title, limit, maximumLines) {
  const words = String(title).split(/\s+/);
  const lines = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length <= limit || !line) line = candidate;
    else { lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  if (lines.length > maximumLines) {
    const visible = lines.slice(0, maximumLines);
    visible[maximumLines - 1] = `${visible[maximumLines - 1].replace(/[.,;:!?-]+$/, "")}…`;
    return visible;
  }
  return lines;
}

function generatedCover(resource) {
  const portrait = resource.type === "Book";
  const width = portrait ? 720 : 960;
  const height = portrait ? 960 : 540;
  const [background, accent, text] = palettes[hash(resource.id) % palettes.length];
  const titleLines = wrapTitle(resource.title, portrait ? 20 : 28, portrait ? 5 : 3);
  const titleSize = portrait ? 58 : 55;
  const titleStart = portrait ? 250 : 188;
  const titleGap = portrait ? 68 : 62;
  const circles = Array.from({ length: 7 }, (_, index) => `<circle cx="${width - 60 - index * 44}" cy="${80 + index * 24}" r="${140 - index * 12}" fill="none" stroke="${accent}" stroke-opacity="${Math.max(.08, .28 - index * .03)}" stroke-width="2"/>`).join("");
  const lines = titleLines.map((line, index) => `<text x="58" y="${titleStart + index * titleGap}" fill="${text}" font-family="Georgia, serif" font-size="${titleSize}" font-weight="500">${escapeXml(line)}</text>`).join("");
  return {
    width,
    height,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="${background}"/>${circles}<rect x="58" y="54" width="8" height="72" fill="${accent}"/><rect x="73" y="68" width="8" height="58" fill="${accent}"/><rect x="88" y="82" width="8" height="44" fill="${accent}"/><text x="118" y="83" fill="${accent}" font-family="Arial, sans-serif" font-size="18" font-weight="700" letter-spacing="3">${escapeXml(resource.type.toUpperCase())}</text><text x="118" y="112" fill="${text}" fill-opacity=".62" font-family="Arial, sans-serif" font-size="15" letter-spacing="1">GAMES AS ART INDEX</text>${lines}<line x1="58" x2="${width - 58}" y1="${height - 112}" y2="${height - 112}" stroke="${text}" stroke-opacity=".25"/><text x="58" y="${height - 72}" fill="${text}" font-family="Arial, sans-serif" font-size="18" font-weight="600">${escapeXml(resource.creator)}</text><text x="58" y="${height - 42}" fill="${text}" fill-opacity=".62" font-family="Arial, sans-serif" font-size="15">${escapeXml(resource.publisher)} · ${resource.year}</text></svg>`
  };
}

async function fetchWithTimeout(url, options = {}, timeout = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { redirect: "follow", ...options, signal: controller.signal, headers: { "User-Agent": userAgent, ...(options.headers || {}) } });
  } finally {
    clearTimeout(timer);
  }
}

function metaAttributes(tag) {
  const attributes = {};
  for (const match of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) attributes[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? "";
  return attributes;
}

async function discoverPageImage(resource) {
  if (/\.pdf(?:$|[?#])/i.test(resource.url)) return null;
  const response = await fetchWithTimeout(resource.url, { headers: { Accept: "text/html,application/xhtml+xml" } });
  if (!response.ok) throw new Error(`page returned ${response.status}`);
  const contentType = response.headers.get("content-type") || "";
  if (!/html|xhtml/i.test(contentType)) return null;
  const html = (await response.text()).slice(0, 1500000);
  const candidates = [];
  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    const attributes = metaAttributes(tag);
    const property = (attributes.property || attributes.name || "").toLowerCase();
    if (["og:image", "og:image:url", "twitter:image", "twitter:image:src"].includes(property) && attributes.content) candidates.push(attributes.content.replaceAll("&amp;", "&"));
  }
  for (const candidate of candidates) {
    try {
      const resolved = new URL(candidate, response.url).href;
      if (isGenericSourceImage(resolved)) continue;
      return resolved;
    } catch {}
  }
  return null;
}

async function sourceCandidate(resource, previous) {
  if (previous?.sourceUrl && previous.method !== "generated" && !isGenericSourceImage(previous.sourceUrl)) return { url: previous.sourceUrl, method: previous.method };
  if (resource.image && !isLocalImage(resource.image)) return { url: resource.image, method: "catalogue" };
  const videoId = resource.embed?.provider === "youtube" ? resource.embed.videoId : youtubeId(resource.url);
  if (videoId) return { url: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`, method: "youtube" };
  const pageImage = await discoverPageImage(resource);
  return pageImage ? { url: pageImage, method: "open-graph" } : null;
}

async function writeSourceImage(resource, candidate, destination) {
  const response = await fetchWithTimeout(candidate.url, { headers: { Accept: "image/avif,image/webp,image/png,image/jpeg,image/*" } });
  if (!response.ok) throw new Error(`image returned ${response.status}`);
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.startsWith("image/")) throw new Error(`image source returned ${contentType || "an unknown content type"}`);
  const declaredSize = Number(response.headers.get("content-length") || 0);
  if (declaredSize > 12_000_000) throw new Error("image exceeds 12 MB");
  const input = Buffer.from(await response.arrayBuffer());
  if (input.length > 12_000_000) throw new Error("image exceeds 12 MB");
  const metadata = await sharp(input, { failOn: "error" }).metadata();
  if (!metadata.width || !metadata.height || metadata.width < 240 || metadata.height < 120) throw new Error("image is too small");
  const portrait = resource.type === "Book";
  const width = portrait ? 720 : 960;
  const height = portrait ? 960 : 540;
  const pipeline = sharp(input, { failOn: "error" }).rotate().resize({ width, height, fit: portrait ? "contain" : "cover", position: portrait ? "centre" : sharp.strategy.attention, background: "#d8d2c7", withoutEnlargement: false }).webp({ quality: 82, effort: 5 });
  const info = await pipeline.toFile(destination);
  return { width: info.width, height: info.height, bytes: info.size, sourceWidth: metadata.width, sourceHeight: metadata.height };
}

async function writeGeneratedImage(resource, destination) {
  const cover = generatedCover(resource);
  const info = await sharp(Buffer.from(cover.svg)).webp({ quality: 88, effort: 5 }).toFile(destination);
  return { width: info.width, height: info.height, bytes: info.size };
}

async function processResource(resource) {
  const previous = previousManifest.resources?.[resource.id];
  const destination = path.join(outputDirectory, `${resource.id}.webp`);
  if (!refresh && previous && await fs.access(destination).then(() => true).catch(() => false)) return previous;
  let candidate = null;
  let failure = "";
  try {
    candidate = await sourceCandidate(resource, previous);
    if (candidate) {
      const dimensions = await writeSourceImage(resource, candidate, destination);
      console.log(`${candidate.method.padEnd(11)} ${resource.id}`);
      return { path: `/thumbnails/${resource.id}.webp`, method: candidate.method, sourceUrl: candidate.url, originUrl: resource.url, checkedAt: dateOnly(), ...dimensions };
    }
    failure = "No representative source image was published.";
  } catch (error) {
    failure = error.name === "AbortError" ? "Source image request timed out." : error.message;
  }
  const dimensions = await writeGeneratedImage(resource, destination);
  console.log(`${"generated".padEnd(11)} ${resource.id}${failure ? ` · ${failure}` : ""}`);
  return { path: `/thumbnails/${resource.id}.webp`, method: "generated", sourceUrl: "", originUrl: resource.url, checkedAt: dateOnly(), note: failure, ...dimensions };
}

const resources = {};
let cursor = 0;
const queue = selectedId ? catalogue.resources.filter(resource => resource.id === selectedId) : catalogue.resources;
if (selectedId && !queue.length) throw new Error(`Unknown resource ID: ${selectedId}`);
await Promise.all(Array.from({ length: Math.min(5, queue.length) }, async () => {
  while (cursor < queue.length) {
    const resource = queue[cursor++];
    resources[resource.id] = await processResource(resource);
  }
}));
for (const resource of catalogue.resources) if (!resources[resource.id] && previousManifest.resources?.[resource.id]) resources[resource.id] = previousManifest.resources[resource.id];
const orderedResources = Object.fromEntries(catalogue.resources.filter(resource => resources[resource.id]).map(resource => [resource.id, resources[resource.id]]));
const methods = ["catalogue", "youtube", "open-graph", "generated"];
const manifest = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  resourceCount: catalogue.resources.length,
  summary: Object.fromEntries(methods.map(method => [method, Object.values(orderedResources).filter(entry => entry.method === method).length])),
  resources: orderedResources
};
await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Thumbnail coverage: ${Object.keys(orderedResources).length}/${catalogue.resources.length}. ${manifest.summary.generated} generated fallbacks.`);
