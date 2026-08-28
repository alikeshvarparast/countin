import { and, eq } from "drizzle-orm";
import { getCommunityByInviteToken } from "@/lib/access";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { memberships } from "@/lib/db/schema";
import { createId, now } from "@/lib/id";

export function acceptInviteMembership(token: string, userId: string) {
  const community = getCommunityByInviteToken(token);
  if (!community) return { error: "This invite link is not valid." };

  const existing = db
    .select()
    .from(memberships)
    .where(and(eq(memberships.communityId, community.id), eq(memberships.userId, userId)))
    .get();

  const t = now();
  if (existing?.status === "approved") {
    return { ok: true as const, slug: community.slug };
  }
  if (existing) {
    db.update(memberships)
      .set({ status: "approved", role: existing.role === "owner" ? "owner" : "member", updatedAt: t })
      .where(eq(memberships.id, existing.id))
      .run();
  } else {
    db.insert(memberships)
      .values({
        id: createId(),
        communityId: community.id,
        userId,
        role: "member",
        status: "approved",
        createdAt: t,
        updatedAt: t,
      })
      .run();
  }

  audit({
    communityId: community.id,
    actorId: userId,
    action: "membership.invite",
    entityType: "membership",
    entityId: userId,
  });

  return { ok: true as const, slug: community.slug };
}
