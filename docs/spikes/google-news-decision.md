# Google News feasibility spike — decision record

**Issue:** #22  
**Date:** 2026-06-15  
**Decision:** **No-go** for Google News placement in the current product scope.

## Context

Stakeholder asked whether syndicating electricity price data via Google News would add credibility for the Nordpool price monitor.

## Findings

| Factor | Finding |
| --- | --- |
| Eligibility | Google News surfaces require **news-focused, original, timely editorial content** with clear dates and bylines — not utility dashboards or raw JSON feeds |
| Publisher Center | No application required; as of March 2025 Google auto-generates publication pages; RSS/web-location submissions in Publisher Center are **deprecated** ([Google support](https://support.google.com/news/publisher-center/answer/15898024)) |
| News sitemap | Helps **news articles** only; useless without article HTML pages |
| This product today | Interactive price app + API — **not eligible** for Google News as-is |

## Go / no-go

**No-go** for Google News as a near-term initiative.

Rationale:

1. Placement requires an **editorial content product** (daily digest articles, author metadata, `NewsArticle` JSON-LD, news sitemap) — a pivot from the current data/utility app.
2. Expected ROI is low versus **Search SEO** work tracked in #21 (Dataset rich results, sitemap, Search Console baseline in [search-console.md](../ops/search-console.md)).
3. Auto-generated digests risk thin-content penalties unless staffed with editorial review.

## If revisited later (conditional go path)

Only pursue after explicit PO approval of a content track:

1. **Article template** — e.g. daily digest: "Elektros kainos YYYY-MM-DD: vidutinė X ct/kWh…"
2. **Generation trigger** — post-sync hook when tomorrow prices publish (#8 release window)
3. **URL scheme** — `/news/YYYY-MM-DD` with static/SSG HTML
4. **Structured data** — `NewsArticle` JSON-LD + dedicated news sitemap
5. **Search Console** — verify indexing baseline regardless (see [search-console.md](../ops/search-console.md))

## Out of scope (unchanged focus)

- Google News Publisher Center setup
- News sitemap or RSS for Google News submission
- Editorial CMS or digest generation

## Related

- #21 — SERP improvements (recommended path)
- [search-console.md](../ops/search-console.md) — verification and sitemap baseline
