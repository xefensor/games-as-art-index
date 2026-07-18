# Catalogue content

This directory is the editorial source of truth for the Index.

- `catalogue.json` contains taxonomy, schema metadata, and explicit display order.
- `resources/<id>.json` contains one curated resource per file.
- `collections/<id>.json` contains one learning collection per file.
- `schema/` documents the machine-readable record formats.

Resource IDs are permanent. Rename a title when necessary, but do not replace an existing ID after publication. Relationships such as `next` and collection membership always use these IDs so the catalogue can later migrate to a database without rewriting its graph.

After editing content, run:

```bash
npm run catalogue:build
npm run validate:catalogue
```

`public/catalogue.json` is generated for the website and must remain synchronized with these files. CI rejects stale generated output.
