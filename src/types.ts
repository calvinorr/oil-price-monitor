export type SupplierRow = {
  name: string;
  price900L: number;
  ppl: number;
  postcodes: string;
  updated: string;
};

export type Aggregates = {
  avgPrice900L: number;
  cheapestPrice900L: number;
  cheapestSupplier: string;
  supplierCount: number;
  avgPpl: number;
  cheapestPpl: number;
  dailyChange?: number;
  dailyChangePct?: number;
  weekAgoPrice?: number;
  monthAgoPrice?: number;
};

export type ScrapeResult = {
  suppliers: SupplierRow[];
  aggregates: Aggregates;
};
