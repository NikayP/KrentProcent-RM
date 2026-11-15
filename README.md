# KrentProcent (`1.0.0`)

Bar drink value & alcohol efficiency calculator with AI menu scanning, optional cloud sync, and community bar discovery.

## Features
- **Drinks & Leaderboard:** Calculate pure alcohol per euro (`ml/€`) and cost per standard drink across beers, wines, spirits, cocktails, and ciders — no account required.
- **AI Menu Scanner:** Snap a photo with the camera, pick an image from your gallery, or upload a PDF menu (up to 3 MB), or paste menu text offline.
- **My Bars, Discover & Account:** Compare venues side by side, optionally create an account to sync across devices, mark specific bars **Public** (with optional city), and browse/adopt bars shared by others in **Discover**.
- **PWA & Offline Support:** Installable on Android and iOS home screens with offline menu calculations and local storage persistence.

## Local Development

```bash
npm install
npm run dev
```

Runs the Express + Vite server on `http://localhost:3000`.

### Environment Variables (`.env`)
See `.env.example`:
- `GEMINI_API_KEY` — optional for local text parsing; required for image/PDF menu scanning.
- `VITE_SUPABASE_URL` & `VITE_SUPABASE_ANON_KEY` — optional; enables accounts, cloud sync, and Discover.
- `SUPABASE_SERVICE_ROLE_KEY` — server-only secret for username-based login (`/api/login`).

## Database Setup (Supabase)
For a fresh Supabase project, run [`supabase/schema.sql`](supabase/schema.sql) once in the SQL Editor.
For incremental upgrades from earlier versions, run the scripts in `supabase/migrations/` in order:
1. `0002_change_username.sql`
2. `0003_public_bars.sql`

## Verification

```bash
npm run lint
npm test
npm run build
```
