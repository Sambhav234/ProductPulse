# Design note

The collector separates stable same-origin JSON metadata from the browser-only price reveal. Catalog, product, and layout calls use `fetch`, while Playwright owns pointer movement, dwell, trusted click, and browser signals. All API routes are thin adapters over this production scraper logic, so the headed chaos runner exercises the same path as scheduled work.

The cron endpoint is protected by a bearer secret and uses an in-process single-flight guard. For multi-instance deployment, run one scheduler or move the lock to a Postgres advisory lock. Supabase service-role access is server-only; public clients receive read-only rows through RLS.
