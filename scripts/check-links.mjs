import fs from "node:fs";

if (process.argv.includes("--help")) {
  console.log("Usage: npm run check:links -- [--limit N] [--timeout MS] [--no-write] [--fail-on-broken]");
  console.log("Checks original URLs. Full checks write reports/link-check-report.json and public/link-status.json.");
  process.exit(0);
}

const catalogue = JSON.parse(fs.readFileSync(new URL("../public/catalogue.json", import.meta.url), "utf8"));
const argument = name => { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : null; };
const limit = Math.max(1, Number(argument("--limit")) || catalogue.resources.length);
const timeout = Math.max(1000, Number(argument("--timeout")) || 12000);
const shouldWrite = !process.argv.includes("--no-write");
const queue = catalogue.resources.slice(0, limit);

async function request(resource) {
  const started = Date.now();
  if (resource.manualLinkStatus?.status === "ok") {
    return {
      id: resource.id,
      title: resource.title,
      url: resource.url,
      finalUrl: resource.url,
      status: "ok",
      httpStatus: null,
      redirected: false,
      checkedAt: `${resource.manualLinkStatus.checkedAt}T12:00:00.000Z`,
      durationMs: 0,
      checkMethod: "manual",
      note: resource.manualLinkStatus.note
    };
  }
  const run = async method => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      return await fetch(resource.url, { method, redirect: "follow", signal: controller.signal, headers: { "User-Agent": "Games-as-Art-Index-Link-Check/1.0" } });
    } finally {
      clearTimeout(timer);
    }
  };
  try {
    let response = await run("HEAD");
    if ([405, 501].includes(response.status)) response = await run("GET");
    const redirected = response.url !== resource.url;
    const status = response.status >= 200 && response.status < 400 ? redirected ? "redirected" : "ok" : [401, 403, 429].includes(response.status) ? "restricted" : "broken";
    return { id: resource.id, title: resource.title, url: resource.url, finalUrl: response.url, status, httpStatus: response.status, redirected, checkedAt: new Date().toISOString(), durationMs: Date.now() - started };
  } catch (error) {
    return { id: resource.id, title: resource.title, url: resource.url, finalUrl: null, status: error.name === "AbortError" ? "timeout" : "network-error", httpStatus: null, redirected: false, checkedAt: new Date().toISOString(), durationMs: Date.now() - started, error: error.message };
  }
}

const results = [];
let cursor = 0;
await Promise.all(Array.from({ length: Math.min(6, queue.length) }, async () => {
  while (cursor < queue.length) {
    const resource = queue[cursor];
    cursor += 1;
    const result = await request(resource);
    results.push(result);
    console.log(`${result.status.padEnd(13)} ${String(result.httpStatus || "-").padEnd(4)} ${result.id}`);
  }
}));

results.sort((a, b) => queue.findIndex(resource => resource.id === a.id) - queue.findIndex(resource => resource.id === b.id));
const summary = Object.fromEntries(["ok", "redirected", "restricted", "broken", "timeout", "network-error"].map(status => [status, results.filter(result => result.status === status).length]));
const normalizedUrls = new Map();
for (const resource of catalogue.resources) {
  const normalized = resource.url.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, "").toLowerCase();
  normalizedUrls.set(normalized, [...(normalizedUrls.get(normalized) || []), resource.id]);
}
const duplicateUrls = [...normalizedUrls.entries()].filter(([, ids]) => ids.length > 1).map(([url, ids]) => ({ url, ids }));
const incompleteMetadata = catalogue.resources.filter(resource => !resource.description || !resource.useful || !resource.lastChecked || !resource.editorial?.reviewedAt).map(resource => resource.id);
const report = { schemaVersion: 1, generatedAt: new Date().toISOString(), resourceCount: results.length, complete: results.length === catalogue.resources.length, summary, audit: { duplicateUrls, incompleteMetadata }, results };
if (shouldWrite) {
  const reportsDirectory = new URL("../reports/", import.meta.url);
  fs.mkdirSync(reportsDirectory, { recursive: true });
  fs.writeFileSync(new URL("link-check-report.json", reportsDirectory), `${JSON.stringify(report, null, 2)}\n`);
  if (report.complete) fs.writeFileSync(new URL("../public/link-status.json", import.meta.url), `${JSON.stringify(report, null, 2)}\n`);
}
console.log(`Checked ${results.length} links: ${summary.ok} ok, ${summary.redirected} redirected, ${summary.restricted} restricted, ${summary.broken} broken, ${summary.timeout} timed out, ${summary["network-error"]} network errors.`);
console.log(`Static audit: ${duplicateUrls.length} duplicate URLs, ${incompleteMetadata.length} incomplete records.`);
if (summary.broken > 0 && process.argv.includes("--fail-on-broken")) process.exitCode = 1;
