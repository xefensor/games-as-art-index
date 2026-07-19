import fs from "node:fs";

const catalogueUrl = new URL("../public/catalogue.json", import.meta.url);
const catalogue = JSON.parse(fs.readFileSync(catalogueUrl, "utf8"));
const linkStatusUrl = new URL("../public/link-status.json", import.meta.url);
const errors = [];
const warnings = [];
const fail = message => errors.push(message);
const warn = message => warnings.push(message);
const isDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value || "") && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
const requiredText = ["id", "type", "title", "creator", "publisher", "length", "access", "level", "description", "useful", "url", "lengthClass", "audience", "lastChecked", "addedAt"];
const requiredArrays = ["topics", "games", "subjects", "relevance", "learning", "next"];
const allowedManualLinkStates = new Set(["ok"]);

if (catalogue.schemaVersion !== 1) fail("schemaVersion must be 1");
if (!isDate(catalogue.updatedAt)) fail("updatedAt must be an ISO date");
if (!isDate(catalogue.editorialAuditAt)) fail("editorialAuditAt must be an ISO date");
if (!Array.isArray(catalogue.resources)) fail("resources must be an array");
if (!Array.isArray(catalogue.collections)) fail("collections must be an array");
if (!catalogue.taxonomy || typeof catalogue.taxonomy !== "object") fail("taxonomy is missing");

const resources = catalogue.resources || [];
const ids = resources.map(resource => resource.id);
const idSet = new Set(ids);
if (idSet.size !== ids.length) fail("resource IDs must be unique");
const normalizedUrls = new Map();

for (const resource of resources) {
  const prefix = resource.id || resource.title || "unnamed resource";
  for (const field of requiredText) if (typeof resource[field] !== "string" || !resource[field].trim()) fail(`${prefix}: ${field} must be non-empty text`);
  for (const field of requiredArrays) if (!Array.isArray(resource[field])) fail(`${prefix}: ${field} must be an array`);
  if (!Number.isInteger(resource.year) || resource.year < 1950 || resource.year > new Date().getUTCFullYear()) fail(`${prefix}: year is outside the accepted range`);
  try { const url = new URL(resource.url); if (!/^https?:$/.test(url.protocol)) fail(`${prefix}: URL must use HTTP or HTTPS`); } catch { fail(`${prefix}: URL is invalid`); }
  const normalizedUrl = resource.url.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, "").toLowerCase();
  if (normalizedUrls.has(normalizedUrl)) fail(`${prefix}: URL duplicates ${normalizedUrls.get(normalizedUrl)}`); else normalizedUrls.set(normalizedUrl, prefix);
  if (!isDate(resource.lastChecked)) fail(`${prefix}: lastChecked must be an ISO date`);
  if (!isDate(resource.addedAt)) fail(`${prefix}: addedAt must be an ISO date`);
  if (resource.manualLinkStatus) {
    if (!allowedManualLinkStates.has(resource.manualLinkStatus.status)) fail(`${prefix}: manualLinkStatus has an invalid status`);
    if (!isDate(resource.manualLinkStatus.checkedAt)) fail(`${prefix}: manualLinkStatus checkedAt must be an ISO date`);
    if (typeof resource.manualLinkStatus.note !== "string" || !resource.manualLinkStatus.note.trim()) fail(`${prefix}: manualLinkStatus needs an editorial note`);
  }
  if (resource.embed) {
    if (resource.embed.provider === "pdf") {
      try {
        const embedUrl = new URL(resource.embed.url);
        if (embedUrl.protocol !== "https:" || !embedUrl.pathname.toLowerCase().endsWith(".pdf")) fail(`${prefix}: PDF embed must use a direct HTTPS PDF URL`);
      } catch { fail(`${prefix}: embed URL is invalid`); }
    } else if (resource.embed.provider === "youtube") {
      if (!/^[A-Za-z0-9_-]{11}$/.test(resource.embed.videoId || "")) fail(`${prefix}: YouTube embed needs a valid video ID`);
      if (typeof resource.embed.source !== "string" || !resource.embed.source.trim()) fail(`${prefix}: YouTube embed needs an identified source channel`);
    } else fail(`${prefix}: embed provider is not supported`);
  }
  if (!catalogue.taxonomy.levels?.includes(resource.level)) fail(`${prefix}: unknown level ${resource.level}`);
  if (!catalogue.taxonomy.access?.includes(resource.access)) fail(`${prefix}: unknown access type ${resource.access}`);
  if (!catalogue.taxonomy.lengths?.includes(resource.lengthClass)) fail(`${prefix}: unknown length class ${resource.lengthClass}`);
  for (const subject of resource.subjects || []) if (!catalogue.taxonomy.subjects?.includes(subject)) fail(`${prefix}: unknown subject ${subject}`);
  for (const relevance of resource.relevance || []) if (!catalogue.taxonomy.relevance?.includes(relevance)) fail(`${prefix}: unknown relevance ${relevance}`);
  if (resource.learning?.length !== 3) fail(`${prefix}: learning must contain exactly three outcomes`);
  if (resource.next?.length !== 3) fail(`${prefix}: next must contain exactly three resource IDs`);
  for (const nextId of resource.next || []) if (!idSet.has(nextId)) fail(`${prefix}: related resource ${nextId} does not exist`);
  if (!resource.editorial || !catalogue.editorialStatuses?.includes(resource.editorial.status)) fail(`${prefix}: editorial status is invalid`);
  if (!isDate(resource.editorial?.reviewedAt)) fail(`${prefix}: editorial reviewedAt must be an ISO date`);
  if (resource.description?.length < 80) warn(`${prefix}: description is unusually short`);
  if (resource.useful?.length < 45) warn(`${prefix}: usefulness annotation is unusually short`);
}

const collectionIds = new Set();
for (const collection of catalogue.collections || []) {
  if (!collection.id || collectionIds.has(collection.id)) fail(`collection ID is missing or duplicated: ${collection.id || "unnamed"}`);
  collectionIds.add(collection.id);
  if (!collection.title || !collection.description || !collection.color) fail(`${collection.id}: collection metadata is incomplete`);
  if (!Array.isArray(collection.resources) || collection.resources.length < 3) fail(`${collection.id}: collection needs at least three resources`);
  for (const resourceId of collection.resources || []) if (!idSet.has(resourceId)) fail(`${collection.id}: resource ${resourceId} does not exist`);
}

if (fs.existsSync(linkStatusUrl)) {
  const linkStatus = JSON.parse(fs.readFileSync(linkStatusUrl, "utf8"));
  const allowedLinkStates = new Set(["ok", "redirected", "restricted", "broken", "timeout", "network-error"]);
  if (linkStatus.schemaVersion !== 1 || !Array.isArray(linkStatus.results)) fail("link-status.json has an invalid schema");
  const resultIds = new Set();
  for (const result of linkStatus.results || []) {
    if (!idSet.has(result.id)) fail(`link-status.json references unknown resource ${result.id}`);
    if (resultIds.has(result.id)) fail(`link-status.json duplicates resource ${result.id}`);
    resultIds.add(result.id);
    if (!allowedLinkStates.has(result.status)) fail(`link-status.json has unknown state ${result.status} for ${result.id}`);
    if (!result.checkedAt || Number.isNaN(Date.parse(result.checkedAt))) fail(`link-status.json has an invalid checkedAt for ${result.id}`);
  }
  if (linkStatus.complete && resultIds.size !== resources.length) warn(`link-status.json covers ${resultIds.size} of ${resources.length} resources; missing records will appear as needs rechecking`);
}

for (const warning of warnings) console.warn(`Warning: ${warning}`);
if (errors.length) {
  for (const error of errors) console.error(`Error: ${error}`);
  console.error(`Catalogue validation failed with ${errors.length} error${errors.length === 1 ? "" : "s"}.`);
  process.exit(1);
}
console.log(`Catalogue valid: ${resources.length} resources, ${catalogue.collections.length} collections, ${warnings.length} warnings.`);
