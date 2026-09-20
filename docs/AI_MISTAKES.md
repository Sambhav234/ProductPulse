# AI mistakes and mitigations

- **Assuming prices are in HTML:** the target is a React shell; metadata is JSON and price is browser-mediated. The scraper uses the confirmed endpoints and Playwright only for reveal.
- **Guessing a price endpoint:** direct `/api/price` variants return 404. The runner performs the UI flow instead.
- **Treating cron as harmless:** collection can overlap and amplify target traffic. The API has bearer protection and single-flight overlap protection.
- **Leaking Supabase credentials:** only the server imports the service-role key; the Vite bundle has no Supabase configuration.
