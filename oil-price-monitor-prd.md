# Automated Heating Oil Price Monitor - PRD

**Date**: 21 November 2025
**Status**: Ready for Implementation
**Target**: CheapestOil.co.uk NI Pricing Data

---

## Executive Summary

Build an automated system that scrapes UK heating oil prices from CheapestOil.co.uk daily, stores historical data, performs trend analysis, and sends daily email reports to track pricing patterns for heating oil purchases.

**Current Baseline** (21/11/2025): £542.49 per 900L (59.2 ppl)

---

## 1. System Architecture

### 1.1 High-Level Flow

```
┌──────────────┐
│ Cron Trigger │ ← Daily at 08:00 GMT
└──────┬───────┘
       │
       ▼
┌──────────────────┐
│ Edge Function    │ Supabase Function
│ (Scraper)        │ • Fetch HTML
└──────┬───────────┘ • Parse data
       │              • Store to DB
       ├─► Supabase DB (PostgreSQL)
       │   └─ oil_prices table
       │   └─ email_logs table
       │
       ▼
┌──────────────────┐
│ Email Service    │ Resend API
│ (Reporter)       │ • Format HTML
└──────────────────┘ • Send to you
```

### 1.2 Components

1. **Scraper Function** (Edge Function)
   - Runs on schedule or manual trigger
   - Fetches HTML from CheapestOil
   - Parses supplier pricing table
   - Calculates aggregates
   - Stores to database

2. **Database** (Supabase PostgreSQL)
   - Historical price records
   - Email delivery logs
   - Supplier snapshots

3. **Reporter Function** (Email)
   - Formats daily report
   - Includes trend analysis
   - Sends via Resend API

4. **Scheduler** (PostgreSQL pg_cron)
   - Triggers scraper daily
   - Configurable time

---

## 2. Data Extraction Details

### 2.1 Target URL
```
https://www.cheapestoil.co.uk/Heating-Oil-NI
```

### 2.2 Data Points to Extract

From the supplier pricing table:

| Metric | Source | Type |
|--------|--------|------|
| Supplier Name | Table row link text | string |
| Price (900L) | Rightmost column, £ amount | number |
| Price per Litre (ppl) | ppl value next to price | decimal |
| Postcode Coverage | Table row | string |
| Last Updated | "Updated X ago" text | string |

### 2.3 Current Sample Data (21/11/2025)

```json
{
  "suppliers": [
    {
      "name": "Portadown Oil Supplies",
      "price_900L": 524,
      "ppl": 58.2,
      "postcodes": "BT25, BT32, BT60 to BT67",
      "updated": "21 hours ago"
    },
    {
      "name": "New City Fuels",
      "price_900L": 525,
      "ppl": 58.3,
      "postcodes": "BT32, BT61 to BT67",
      "updated": "2 days ago"
    }
  ],
  "aggregates": {
    "avg_price_900L": 542.49,
    "cheapest_price_900L": 524,
    "cheapest_supplier": "Portadown Oil Supplies",
    "supplier_count": 88,
    "avg_ppl": 59.2
  }
}
```

### 2.4 Parsing Strategy

**HTML Structure**:
- Supplier links use pattern: `href="/distributors/[name]"`
- Table cells contain: `£XXX` and `XX.X ppl *`
- "Updated" timestamp appears after supplier name

**Extraction Method**:
```
1. Find all links matching /distributors/ pattern
2. Extract parent row/container
3. Parse adjacent cells for prices
4. Extract timestamp from "Updated" text
5. Calculate averages across all rows
6. Store raw supplier array + aggregates
```

---

## 3. Tech Stack

### 3.1 Recommended (Aligned with Your Preferences)

| Layer | Technology | Why |
|-------|------------|-----|
| **Language** | TypeScript | Type safety, your preference |
| **Runtime** | Supabase Edge Functions (Deno) | Serverless, integrates with Supabase |
| **Scraping** | Cheerio | Lightweight DOM parsing, fast |
| **Database** | Supabase PostgreSQL | Already in your stack, free tier |
| **Email** | Resend API | Dev-friendly, 3k/month free tier |
| **Scheduler** | PostgreSQL pg_cron | Native to Supabase |
| **Hosting** | Supabase Edge | Zero-cost serverless |

### 3.2 Alternative (If Prefer Python)

- Runtime: **Vercel Serverless Function** (Python)
- Cron: **Vercel Cron** (`vercel.json`)
- Scraping: **BeautifulSoup4** + **Requests**
- Everything else: Same

---

## 4. Database Schema

### 4.1 Main Tables

```sql
-- Oil Prices Historical Data
CREATE TABLE oil_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Aggregate Metrics
  avg_price_900L DECIMAL(10,2) NOT NULL,
  cheapest_price_900L DECIMAL(10,2) NOT NULL,
  cheapest_supplier TEXT NOT NULL,
  supplier_count INTEGER NOT NULL,
  avg_ppl DECIMAL(10,2) NOT NULL,
  cheapest_ppl DECIMAL(10,2) NOT NULL,
  
  -- Daily Changes (vs Previous Day)
  daily_change DECIMAL(10,2),
  daily_change_pct DECIMAL(5,2),
  
  -- Weekly/Monthly Context
  week_ago_price DECIMAL(10,2),
  month_ago_price DECIMAL(10,2),
  
  -- Raw Data
  suppliers_raw JSONB NOT NULL,
  
  -- Metadata
  scrape_duration_ms INTEGER,
  scrape_success BOOLEAN DEFAULT true,
  error_message TEXT,
  
  CONSTRAINT unique_daily_record UNIQUE (DATE(recorded_at))
);

CREATE INDEX idx_recorded_at ON oil_prices(recorded_at DESC);
CREATE INDEX idx_date ON oil_prices(DATE(recorded_at));

-- Email Delivery Log
CREATE TABLE email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  recipient TEXT NOT NULL,
  subject TEXT NOT NULL,
  success BOOLEAN NOT NULL,
  error_message TEXT,
  price_record_id UUID REFERENCES oil_prices(id) ON DELETE SET NULL,
  response_code INTEGER,
  response_id TEXT  -- Resend email ID
);

CREATE INDEX idx_email_sent_at ON email_logs(sent_at DESC);
CREATE INDEX idx_email_success ON email_logs(success);
```

### 4.2 Sample Queries

```sql
-- Get last 30 days of prices
SELECT recorded_at, avg_price_900L, cheapest_price_900L 
FROM oil_prices
WHERE recorded_at >= NOW() - interval '30 days'
ORDER BY recorded_at DESC;

-- Calculate 7-day average
SELECT 
  AVG(avg_price_900L) as week_avg,
  MAX(avg_price_900L) as week_max,
  MIN(avg_price_900L) as week_min
FROM oil_prices
WHERE recorded_at >= NOW() - interval '7 days';

-- Find cheapest prices in history
SELECT recorded_at, cheapest_price_900L, cheapest_supplier
FROM oil_prices
ORDER BY cheapest_price_900L ASC
LIMIT 10;
```

---

## 5. Implementation Roadmap

### Phase 1: Setup (30 mins)
- [ ] Create Supabase project
- [ ] Run migrations (create tables)
- [ ] Set up Resend account + API key
- [ ] Store secrets in Supabase Edge Function config

### Phase 2: Scraper Function (2-3 hours)
- [ ] Create Edge Function project structure
- [ ] Implement HTML scraping logic
- [ ] Test parsing on live site
- [ ] Implement database insertion
- [ ] Error handling + logging

### Phase 3: Email Reporter (1-2 hours)
- [ ] Design HTML email template
- [ ] Implement Resend API calls
- [ ] Format trend data for email
- [ ] Test email delivery

### Phase 4: Scheduler (30 mins)
- [ ] Set up pg_cron trigger
- [ ] Configure daily 08:00 GMT execution
- [ ] Add manual trigger endpoint

### Phase 5: Testing & Monitoring (1 hour)
- [ ] Run manual scrape
- [ ] Verify data storage
- [ ] Send test email
- [ ] Monitor first automated run

---

## 6. Manual Prompt for Daily Checks

When you want to check prices without waiting for automation:

```
Check CheapestOil price and compare to last time
```

**I will**:
- Fetch current prices from the NI page
- Compare to last recorded price
- Report trend (up/down/flat)
- Show percentage change
- Highlight cheapest supplier

---

## 7. API Endpoints

### 7.1 Manual Trigger

```bash
curl -X POST https://your-project.supabase.co/functions/v1/scrape-oil-prices \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json"
```

### 7.2 Get Price History

```bash
curl "https://your-project.supabase.co/rest/v1/oil_prices?order=recorded_at.desc&limit=30" \
  -H "apikey: YOUR_ANON_KEY"
```

### 7.3 Get Latest Price

```sql
SELECT * FROM oil_prices 
ORDER BY recorded_at DESC 
LIMIT 1;
```

---

## 8. Error Handling

### 8.1 Common Failures

| Scenario | Handling |
|----------|----------|
| Network timeout | Retry 3x, log error, skip email |
| Parse failure | Log HTML dump, alert via email |
| Database error | Log error, Slack notification |
| Email delivery failure | Retry, log, continue |

### 8.2 Monitoring

```sql
-- Failed scrapes (last 7 days)
SELECT COUNT(*) as failures, MAX(error_message)
FROM oil_prices
WHERE scrape_success = false
  AND recorded_at >= NOW() - interval '7 days';

-- Failed emails
SELECT COUNT(*) as failures
FROM email_logs
WHERE success = false
  AND sent_at >= NOW() - interval '7 days';
```

---

## 9. Security

### 9.1 Secrets Management

```bash
# Store in Supabase Edge Function Secrets
RESEND_API_KEY=re_xxxxx
EMAIL_TO=your@email.com
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=xxxxx
```

### 9.2 Database Access
- Use **Service Role Key** in Edge Functions (server-side only)
- Use **Anon Key** for client-side queries (if exposed)
- Apply Row Level Security (RLS) policies if needed

---

## 10. Future Enhancements

- [ ] Dashboard to visualize price trends
- [ ] Price alerts (notify when below threshold)
- [ ] Mainland UK price comparison
- [ ] Historical export (CSV)
- [ ] Supplier comparison charts
- [ ] Multi-region tracking (England/Scotland/Wales)

---

## Getting Started

1. **Review this document** - Understand the architecture
2. **Clone starter repo** - Get boilerplate code
3. **Set up Supabase** - Create project and run migrations
4. **Implement scraper** - Write HTML parsing logic
5. **Test manually** - Verify data extraction
6. **Deploy function** - Push to Supabase Edge
7. **Configure schedule** - Set up pg_cron
8. **Monitor** - Check logs and emails

---

**Questions for Implementation**:
- Preferred email recipient?
- Specific time for daily report (currently 08:00 GMT)?
- Want alerts for price drops below certain level?
- Include all 88 suppliers or just top 10 in email?

Ready to code! 🚀