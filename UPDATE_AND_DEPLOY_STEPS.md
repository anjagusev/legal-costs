# Update And Deploy Steps

This site is a static Astro build.

## Prerequisites

- Node.js 20 LTS (or >= 18.17)
- npm 9+

## Run Locally

```sh
cd site
npm install
npm run dev
```

Open:

- http://localhost:4321

## Update Costs (Data)

1) Edit the spreadsheet in the parent folder:

- `../Legal_Etransfer_Payments.xlsx`

2) Regenerate the public (sanitized) dataset:

```sh
cd site
npm run update-data
```

Notes:

- The site only publishes monthly aggregates and broad categories.
- Categorization is derived from the `Sent To` role markers like `(Lawyer)` / `(Mediator)`.
- If you change naming conventions, update the rules in `site/scripts/build-public-data.py`.

## Build For Deployment

```sh
cd site
npm run build
```

Output folder:

- `site/dist/`

Deploy by uploading/publishing the contents of `site/dist/`.

## Deploy Under A Subpath (Recommended)

If your site will live at a path like:

- `https://yoursite.com/legal-costs/`

Set the base path before building.

1) Edit `site/astro.config.mjs` and set:

```js
export default defineConfig({
  base: '/legal-costs/',
});
```

2) Build:

```sh
cd site
npm run build
```

3) Upload the contents of `site/dist/` into your server folder for `/legal-costs/`.

## Deploy As A Standalone Site (Subdomain)

If your site will live at something like:

- `https://legal-costs.yoursite.com/`

You can leave `base` unset in `site/astro.config.mjs`.

Build and deploy `site/dist/` to that subdomain's document root.

## Preview The Production Build Locally

```sh
cd site
npm run preview
```

## Google Analytics (Optional)

This site supports GA4 via `PUBLIC_GA_MEASUREMENT_ID`.

- Local: copy `site/.env.example` to `site/.env` and set:

```sh
PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

- Hosting: set an environment variable named `PUBLIC_GA_MEASUREMENT_ID` and rebuild/redeploy.

## Privacy / Safety

- Do not deploy/publish `../Legal_Etransfer_Payments.xlsx`.
- Do not deploy/publish screenshots or emails.
- Deploy only `site/dist/`.
