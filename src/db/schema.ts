import { jsonb, integer, pgTable, text, timestamp, uuid, numeric, boolean } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const oilPrices = pgTable("oil_prices", {
  id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
  recordedAt: timestamp("recorded_at", { withTimezone: true, mode: "string" }).defaultNow(),

  avgPrice900L: numeric("avg_price_900L", { precision: 10, scale: 2, mode: "number" }).notNull(),
  cheapestPrice900L: numeric("cheapest_price_900L", { precision: 10, scale: 2, mode: "number" }).notNull(),
  cheapestSupplier: text("cheapest_supplier").notNull(),
  supplierCount: integer("supplier_count").notNull(),
  avgPpl: numeric("avg_ppl", { precision: 10, scale: 2, mode: "number" }).notNull(),
  cheapestPpl: numeric("cheapest_ppl", { precision: 10, scale: 2, mode: "number" }).notNull(),

  dailyChange: numeric("daily_change", { precision: 10, scale: 2, mode: "number" }),
  dailyChangePct: numeric("daily_change_pct", { precision: 5, scale: 2, mode: "number" }),
  weekAgoPrice: numeric("week_ago_price", { precision: 10, scale: 2, mode: "number" }),
  monthAgoPrice: numeric("month_ago_price", { precision: 10, scale: 2, mode: "number" }),

  suppliersRaw: jsonb("suppliers_raw").notNull(),

  scrapeDurationMs: integer("scrape_duration_ms"),
  scrapeSuccess: boolean("scrape_success").default(true),
  errorMessage: text("error_message"),
});

export const emailLogs = pgTable("email_logs", {
  id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
  sentAt: timestamp("sent_at", { withTimezone: true, mode: "string" }).defaultNow(),
  recipient: text("recipient").notNull(),
  subject: text("subject").notNull(),
  success: boolean("success").notNull(),
  errorMessage: text("error_message"),
  priceRecordId: uuid("price_record_id").references(() => oilPrices.id, { onDelete: "set null" }),
  responseCode: integer("response_code"),
  responseId: text("response_id"),
});
