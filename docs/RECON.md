# Phase 0 Recon: INE Store

- **Target:** https://demo.inelabteamdev.com/
- **Recon date:** 2026-09-18 (UTC+05:30)
- **Scope:** unauthenticated inspection only; no application code implemented.

## Executive findings

The site is a small React/Vite single-page storefront. The server-rendered/raw HTML contains only the application shell; product and layout data are loaded by browser JavaScript. The catalog and product-detail JSON endpoints are straightforward and suitable for a fetch/HTTP client. Price reveal is deliberately browser-mediated: it requires mouse movement/dwell and a trusted click, performs browser/environment attestation, then uses obfuscated multi-step requests and an ephemeral token. A plain fetch/cheerio implementation should not be expected to reproduce price reveal reliably.

**Recommendation:** use HTTP/fetch plus a JSON parser (Cheerio is unnecessary) for catalog, product metadata, and layout. Use Playwright (or another real browser) for price reveal if live prices are required. If the app only needs product metadata, avoid browser automation.

## Pages and raw HTML vs rendered DOM

- `/`, `/product/:id`, and unknown paths return the same 459-byte HTML shell with HTTP 200 and `Content-Type: text/html`.
- Shell contents: `<div id="root"></div>`, `/assets/index-B9UiQq4X.js`, and `/assets/index-DrctpSuy.css`; no product names, prices, links, or JSON are present in raw HTML.
- The bundle defines React routes:
  - `/` — catalog browse page
  - `/product/:id` — product detail page
  - `*` — catalog fallback
- Rendered catalog cards contain category, name, brand, SKU, and a “View details” button. Prices are explicitly absent from cards and only appear on detail pages.
- Detail pages render description, a price-reveal widget, specifications, reviews, and a “Refresh price” action.
- A cookie-consent dialog may appear after a randomized delay (roughly 1.5–5 seconds, with a random chance); it has Accept and Decline buttons and modal focus/scroll handling. This is a browser-only behavior not visible in raw HTML.

## Confirmed JSON endpoints

All are same-origin and returned HTTP 200 during recon.

### `GET /api/catalog?page={page}&pageSize={pageSize}`

Example: `/api/catalog?page=1&pageSize=20`

Response shape:

```json
{
  "page": 1,
  "pageSize": 20,
  "pages": 50,
  "total": 1000,
  "items": [
    {
      "id": 610,
      "slug": "auralite-smart-bulb-three",
      "name": "Auralite Smart Bulb Three",
      "brand": "Auralite",
      "category": "Smart Home",
      "sku": "AUR-10610",
      "description": "..."
    }
  ]
}
```

Observed behavior:

- 1,000 total products; default frontend request is page size 20.
- `pageSize=100` is capped to 60; `pageSize=0` falls back to 20.
- Invalid/low pages normalize to page 1; page 999 normalizes to the last page.
- `search` and `q` parameters were accepted but ignored: responses remained unfiltered. There is no visible search control or search endpoint in the current bundle.
- First request was slower (approximately 2.5 seconds in one repeated run); subsequent same-request calls were approximately 80–120 ms. Another endpoint run showed a first-call delay around 1.3 seconds. Treat latency as variable rather than a guaranteed fixed delay.

### `GET /api/product/{id}`

Example: `/api/product/1`

Returns product metadata, `specs`, and the complete `reviews` array. Product 1 returned HTTP 200 in approximately 80–100 ms after warm-up. A nonexistent ID (`999999`) returned HTTP 404. Product route HTML itself still returns the SPA shell; the JSON request determines whether the rendered detail page succeeds.

### `GET /api/layout`

Returns a small layout/configuration object, including a revision, expiry timestamp, CSS class names, price tag choice, price carrier, and facet order. Example observed fields: `revision`, `variant`, `validUntil`, `classes`, `order`, `priceTag`, `priceCarrier`, `ratingAria`, `sellerTitle`.

## Price reveal / network behavior

The downloaded frontend bundle exposes the flow but intentionally obfuscates endpoint strings and response handling:

1. Detail page creates a price widget with minimum **8 pointer moves** and **600 ms hover dwell** before enabling “Reveal price”.
2. Click records `event.nativeEvent.isTrusted`; an additional random delay can be introduced (0 or 900 ms).
3. The client gathers browser signals: canvas fingerprint, WebGL information, hardware concurrency, screen dimensions/device pixel ratio, and animation-frame timing.
4. It fetches a bootstrap/config payload, computes hashes/signatures (including a WebAssembly-backed calculation), POSTs an attestation payload, receives a token, then performs an authenticated price request for the product ID.
5. HTTP 429 is retried up to six attempts with increasing 300 ms delays; other failures can be surfaced immediately. A refresh repeats the flow.
6. The response is decoded/decrypted client-side into fields including shown price, MRP, sale price, discount, stock, currency, timestamp, rating, seller, delivery days, formatting variant, and pending/triple flags. The displayed amount is intentionally not simply copied from a raw JSON field.

Direct guesses such as `/api/price`, `/api/price/1`, `/api/prices/1`, `/api/quote/1`, `/api/quotes/1`, `/api/price/bootstrap`, and `/api/price/attest` returned HTTP 404 without the browser flow. Playwright and Puppeteer were not installed in this workspace, so I did not install dependencies or execute a rendered-browser trace during Phase 0. Consequently, the exact runtime price URLs, request bodies, and live price responses remain **blocked/unconfirmed** from this recon.

## Other observations / awkward behavior

- Unknown HTML routes return 200 rather than 404 because of SPA fallback.
- The API endpoint responses were stable in shape, but catalog ordering is not assumed to be semantic; use returned pagination values.
- Product descriptions and reviews are fictional/demo content; the footer identifies the site as a demo storefront and says products, brands, and prices are fictional.
- Response headers included nginx, `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, and `Referrer-Policy: no-referrer-when-downgrade`.
- No authentication, cookies, or authorization headers were needed for the confirmed catalog/product/layout calls.

## Phase 0 decision

Implement the eventual metadata collector with direct same-origin HTTP requests against `/api/catalog`, `/api/product/{id}`, and `/api/layout`. Do not scrape rendered card/detail HTML. If price tracking is a requirement, add a separately isolated Playwright workflow that performs the required hover/movement/click and captures browser network traffic; do not assume Cheerio/fetch can access prices. This document intentionally contains no app implementation.
