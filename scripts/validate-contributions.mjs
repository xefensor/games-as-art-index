import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const labels = JSON.parse(fs.readFileSync(path.join(root, ".github", "labels.json"), "utf8"));
const names = new Set(labels.map(label => label.name));
const errors = [];

if (names.size !== labels.length) errors.push(".github/labels.json contains duplicate names");
for (const label of labels) {
  if (!label.name?.trim()) errors.push("a managed label has no name");
  if (!/^[0-9a-f]{6}$/i.test(label.color || "")) errors.push(`${label.name || "unnamed label"}: color must be six hexadecimal characters`);
  if (!label.description?.trim()) errors.push(`${label.name || "unnamed label"}: description is missing`);
}

const templates = ["resource-suggestion.yml", "broken-link.yml"];
for (const template of templates) {
  const source = fs.readFileSync(path.join(root, ".github", "ISSUE_TEMPLATE", template), "utf8");
  const declared = source.match(/^labels:\s*\[(.*)\]\s*$/m)?.[1]
    ?.split(",")
    .map(value => value.trim().replace(/^['"]|['"]$/g, ""))
    .filter(Boolean) || [];
  if (!declared.length) errors.push(`${template}: no managed label is declared`);
  for (const label of declared) if (!names.has(label)) errors.push(`${template}: label ${label} is not declared in .github/labels.json`);
  if (!/validations:\s*\n\s+required:\s*true/m.test(source)) errors.push(`${template}: no required fields were found`);
}

if (errors.length) {
  for (const error of errors) console.error(`Error: ${error}`);
  process.exit(1);
}
console.log(`Contribution configuration valid: ${templates.length} issue forms, ${labels.length} managed labels.`);
