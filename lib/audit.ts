import { and, count, desc, eq, gte, lte, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";
import { createId, now } from "@/lib/id";
import { zonedDateTimeToUtcMs } from "@/lib/timezone";

export function audit(input: {
  communityId: string;
  actorId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  meta?: Record<string, unknown>;
}) {
  db.insert(auditLogs)
    .values({
      id: createId(),
      communityId: input.communityId,
      actorId: input.actorId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      meta: input.meta ? JSON.stringify(input.meta) : null,
      createdAt: now(),
    })
    .run();
}

export function parseLogDate(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  return value;
}

function logRange(communityId: string, from?: string, to?: string, timeZone = "UTC") {
  const filters: SQL[] = [eq(auditLogs.communityId, communityId)];
  const fromDay = parseLogDate(from);
  const toDay = parseLogDate(to);
  if (fromDay) filters.push(gte(auditLogs.createdAt, zonedDateTimeToUtcMs(fromDay, "00:00", timeZone)));
  if (toDay) filters.push(lte(auditLogs.createdAt, zonedDateTimeToUtcMs(toDay, "23:59", timeZone) + 59_999));
  return and(...filters);
}

export function countCommunityLogs(communityId: string, from?: string, to?: string, timeZone = "UTC") {
  return (
    db
      .select({ n: count() })
      .from(auditLogs)
      .where(logRange(communityId, from, to, timeZone))
      .get()?.n ?? 0
  );
}

export function listCommunityLogs(
  communityId: string,
  {
    from,
    to,
    timeZone = "UTC",
    limit,
    offset = 0,
  }: { from?: string; to?: string; timeZone?: string; limit: number; offset?: number },
) {
  return db
    .select()
    .from(auditLogs)
    .where(logRange(communityId, from, to, timeZone))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit)
    .offset(offset)
    .all();
}
