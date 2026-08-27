import { db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";
import { createId, now } from "@/lib/id";

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
