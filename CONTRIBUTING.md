# Contributing to the Index

The Index is curated rather than comprehensive. A resource should offer durable educational, technical, historical, archival, or critical value concerning digital games. Marketing material, routine news, SEO summaries, and exploitative monetization guidance are outside its editorial focus.

## Suggest without editing code

Open a **Suggest a resource** issue and provide the original source, creator, format, and a concrete explanation of its value. Report broken links or inaccurate metadata with the **Catalogue problem** form.

## Submit a catalogue change

1. Create a branch from `main`.
2. Add or edit one file in `content/resources/` or `content/collections/`.
3. Update the appropriate order array in `content/catalogue.json` when adding a record.
4. Add or refresh the local thumbnail and `public/thumbnail-manifest.json` entry when necessary.
5. Run the catalogue build and validation commands.
6. Open a pull request and include the editorial evidence requested by the template.

```bash
npm install
npm run catalogue:build
npm run validate:catalogue
npm run validate:thumbnails
npm run check:browse
npm run build
```

CI verifies that generated output is synchronized, IDs and relationships are valid, thumbnails exist, browser interactions pass, and the production site builds.

## Editorial rules

- Use the original creator or publisher URL whenever it remains available.
- Describe resources factually and in original wording; do not copy publisher descriptions.
- Record what a resource contains before explaining why it is useful.
- Keep permanent IDs stable after publication.
- Treat automated link failures as review prompts, not proof that a source is gone.
- Embed only material offered through an official or clearly authorized player.
- Preserve source and verification notes for thumbnails and embeds.

Pull requests require human editorial review. Passing automation is necessary but does not guarantee inclusion.
