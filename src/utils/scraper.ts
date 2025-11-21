import cheerio from "cheerio";
import type { ScrapeResult, SupplierRow } from "../types";

// Parse CheapestOil NI HTML into structured suppliers + aggregates
export function scrapeFromHtml(html: string): ScrapeResult {
  const $ = cheerio.load(html);
  const suppliers: SupplierRow[] = [];

  const distributorLinks = $('a[href^="/distributors/"]');
  distributorLinks.each((_, link) => {
    const container = $(link).closest("tr, li, div");
    const name = $(link).text().trim();
    if (!container.length || !name) return;

    const text = container.text();
    const priceMatch = text.match(/£\s?(\d+(?:\.\d+)?)/);
    const pplMatch = text.match(/(\d+(?:\.\d+)?)\s?ppl/);
    const updatedMatch = text.match(/Updated[^\n]+/i);

    const price900L = priceMatch ? Number.parseFloat(priceMatch[1]) : NaN;
    const ppl = pplMatch ? Number.parseFloat(pplMatch[1]) : NaN;
    const updated = updatedMatch ? updatedMatch[0].trim() : "";

    const postcodes = extractPostcodes(text);

    if (Number.isNaN(price900L) || Number.isNaN(ppl)) return;

    suppliers.push({ name, price900L, ppl, postcodes, updated });
  });

  const aggregates = computeAggregates(suppliers);
  return { suppliers, aggregates };
}

function extractPostcodes(text: string): string {
  const match = text.match(/BT\S[^\n]*/);
  return match ? match[0].trim() : "";
}

function computeAggregates(suppliers: SupplierRow[]) {
  if (!suppliers.length) {
    throw new Error("No suppliers parsed");
  }

  const cheapest = suppliers.reduce((prev, curr) =>
    curr.price900L < prev.price900L ? curr : prev
  );

  const avgPrice900L =
    suppliers.reduce((sum, s) => sum + s.price900L, 0) / suppliers.length;
  const avgPpl = suppliers.reduce((sum, s) => sum + s.ppl, 0) / suppliers.length;
  const cheapestPpl = suppliers.reduce(
    (min, s) => (s.ppl < min ? s.ppl : min),
    Number.POSITIVE_INFINITY,
  );

  return {
    avgPrice900L,
    cheapestPrice900L: cheapest.price900L,
    cheapestSupplier: cheapest.name,
    supplierCount: suppliers.length,
    avgPpl,
    cheapestPpl,
  };
}
