import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
const catalogue = read("public/catalogue.json");
const links = read("public/link-status.json");
const thumbnails = read("public/thumbnail-manifest.json");
const outputPath = path.join(root, "reports", "editorial-audit.json");
const checkOnly = process.argv.includes("--check");
const linkById = new Map(links.results.map(result => [result.id, result]));
const collectionsByResource = new Map();
for (const collection of catalogue.collections) {
  for (const id of collection.resources) {
    const memberships = collectionsByResource.get(id) || [];
    memberships.push(collection.id);
    collectionsByResource.set(id, memberships);
  }
}

const resources = catalogue.resources.map(resource => {
  const link = linkById.get(resource.id);
  const thumbnail = thumbnails.resources[resource.id];
  const manualSourceCheck = link?.checkMethod === "manual";
  const sourceConfirmed = link?.status === "ok";
  const sourceImage = thumbnail?.method !== "generated";
  const priority = !sourceConfirmed ? "high" : resource.featured && !sourceImage ? "high" : !sourceImage ? "medium" : "low";
  const collectionIds = collectionsByResource.get(resource.id) || [];
  return {
    id: resource.id,
    title: resource.title,
    editorialStatus: resource.editorial.status,
    reviewedAt: resource.editorial.reviewedAt,
    sourceCheck: manualSourceCheck ? "manual" : sourceConfirmed ? "automated" : "needs-review",
    sourceStatus: link?.status || "missing",
    thumbnailEvidence: sourceImage ? thumbnail.method : "generated",
    featured: Boolean(resource.featured),
    curation: collectionIds.length ? "guided-path" : "catalogue-only",
    collectionIds,
    editorialNote: resource.editorial.note,
    priority
  };
});

const count = predicate => resources.filter(predicate).length;
const audit = {
  schemaVersion: 1,
  catalogueUpdatedAt: catalogue.updatedAt,
  editorialAuditAt: catalogue.editorialAuditAt,
  linkSnapshotAt: links.generatedAt,
  thumbnailSnapshotAt: thumbnails.generatedAt,
  resourceCount: resources.length,
  summary: {
    sourceConfirmed: count(item => item.sourceStatus === "ok"),
    manuallyVerified: count(item => item.sourceCheck === "manual"),
    needsSourceReview: count(item => item.sourceCheck === "needs-review"),
    sourceThumbnails: count(item => item.thumbnailEvidence !== "generated"),
    generatedThumbnails: count(item => item.thumbnailEvidence === "generated"),
    featuredNeedingSourceThumbnail: count(item => item.featured && item.thumbnailEvidence === "generated"),
    guidedResources: count(item => item.curation === "guided-path"),
    catalogueOnlyResources: count(item => item.curation === "catalogue-only"),
    multiPathResources: count(item => item.collectionIds.length > 1),
    highPriority: count(item => item.priority === "high")
  },
  resources
};
const serialized = `${JSON.stringify(audit, null, 2)}\n`;

if (checkOnly) {
  const current = fs.existsSync(outputPath) ? fs.readFileSync(outputPath, "utf8") : "";
  if (current !== serialized) {
    console.error("reports/editorial-audit.json is stale. Run npm run editorial:audit and commit the result.");
    process.exit(1);
  }
  console.log(`Editorial audit synchronized: ${audit.summary.sourceConfirmed}/${resources.length} sources confirmed, ${audit.summary.sourceThumbnails}/${resources.length} source thumbnails.`);
} else {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, serialized);
  console.log(`Built editorial audit: ${audit.summary.sourceConfirmed}/${resources.length} sources confirmed, ${audit.summary.highPriority} high-priority records.`);
}
