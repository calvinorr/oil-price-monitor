-- Enable extensions for UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS oil_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recorded_at timestamptz DEFAULT now(),
  avg_price_900L numeric(10,2) NOT NULL,
  cheapest_price_900L numeric(10,2) NOT NULL,
  cheapest_supplier text NOT NULL,
  supplier_count integer NOT NULL,
  avg_ppl numeric(10,2) NOT NULL,
  cheapest_ppl numeric(10,2) NOT NULL,
  daily_change numeric(10,2),
  daily_change_pct numeric(5,2),
  week_ago_price numeric(10,2),
  month_ago_price numeric(10,2),
  suppliers_raw jsonb NOT NULL,
  scrape_duration_ms integer,
  scrape_success boolean DEFAULT true,
  error_message text,
  CONSTRAINT unique_daily_record UNIQUE (DATE(recorded_at))
);

CREATE INDEX IF NOT EXISTS idx_recorded_at ON oil_prices(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_date ON oil_prices(DATE(recorded_at));

CREATE TABLE IF NOT EXISTS email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sent_at timestamptz DEFAULT now(),
  recipient text NOT NULL,
  subject text NOT NULL,
  success boolean NOT NULL,
  error_message text,
  price_record_id uuid REFERENCES oil_prices(id) ON DELETE SET NULL,
  response_code integer,
  response_id text
);

CREATE INDEX IF NOT EXISTS idx_email_sent_at ON email_logs(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_success ON email_logs(success);
