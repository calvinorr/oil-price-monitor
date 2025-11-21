import type { VercelRequest, VercelResponse } from "@vercel/node";
import { desc } from "drizzle-orm";
import { db } from "../src/db/client";
import { emailLogs, oilPrices } from "../src/db/schema";
import { requireBearerAuth } from "../src/utils/auth";
import { sendDailyEmail } from "../src/utils/email";
import { scrapeFromHtml } from "../src/utils/scraper";
import type { ScrapeResult } from "../src/types";

const TARGET_URL = "https://www.cheapestoil.co.uk/Heating-Oil-NI";
const ALERT_DROP_PPL = 5; // pence per litre drop threshold

async function fetchHtml(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "OilPriceMonitor/0.1 (contact: calvin.orr@gmail.com)",
      },
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`Fetch failed with status ${res.status}`);
    }

    return await res.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function loadPreviousRecord() {
  const rows = await db
    .select()
    .from(oilPrices)
    .orderBy(desc(oilPrices.recordedAt))
    .limit(1);

  return rows[0];
}

async function handler(req: VercelRequest, res: VercelResponse) {
  const auth = requireBearerAuth({ headers: req.headers as Record<string, string> });
  if (!auth.authorized) {
    return res.status(401).json({ error: auth.message ?? "Unauthorized" });
  }

  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const started = Date.now();

  let scrape: ScrapeResult;
  try {
    const html = await fetchHtml(TARGET_URL);
    scrape = scrapeFromHtml(html);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown scrape error";
    return res.status(500).json({ error: message });
  }

  const previous = await loadPreviousRecord();
  const currentAvgPrice = scrape.aggregates.avgPrice900L;
  const previousAvgPrice = previous ? Number(previous.avgPrice900L) : null;

  const dailyChange = previousAvgPrice !== null ? currentAvgPrice - previousAvgPrice : null;
  const dailyChangePct = dailyChange !== null && previousAvgPrice
    ? (dailyChange / previousAvgPrice) * 100
    : null;

  // 5p/litre drop alert (compare avg ppl)
  const previousAvgPpl = previous ? Number(previous.avgPpl) : null;
  const dropPpl = previousAvgPpl !== null ? previousAvgPpl - scrape.aggregates.avgPpl : null;
  const alertTriggered = dropPpl !== null && dropPpl >= ALERT_DROP_PPL;

  const insertResult = await db
    .insert(oilPrices)
    .values({
      avgPrice900L: scrape.aggregates.avgPrice900L,
      cheapestPrice900L: scrape.aggregates.cheapestPrice900L,
      cheapestSupplier: scrape.aggregates.cheapestSupplier,
      supplierCount: scrape.aggregates.supplierCount,
      avgPpl: scrape.aggregates.avgPpl,
      cheapestPpl: scrape.aggregates.cheapestPpl,
      dailyChange: dailyChange ?? undefined,
      dailyChangePct: dailyChangePct ?? undefined,
      weekAgoPrice: null,
      monthAgoPrice: null,
      suppliersRaw: scrape.suppliers,
      scrapeDurationMs: Date.now() - started,
      scrapeSuccess: true,
    })
    .returning({ id: oilPrices.id, recordedAt: oilPrices.recordedAt });

  const recordId = insertResult[0]?.id;

  const emailContext = {
    to: process.env.EMAIL_TO || "",
    aggregates: scrape.aggregates,
    dailyChange,
    dailyChangePct,
    alertTriggered,
    alertReason: alertTriggered ? `Avg ppl dropped by ${dropPpl?.toFixed(2)}p vs previous` : undefined,
    suppliersPreview: scrape.suppliers.sort((a, b) => a.price900L - b.price900L).slice(0, 5),
  };

  let emailLogId: string | undefined;

  if (emailContext.to) {
    const emailResult = await sendDailyEmail(emailContext);
    if (!emailResult.skipped) {
      const log = await db
        .insert(emailLogs)
        .values({
          recipient: emailContext.to,
          subject: "Daily Heating Oil Update",
          success: emailResult.success,
          errorMessage: emailResult.errorMessage ?? null,
          priceRecordId: recordId ?? null,
          responseId: emailResult.responseId ?? null,
        })
        .returning({ id: emailLogs.id });
      emailLogId = log[0]?.id;
    }
  }

  return res.status(200).json({
    ok: true,
    recordId,
    emailLogId,
    alertTriggered,
  });
}

export default handler;
