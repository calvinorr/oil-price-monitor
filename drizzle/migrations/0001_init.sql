-- Basic schema for oil price monitor (Neon Postgres)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS oil_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recorded_at TIMESTAMPTZ DEFAULT NOW(),

  avg_price_900L NUMERIC(10,2) NOT NULL,
  cheapest_price_900L NUMERIC(10,2) NOT NULL,
  cheapest_supplier TEXT NOT NULL,
  supplier_count INTEGER NOT NULL,
  avg_ppl NUMERIC(10,2) NOT NULL,
  cheapest_ppl NUMERIC(10,2) NOT NULL,

  daily_change NUMERIC(10,2),
  daily_change_pct NUMERIC(5,2),
  week_ago_price NUMERIC(10,2),
  month_ago_price NUMERIC(10,2),

  suppliers_raw JSONB NOT NULL,

  scrape_duration_ms INTEGER,
  scrape_success BOOLEAN DEFAULT TRUE,
  error_message TEXT,

  CONSTRAINT unique_daily_record UNIQUE (DATE(recorded_at))
);

CREATE INDEX IF NOT EXISTS idx_recorded_at ON oil_prices(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_date ON oil_prices(DATE(recorded_at));

CREATE TABLE IF NOT EXISTS email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  recipient TEXT NOT NULL,
  subject TEXT NOT NULL,
  success BOOLEAN NOT NULL,
  error_message TEXT,
  price_record_id UUID REFERENCES oil_prices(id) ON DELETE SET NULL,
  response_code INTEGER,
  response_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_email_sent_at ON email_logs(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_success ON email_logs(success);
