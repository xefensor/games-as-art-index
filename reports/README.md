# Editorial reports

`editorial-audit.json` is the committed reliability snapshot for the catalogue. It is generated from the published catalogue, link-status snapshot, and thumbnail manifest with:

```bash
npm run editorial:audit
```

The audit separates automated link responses from manual browser verification and identifies featured resources that still need representative source imagery. Do not hand-edit the generated audit.

`link-check-report.json` is a transient complete response log created by `npm run check:links`; it is intentionally ignored because the curated `public/link-status.json` snapshot is what the website publishes.
