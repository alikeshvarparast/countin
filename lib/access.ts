import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { communities, memberships, users } from "@/lib/db/schema";

export function getCommunityBySlug(slug: string) {
  return db.select().from(communities).where(eq(communities.slug, slug)).get();
}

export function getApprovedMembership(communityId: string, userId: string) {
  return db
    .select()
    .from(memberships)
    .where(
      and(
        eq(memberships.communityId, communityId),
        eq(memberships.userId, userId),
        eq(memberships.status, "approved"),
      ),
    )
    .get();
}

export function isAdmin(communityId: string, userId: string) {
  const row = getApprovedMembership(communityId, userId);
  return row?.role === "admin";
}

export function requireMember(communityId: string, userId: string) {
  const membership = getApprovedMembership(communityId, userId);
  if (!membership) throw new Error("You are not a member of this community.");
  return membership;
}

export function requireAdmin(communityId: string, userId: string) {
  const membership = requireMember(communityId, userId);
  if (membership.role !== "admin") throw new Error("Only admins can do that.");
  return membership;
}

export function listAdmins(communityId: string) {
  return db
    .select({
      userId: memberships.userId,
      name: users.name,
      email: users.email,
    })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(
      and(
        eq(memberships.communityId, communityId),
        eq(memberships.status, "approved"),
        eq(memberships.role, "admin"),
      ),
    )
    .all();
}

export function listApprovedMembers(communityId: string) {
  return db
    .select({
      membershipId: memberships.id,
      userId: memberships.userId,
      role: memberships.role,
      name: users.name,
      email: users.email,
      telegramUsername: users.telegramUsername,
    })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(and(eq(memberships.communityId, communityId), eq(memberships.status, "approved")))
    .all();
}

export function primaryAdminId(communityId: string) {
  const community = db.select().from(communities).where(eq(communities.id, communityId)).get();
  if (!community) throw new Error("Community not found.");
  return community.createdById;
}
