import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contentRoot = path.join(root, "content");
const manifestPath = path.join(contentRoot, "catalogue.json");
const resourcesPath = path.join(contentRoot, "resources");
const collectionsPath = path.join(contentRoot, "collections");
const outputPath = path.join(root, "public", "catalogue.json");
const checkOnly = process.argv.includes("--check");

const readJson = filePath => JSON.parse(fs.readFileSync(filePath, "utf8"));
const readRecordDirectory = directory => Object.fromEntries(
  fs.readdirSync(directory)
    .filter(name => name.endsWith(".json"))
    .sort()
    .map(name => {
      const record = readJson(path.join(directory, name));
      if (`${record.id}.json` !== name) throw new Error(`${path.relative(root, directory)}/${name}: filename must match record id ${record.id || "(missing)"}`);
      return [record.id, record];
    })
);
const orderedRecords = (records, order, label) => {
  if (!Array.isArray(order)) throw new Error(`${label}Order must be an array`);
  const ordered = order.map(id => {
    const record = records[id];
    if (!record) throw new Error(`${label}Order references missing record ${id}`);
    return record;
  });
  const omitted = Object.keys(records).filter(id => !order.includes(id));
  if (omitted.length) throw new Error(`${label}Order omits ${omitted.join(", ")}`);
  if (new Set(order).size !== order.length) throw new Error(`${label}Order contains duplicate ids`);
  return ordered;
};

const manifest = readJson(manifestPath);
const resources = orderedRecords(readRecordDirectory(resourcesPath), manifest.resourceOrder, "resource");
const collections = orderedRecords(readRecordDirectory(collectionsPath), manifest.collectionOrder, "collection");
const { resourceOrder, collectionOrder, ...catalogueMetadata } = manifest;
const catalogue = { ...catalogueMetadata, collections, resources };
const serialized = `${JSON.stringify(catalogue, null, 2)}\n`;

if (checkOnly) {
  const current = fs.existsSync(outputPath) ? fs.readFileSync(outputPath, "utf8") : "";
  if (current !== serialized) {
    console.error("public/catalogue.json is stale. Run npm run catalogue:build and commit the result.");
    process.exit(1);
  }
  console.log(`Catalogue source is synchronized: ${resources.length} resources, ${collections.length} collections.`);
} else {
  fs.writeFileSync(outputPath, serialized);
  console.log(`Built public/catalogue.json from ${resources.length} resources and ${collections.length} collections.`);
}
