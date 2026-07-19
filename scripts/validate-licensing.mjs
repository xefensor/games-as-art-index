import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");
const softwareLicense = read("LICENSE");
const contentLicense = read("CONTENT-LICENSE.md");
const contributing = read("CONTRIBUTING.md");
const packageMetadata = JSON.parse(read("package.json"));
const thumbnails = JSON.parse(read("public/thumbnail-manifest.json"));
const errors = [];

if (packageMetadata.license !== "MIT") errors.push("package.json must identify the software license as MIT");
for (const phrase of ["MIT License", "Permission is hereby granted", "THE SOFTWARE IS PROVIDED \"AS IS\""]) {
  if (!softwareLicense.includes(phrase)) errors.push(`LICENSE is missing the standard MIT clause: ${phrase}`);
}
if (!contentLicense.includes("https://creativecommons.org/licenses/by/4.0/")) errors.push("CONTENT-LICENSE.md must link to CC BY 4.0");
if (!contentLicense.includes("method` set to `generated`")) errors.push("CONTENT-LICENSE.md must identify licensed generated thumbnails");
for (const method of ["catalogue", "youtube", "open-graph"]) if (!contentLicense.includes(`\`${method}\``)) errors.push(`CONTENT-LICENSE.md must exclude ${method} thumbnails`);
if (!/By submitting a contribution[\s\S]*MIT License[\s\S]*CC BY 4\.0/i.test(contributing)) errors.push("CONTRIBUTING.md must state the inbound licensing terms");

const knownThumbnailMethods = new Set(["generated", "catalogue", "youtube", "open-graph"]);
for (const [id, thumbnail] of Object.entries(thumbnails.resources || {})) {
  if (!knownThumbnailMethods.has(thumbnail.method)) errors.push(`${id}: thumbnail method ${thumbnail.method || "(missing)"} has no licensing rule`);
}

if (errors.length) {
  for (const error of errors) console.error(`Error: ${error}`);
  process.exit(1);
}

const generated = Object.values(thumbnails.resources || {}).filter(item => item.method === "generated").length;
const thirdParty = Object.values(thumbnails.resources || {}).length - generated;
console.log(`Licensing valid: MIT software, CC BY 4.0 editorial content, ${generated} generated thumbnails included, ${thirdParty} third-party thumbnails excluded.`);
