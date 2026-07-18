import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "pages-dist");
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");
const write = (relativePath, content) => {
  const target = path.join(output, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
};

fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });

const index = read("index.html")
  .replace('href="/styles.css"', 'href="./styles.css"')
  .replace('src="/data.js?', 'src="./data.js?')
  .replace('src="/app.js?', 'src="./app.js?');
const data = read("public/data.js")
  .replaceAll('fetch("/', 'fetch("./');
const app = read("public/app.js")
  .replaceAll('`/thumbnails/', '`./thumbnails/')
  .replaceAll('href="/link-status.json"', 'href="./link-status.json"');
const thumbnailManifest = JSON.parse(read("public/thumbnail-manifest.json"));
for (const entry of Object.values(thumbnailManifest.resources || {})) {
  if (entry.path?.startsWith("/")) entry.path = `.${entry.path}`;
}

write("index.html", index);
write("404.html", index);
write("styles.css", read("styles.css"));
write("data.js", data);
write("app.js", app);
write("catalogue.json", read("public/catalogue.json"));
write("link-status.json", read("public/link-status.json"));
write("thumbnail-manifest.json", `${JSON.stringify(thumbnailManifest, null, 2)}\n`);
write(".nojekyll", "");
fs.cpSync(path.join(root, "public", "thumbnails"), path.join(output, "thumbnails"), { recursive: true });

const required = ["index.html", "404.html", "styles.css", "data.js", "app.js", "catalogue.json", "link-status.json", "thumbnail-manifest.json", ".nojekyll"];
for (const relativePath of required) {
  if (!fs.existsSync(path.join(output, relativePath))) throw new Error(`GitHub Pages build is missing ${relativePath}`);
}
const rootRelativeMistakes = [
  ["index.html", /(?:href|src)="\/(?:styles\.css|data\.js|app\.js)/],
  ["data.js", /fetch\("\/(?:catalogue|link-status|thumbnail-manifest)\.json/],
  ["app.js", /["'`]\/thumbnails\//],
  ["thumbnail-manifest.json", /"path": "\/thumbnails\//]
];
for (const [relativePath, pattern] of rootRelativeMistakes) {
  const content = fs.readFileSync(path.join(output, relativePath), "utf8");
  if (pattern.test(content)) throw new Error(`${relativePath} contains a root-relative asset path that will break on GitHub Pages`);
}
const thumbnails = fs.readdirSync(path.join(output, "thumbnails")).filter(name => name.endsWith(".webp"));
if (thumbnails.length !== Object.keys(thumbnailManifest.resources || {}).length) throw new Error("GitHub Pages thumbnail output is incomplete");

console.log(`Built GitHub Pages artifact: ${thumbnails.length} thumbnails and ${required.length} root files.`);
