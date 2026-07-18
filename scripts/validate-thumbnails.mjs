import fs from "node:fs";

const catalogue = JSON.parse(fs.readFileSync(new URL("../public/catalogue.json", import.meta.url), "utf8"));
const manifest = JSON.parse(fs.readFileSync(new URL("../public/thumbnail-manifest.json", import.meta.url), "utf8"));
const errors = [];
const allowedMethods = new Set(["catalogue", "youtube", "open-graph", "generated"]);

if (manifest.schemaVersion !== 1) errors.push("thumbnail manifest schemaVersion must be 1");
if (!manifest.generatedAt || Number.isNaN(Date.parse(manifest.generatedAt))) errors.push("thumbnail manifest generatedAt is invalid");
if (manifest.resourceCount !== catalogue.resources.length) errors.push(`thumbnail manifest expects ${manifest.resourceCount} resources but catalogue has ${catalogue.resources.length}`);
for (const resource of catalogue.resources) {
  const entry = manifest.resources?.[resource.id];
  if (!entry) { errors.push(`${resource.id}: thumbnail manifest entry is missing`); continue; }
  if (!allowedMethods.has(entry.method)) errors.push(`${resource.id}: unknown thumbnail method ${entry.method}`);
  if (!/^\/thumbnails\/[a-z0-9-]+\.webp$/.test(entry.path || "")) errors.push(`${resource.id}: thumbnail path is invalid`);
  const file = new URL(`../public${entry.path}`, import.meta.url);
  if (!fs.existsSync(file)) errors.push(`${resource.id}: thumbnail file is missing`);
  if (!Number.isInteger(entry.width) || !Number.isInteger(entry.height) || entry.width < 480 || entry.height < 270) errors.push(`${resource.id}: thumbnail dimensions are too small`);
  if (!entry.originUrl || !entry.checkedAt) errors.push(`${resource.id}: thumbnail provenance is incomplete`);
  if (entry.method !== "generated" && !entry.sourceUrl) errors.push(`${resource.id}: source thumbnail URL is missing`);
}

if (errors.length) {
  for (const error of errors) console.error(`Error: ${error}`);
  console.error(`Thumbnail validation failed with ${errors.length} error${errors.length === 1 ? "" : "s"}.`);
  process.exit(1);
}
const generated = Object.values(manifest.resources).filter(entry => entry.method === "generated").length;
console.log(`Thumbnails valid: ${catalogue.resources.length}/${catalogue.resources.length} resources covered, ${generated} generated fallbacks.`);
