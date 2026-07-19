# Contributing to the Index

The Index is curated rather than comprehensive. A resource should offer durable educational, technical, historical, archival, or critical value concerning digital games. Marketing material, routine news, SEO summaries, and exploitative monetization guidance are outside its editorial focus.

## Suggest without editing code

Use the website's **Contribute** page or the repository's issue forms:

- Open **Suggest a resource** for a new talk, book, article, archive, tool, or other source. Include the original URL, creator, format, and a concrete explanation of its value.
- Open **Catalogue problem** for a broken or redirected link, incorrect metadata, thumbnail or embed failure, duplicate, or other problem with a published entry.

An issue is a proposal, not a pending database record. A maintainer verifies it and makes or reviews the catalogue change.

## Correct an entry in the GitHub website

For a small, exact correction, you do not need to clone the repository:

1. Open the resource in the Index and select **View source record**.
2. In GitHub, use the pencil button to edit the JSON file.
3. Describe what you corrected and cite the original source or other evidence.
4. Select **Propose changes**. GitHub creates a branch or fork and starts a pull request.
5. Complete the pull-request checklist and wait for the automated checks and editorial review.

New entries usually begin with a suggestion issue because they also need catalogue ordering, a thumbnail record, and editorial review. A small, exact correction does not need a separate issue. Experienced contributors may submit a complete new entry in one pull request by following the steps below.

## Submit a catalogue change from a local clone

1. Create a branch from `main`.
2. Add or edit one file in `content/resources/` or `content/collections/`.
3. Update the appropriate order array in `content/catalogue.json` when adding a record.
4. Add or refresh the local thumbnail and its `public/thumbnail-manifest.json` entry when necessary.
5. Run `npm run catalogue:build` and `npm run editorial:audit` to synchronize generated catalogue and audit data.
6. Run the validation commands below.
7. Open a pull request and include the editorial evidence requested by the template.

```bash
npm install
npm run catalogue:build
npm run editorial:audit
npm run validate:catalogue
npm run validate:thumbnails
npm run check:browse
npm run build
```

CI verifies that generated output and the editorial audit are synchronized, contribution forms reference managed GitHub labels and catalogue formats, IDs and relationships are valid, thumbnails exist, browser interactions pass, and both site builds complete.

External-link verification is maintained separately from pull-request CI because publisher sites frequently block automated requests. Do not hand-edit `public/link-status.json`. A new resource that is not yet present in the latest snapshot is published as **Needs rechecking** until a maintainer or the scheduled link-health workflow verifies it.

## Editorial rules

- Use the original creator or publisher URL whenever it remains available.
- Describe resources factually and in original wording; do not copy publisher descriptions.
- Record what a resource contains before explaining why it is useful.
- Keep permanent IDs stable after publication.
- Treat automated link failures as review prompts, not proof that a source is gone.
- Embed only material offered through an official or clearly authorized player.
- Preserve source and verification notes for thumbnails and embeds.

Pull requests require human editorial review. Passing automation is necessary but does not guarantee inclusion.

## Licensing contributions

By submitting a contribution, you certify that you have the right to provide it and agree that original software contributions are licensed under the repository’s MIT License, while original catalogue data, annotations, documentation, and other editorial content are licensed under CC BY 4.0. Do not submit third-party media unless its source and reuse basis are clearly identified; external material is not relicensed merely because it appears in the Index.
