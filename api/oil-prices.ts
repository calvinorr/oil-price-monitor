import type { VercelRequest, VercelResponse } from "@vercel/node";
import { desc } from "drizzle-orm";
import { db } from "../src/db/client";
import { oilPrices } from "../src/db/schema";
import { requireBearerAuth } from "../src/utils/auth";

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 90;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const auth = requireBearerAuth({ headers: req.headers as Record<string, string> });
  if (!auth.authorized) {
    return res.status(401).json({ error: auth.message ?? "Unauthorized" });
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const limitParam = req.query.limit;
  const limit = Math.min(
    typeof limitParam === "string" ? parseInt(limitParam, 10) || DEFAULT_LIMIT : DEFAULT_LIMIT,
    MAX_LIMIT
  );

  const rows = await db
    .select()
    .from(oilPrices)
    .orderBy(desc(oilPrices.recordedAt))
    .limit(limit);

  return res.status(200).json({ data: rows });
}
