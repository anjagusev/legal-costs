# Legal Cost Counter (Static Site)

This Astro site renders a public, advocacy-safe view of legal costs using monthly aggregates (no invoices, no line items, no provider names).

## Data Flow

- Source (private): `../Legal_Etransfer_Payments.xlsx`
- Build step (sanitized): `src/data/legal-costs.public.json`
- Site displays: totals, monthly spend, cumulative spend, broad categories

The public JSON is regenerated automatically on `npm run dev` and `npm run build`.

## Commands

- `npm install`
- `npm run dev`
- `npm run build`
- `npm run preview`

## Update Costs

1) Add the new row(s) to `../Legal_Etransfer_Payments.xlsx`
2) Run `npm run update-data`

If a new payee name appears, the site will bucket it into a broad category. You can tweak categorization rules in `site/scripts/build-public-data.py`.

## Deploy / Embed On Your Personal Site

This is a static build.

1) Build: `npm run build`
2) Publish the contents of `dist/`

Common options:

- Deploy `dist/` to a subpath on your existing site (recommended):
  - Example URL: `https://yoursite.com/legal-costs/`
  - Set the base path before building:
    - Edit `site/astro.config.mjs` and set `base: '/legal-costs/'`
    - Rebuild: `npm run build`
- Deploy as a standalone page (subdomain):
  - Example URL: `https://legal-costs.yoursite.com/`
  - No special base path needed
- Embed via iframe on your main site:
  - Publish this site anywhere, then `<iframe src="...">` it into your existing page

## Google Analytics (Optional)

Set `PUBLIC_GA_MEASUREMENT_ID` at build time.

- Local: copy `site/.env.example` to `site/.env` and fill in your GA4 Measurement ID
- Hosting: set an environment variable named `PUBLIC_GA_MEASUREMENT_ID`

## Privacy Notes

- Do not deploy or publish the raw workbook or any screenshots/emails.
- This site intentionally exposes only monthly aggregates and broad categories.
