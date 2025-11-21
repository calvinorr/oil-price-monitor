# Oil Price Monitor

Vercel + Neon implementation of the CheapestOil NI daily scraper and email reporter.

## Stack
- Vercel Node function (`api/scrape-oil-prices.ts`)
- Neon Postgres via `@neondatabase/serverless` + Drizzle ORM
- Vercel Cron (08:00 GMT daily)
- Resend for email delivery
- Cheerio for HTML parsing

## Setup
1) Copy envs: `cp .env.example .env` and fill values (Neon `DATABASE_URL`, `RESEND_API_KEY`, `EMAIL_TO`, `CRON_SECRET_TOKEN`, optional `EMAIL_FROM`). Set `EMAIL_ENABLED=false` to pause sending while testing.
2) Install deps: `npm install` (or `pnpm i`).
3) Apply schema to Neon: run `npx drizzle-kit push` (or `npm run drizzle:push`) using the Neon HTTP pooler connection string.
4) Test locally (manual):
   - `vercel dev` (or `npm run dev`)
   - `curl -X POST http://localhost:3000/api/scrape-oil-prices -H "Authorization: Bearer $CRON_SECRET_TOKEN"`

## Deployment
- Deploy to Vercel; set env vars in the project settings.
- `vercel.json` already defines the cron at 08:00 GMT and pins Node runtime.

## Notes
- API is protected by bearer token: `CRON_SECRET_TOKEN`.
- Alert fires when average ppl drops by ≥5p vs previous day; included in the email when sending is enabled.
- Set `EMAIL_ENABLED=false` to skip sending during tests; no email logs are written when skipped.
- Schema/migrations live in `drizzle/migrations/` and `src/db/schema.ts`.
