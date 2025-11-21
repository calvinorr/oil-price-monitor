import { Resend } from "resend";
import type { Aggregates, SupplierRow } from "../types";

const emailEnabled = process.env.EMAIL_ENABLED !== "false";
const resendApiKey = process.env.RESEND_API_KEY;
const fromAddress = process.env.EMAIL_FROM || "oil-monitor@mg.calvinorr.com";
const warnOnce = (() => {
  let warned = false;
  return (msg: string) => {
    if (!warned) {
      console.warn(msg);
      warned = true;
    }
  };
})();

if (!emailEnabled) {
  console.info("Email sending disabled via EMAIL_ENABLED=false");
}
if (!resendApiKey && emailEnabled) {
  warnOnce("RESEND_API_KEY not set; email sending will fail.");
}

type EmailContext = {
  to: string;
  aggregates: Aggregates;
  dailyChange: number | null;
  dailyChangePct: number | null;
  alertTriggered: boolean;
  alertReason?: string;
  suppliersPreview: SupplierRow[];
};

export async function sendDailyEmail(ctx: EmailContext) {
  if (!emailEnabled) {
    return { success: true, skipped: true };
  }

  if (!resendApiKey) {
    return { success: false, errorMessage: "Missing RESEND_API_KEY" };
  }

  const resend = new Resend(resendApiKey);

  const subject = `Heating Oil Daily: £${ctx.aggregates.cheapestPrice900L.toFixed(2)} (cheapest)`;
  const html = buildHtml(ctx);

  try {
    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to: ctx.to,
      subject,
      html,
    });

    if (error) {
      return { success: false, errorMessage: error.message };
    }

    return { success: true, responseId: data?.id };
  } catch (err: any) {
    return { success: false, errorMessage: err?.message ?? "Email send failed" };
  }
}

function buildHtml(ctx: EmailContext) {
  const { aggregates, dailyChange, dailyChangePct, alertTriggered, alertReason, suppliersPreview } = ctx;
  const rows = suppliersPreview
    .map(
      (s) => `
      <tr>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;">${s.name}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;">£${s.price900L.toFixed(2)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;">${s.ppl.toFixed(2)} ppl</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;">${s.updated}</td>
      </tr>
    `,
    )
    .join("\n");

  const trendLine =
    dailyChange !== null && dailyChangePct !== null
      ? `Change vs prev: £${dailyChange.toFixed(2)} (${dailyChangePct.toFixed(2)}%)`
      : "First run; no previous comparison.";

  const alertLine = alertTriggered && alertReason
    ? `<p style="color:#16a34a;font-weight:600">Alert: ${alertReason}</p>`
    : "";

  return `
    <div style="font-family:Arial, sans-serif;">
      <h2>Heating Oil Daily</h2>
      ${alertLine}
      <p><strong>Cheapest:</strong> £${aggregates.cheapestPrice900L.toFixed(2)} (${aggregates.cheapestSupplier})</p>
      <p><strong>Average 900L:</strong> £${aggregates.avgPrice900L.toFixed(2)} | <strong>Avg ppl:</strong> ${aggregates.avgPpl.toFixed(2)}</p>
      <p>${trendLine}</p>
      <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;min-width:400px;margin-top:12px;">
        <thead>
          <tr>
            <th align="left" style="padding:6px 8px;border-bottom:2px solid #222;">Supplier</th>
            <th align="left" style="padding:6px 8px;border-bottom:2px solid #222;">900L</th>
            <th align="left" style="padding:6px 8px;border-bottom:2px solid #222;">ppl</th>
            <th align="left" style="padding:6px 8px;border-bottom:2px solid #222;">Updated</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  `;
}
