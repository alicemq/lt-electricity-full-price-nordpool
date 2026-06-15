# Spike: Google News daily price digest (#22)

**Status:** No-go for Google News placement without an editorial product layer.  
**Date:** 2026-06-15  
**Related:** #21 SERP baseline, #22

## Question

Would submitting to Google News add credibility for an electricity price monitor?

## Findings

| Factor | Finding |
| --- | --- |
| Eligibility | Google News requires **news-focused, original, timely editorial content** with dates and bylines — not utility dashboards or raw API JSON |
| Publisher Center | No application required; as of March 2025 Google auto-generates publication pages; RSS submissions in Publisher Center are deprecated |
| News sitemap | Helps **article HTML** discovery only; useless without `/news/...` pages |
| This product today | Interactive PWA + API — **not eligible** for Google News as-is |

## Decision

**No-go** for Google News in the current product shape. Continue Search-focused SEO (#21): Dataset JSON-LD, hreflang, build sitemap, Search Console monitoring.

## If stakeholder reopens (go path)

1. **Content:** Auto-generated daily digest articles (LT/EN) after sync completes — e.g. `/news/2026-06-15`
2. **Schema:** `NewsArticle` JSON-LD with `datePublished`, author, headline
3. **Sitemap:** Separate news sitemap generator alongside existing build sitemap
4. **Trigger:** Post-sync hook when `initial_sync_completed` and today's LT prices are complete
5. **Effort:** Content product pivot (SSG or prerender route), not a manifest or feed tweak

## Verification regardless of News

- Search Console property verified and sitemap submitted (#21)
- Monitor indexing for `/today`, `/upcoming`, `/about` — not News-specific

## References

- [Google Publisher Center — what's changed](https://support.google.com/news/publisher-center/answer/15898024)
- Issue #22 acceptance criteria
