# Games as Art Index

A curated, account-free index of game development, history, and criticism, built from useful talks, books, articles, papers, guides, documentation, courses, and archives.

**Website:** [xefensor.github.io/games-as-art-index](https://xefensor.github.io/games-as-art-index/)

## Run locally

```bash
npm install
npm run dev
```

The public website is deployed to GitHub Pages from `main`. The Pages workflow validates the catalogue and interface, builds a repository-path-safe static artifact, and publishes it only after those checks pass.

## Current catalogue

- 78 factual resource records with original external links
- Typo-tolerant search across title, creator, publisher, game, format, level, and topic
- Shareable URL filters for subject, format, access, experience, length, purpose, and sort order
- Thirteen curated learning paths
- Complete thumbnail coverage with source-aware discovery and generated editorial fallbacks
- Click-to-load YouTube players (including verified official videos attached to publisher records), publisher-hosted PDF readers, and Google Books previews on supported resource pages, with original source links preserved
- Resource pages with metadata, audience, learning outcomes, related records, and link-check dates
- Permanent clean URLs for every resource and collection, with legacy hash links upgraded automatically
- Crawlable static pages with route-specific titles, descriptions, canonical URLs, social previews, structured data, and a generated sitemap
- A committed editorial audit that distinguishes automated source checks, manual verification, and source-backed versus generated thumbnails
- Automatic system theme plus explicit Auto, Light, and Dark controls
- Locally saved resources and recently viewed history, with no account
- Public GitHub issue forms for suggestions and catalogue problems, plus an in-browser JSON record-preparation tool for pull requests
- Responsive navigation and meaningful static fallback content

Catalogue records are maintained as one file per entry under `content/resources/`; collections live under `content/collections/`, and taxonomy plus stable display order live in `content/catalogue.json`. `npm run catalogue:build` deterministically generates `public/catalogue.json` for the website. `public/data.js` loads that generated file and `public/app.js` renders the browser interface.

## Contributing through GitHub

Resource suggestions and catalogue problems use structured GitHub issue forms. Published changes go through pull requests with automated catalogue, thumbnail, browser, and production-build checks. See [CONTRIBUTING.md](CONTRIBUTING.md) for the editorial criteria and workflow.

The generated public catalogue is committed so deployments remain self-contained, but contributors should edit the source files under `content/`. CI rejects a pull request when generated output is stale.

## Thumbnail maintenance

Every resource uses a local optimized thumbnail recorded in `public/thumbnail-manifest.json`. Catalogue image URLs remain as acquisition metadata, but the reader interface consistently loads the normalized local set.

Discover and refresh source images, then generate editorial covers where a suitable image is unavailable:

```bash
npm run thumbnails:sync -- --refresh
```

Refresh one resource with `npm run thumbnails:sync -- --id resource-id`. Validate complete coverage without making network requests:

```bash
npm run validate:thumbnails
```

The manifest records the resource page, selected image source, acquisition method, verification date, dimensions, and file size. Thumbnail validation runs automatically before every production build.

## Catalogue maintenance

Validate the complete catalogue before committing changes:

```bash
npm run catalogue:build
npm run validate:catalogue
```

Check original resource links and write `reports/link-check-report.json`:

```bash
npm run check:links
```

The link checker classifies successful, restricted, redirected, broken, timed-out, and network-error results separately. Use `npm run check:links -- --help` for limits and timeout options. Validation runs automatically before every production build.

Rebuild the committed reliability snapshot after catalogue, link-status, or thumbnail changes:

```bash
npm run editorial:audit
```

`reports/editorial-audit.json` records the source-check method, thumbnail evidence, and review priority for every resource. CI rejects stale audit data.

## Editorial model

The catalogue points to existing knowledge rather than reproducing it. Each record should identify its original creator and publisher, link to the original source, describe the subject factually, and avoid presenting its short annotation as a definitive review.

Future additions should favor durable educational, technical, historical, or critical material over news and product promotion. Records move through `draft`, `reviewed`, `published`, and `needs-rechecking` editorial states. Links and metadata should be checked before publication.

The in-site editorial workspace reads the deployed link-health snapshot and can prepare record JSON locally. It does not publish or override catalogue data: accepted edits are reviewed in GitHub and merged through pull requests.

## License

The project uses two licenses because it contains both software and an editorial knowledge catalogue:

- Application code and project infrastructure are available under the [MIT License](LICENSE).
- Original catalogue writing, structured data, documentation, and project-generated thumbnails are available under [CC BY 4.0](CONTENT-LICENSE.md).

Third-party covers, screenshots, video thumbnails, source-site images, trademarks, embedded media, linked resources, and dependencies are not relicensed. See [CONTENT-LICENSE.md](CONTENT-LICENSE.md) for the exact boundary and attribution guidance.
