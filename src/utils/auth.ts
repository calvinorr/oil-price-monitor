const SECRET = process.env.CRON_SECRET_TOKEN;

export function requireBearerAuth({ headers }: { headers: Record<string, string | string[] | undefined> }) {
  if (!SECRET) {
    return { authorized: false, message: "CRON_SECRET_TOKEN not configured" };
  }

  const authHeader = headers["authorization"] ?? headers["Authorization"];
  if (!authHeader) return { authorized: false, message: "Missing Authorization header" };

  const headerValue = Array.isArray(authHeader) ? authHeader[0] : authHeader;
  const [scheme, token] = headerValue.split(" ");
  if (scheme !== "Bearer" || token !== SECRET) {
    return { authorized: false, message: "Invalid token" };
  }

  return { authorized: true };
}
