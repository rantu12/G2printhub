import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";

export async function consumeAuthRateLimit(
  scope: string,
  identity: string,
  limit: number,
  windowMs: number,
): Promise<boolean> {
  const keyHash = createHash("sha256")
    .update(`${scope}:${identity}`)
    .digest("hex");
  const now = new Date();
  const windowStart = new Date(now.getTime() - windowMs);
  const rows = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO "AuthRateLimit" ("keyHash", "count", "windowStartedAt")
    VALUES (${keyHash}, 1, ${now})
    ON CONFLICT ("keyHash") DO UPDATE
    SET
      "count" = CASE
        WHEN "AuthRateLimit"."windowStartedAt" <= ${windowStart} THEN 1
        ELSE "AuthRateLimit"."count" + 1
      END,
      "windowStartedAt" = CASE
        WHEN "AuthRateLimit"."windowStartedAt" <= ${windowStart} THEN ${now}
        ELSE "AuthRateLimit"."windowStartedAt"
      END
    RETURNING "count"
  `;

  return rows[0]?.count <= limit;
}

export function getRequestIdentity(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  return (forwardedFor?.split(",")[0] ?? realIp ?? "unknown").trim();
}
