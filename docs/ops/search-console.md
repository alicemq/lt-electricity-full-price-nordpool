# Google Search Console and SEO baseline

Operational steps for verifying the Nordpool frontend in Google Search Console and maintaining SERP metadata.

## Property URL

Production canonical host: `https://elektra.teletigras.lt` (from `electricity-prices-build/package.json` `homepage`).

## Verification options

### Meta tag (recommended)

1. In Search Console, choose **HTML tag** verification.
2. Copy the `content` value from the meta tag Google provides.
3. Set it in the frontend build environment:

```bash
# electricity-prices-build/.env.production (local only; do not commit)
VITE_GOOGLE_SITE_VERIFICATION=your_verification_code
```

4. Rebuild and deploy the frontend. The Vite build injects:

```html
<meta name="google-site-verification" content="your_verification_code" />
```

5. Click **Verify** in Search Console.

### HTML file (alternative)

1. In Search Console, choose **HTML file** verification.
2. Download Google's token file and replace `electricity-prices-build/public/google-site-verification.html` with that file (or add the exact filename Google requests under `public/`).
3. Deploy and verify.

If neither method is configured, the stub at `public/google-site-verification.html` documents the expected setup.

## Sitemap

- `sitemap.xml` is generated at **build time** by `vite-plugin-sitemap.js` into `dist/sitemap.xml`.
- Do not commit a static `public/sitemap.xml`; the build plugin is the sole source of truth.
- `public/robots.txt` points crawlers to `https://elektra.teletigras.lt/sitemap.xml`.
- The sitemap includes public routes plus `/today?date=YYYY-MM-DD` entries for the last 14 days.

Submit the sitemap URL in Search Console after each production deploy.

## hreflang and locales

The app uses a **single-URL locale toggle** (Lithuanian default, English via `?lang=en`). There are no `/en/...` path prefixes.

Hreflang alternates are emitted at runtime in `<head>`:

| hreflang | URL pattern |
| --- | --- |
| `lt` | canonical path (no `lang` query) |
| `en` | same path with `?lang=en` |
| `x-default` | Lithuanian canonical URL |

Sitemap entries include matching `xhtml:link` alternates for the same pattern.

## JSON-LD

Per route, the SPA emits:

- `WebApplication`
- `Organization`
- `BreadcrumbList`
- `Dataset` on `/today` when price data has loaded (no `aggregateRating`; price stats use `variableMeasured`)

Prerender/SSR is not enabled in v1; crawlers that execute JavaScript receive full structured data after load.

## Related issues

- #21 — SERP baseline (this runbook)
- #20 — Lighthouse CI regression gate (planned)
