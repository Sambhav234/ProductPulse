# Running the Price Tracker Locally

## Prerequisites

- Node.js 20+ installed
- `npm` (comes with Node)
- Optional: Supabase account (for persistent data)

## Setup Steps

### 1. Install dependencies

```bash
cd C:\Users\mishr\PriceTracker
npm install
npx playwright install chromium
```

### 2. Create environment file

```bash
cp .env.example .env
```

Edit `.env` with a text editor:

```env
PORT=3000
NODE_ENV=development
TARGET_ORIGIN=https://demo.inelabteamdev.com
STORE_BASE_URL=https://demo.inelabteamdev.com
CRON_SECRET=your-secret-here
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
FRONTEND_ORIGIN=http://localhost:5173
VITE_API_URL=http://localhost:3000
```

**Note:** Leave Supabase empty to test without a database. The app will fetch live data from the demo store.

### 3. Run the application

```bash
npm run dev
```

This starts:

- **Frontend** (Vite): http://localhost:5173
- **API** (Express): http://localhost:3000

Open http://localhost:5173 in your browser.

## Testing

Run tests:

```bash
npm test
```

Build production frontend:

```bash
npm run build
```

Test the API directly:

```powershell
# Health check
curl.exe http://localhost:3000/api/health

# Search products
curl.exe "http://localhost:3000/api/search?q=phone"

# Get a single product
curl.exe http://localhost:3000/api/products/1
```

## Adding Supabase (Optional)

To add persistent data storage:

1. Create a Supabase account at https://supabase.com
2. Create a new project
3. Copy the project URL and service-role key
4. Add to `.env`:
   ```env
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```
5. Run the SQL migration:
   - Open Supabase SQL Editor
   - Copy contents of `supabase/migrations/001_initial.sql`
   - Paste and run
6. Restart the app: `npm run dev`

## Common Issues

**"column tracked_products.updated_at does not exist"**

- This was a bug in earlier versions. Update to the latest code.
- If persists, run the SQL migration again in Supabase.

**Port already in use**

- Change `PORT` in `.env` to an available port (e.g., 3312)

**Products not loading**

- Check that `https://demo.inelabteamdev.com` is accessible
- Verify API is running: `curl http://localhost:3000/api/health`
- Check browser console for CORS errors

**Playwright browser issues**

- Reinstall: `npx playwright install chromium`
- Use headed runner: `npm run scrape:headed -- --product 1`

## Next Steps

- **Track products:** Click product cards to add to tracking
- **View history:** Check price and stock history for tracked items
- **Run scraper:** `npm run scrape` to collect live data
- **Deploy:** See README.md for Render/Vercel deployment
