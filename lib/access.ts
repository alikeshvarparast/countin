import { and, desc, eq, inArray, like, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { communities, memberships, users } from "@/lib/db/schema";
import { looksLikeCommunityUid, normalizeCommunityUid } from "@/lib/id";

const STAFF_ROLES = ["owner", "admin"] as const;

export function getCommunityBySlug(slug: string) {
  return db.select().from(communities).where(eq(communities.slug, slug)).get();
}

export function getCommunityByInviteToken(token: string) {
  const inviteToken = token.trim();
  if (!inviteToken) return undefined;
  return db.select().from(communities).where(eq(communities.inviteToken, inviteToken)).get();
}

function memberCommunityIds(userId: string) {
  return db
    .select({ communityId: memberships.communityId })
    .from(memberships)
    .where(
      and(
        eq(memberships.userId, userId),
        inArray(memberships.status, ["approved", "suspended"]),
      ),
    )
    .all()
    .map((row) => row.communityId);
}

export function searchCommunities(q?: string, userId?: string) {
  const query = (q ?? "").trim();
  const mine = userId ? memberCommunityIds(userId) : [];
  const visible = (club: { id: string; isPublic: boolean }) => club.isPublic || mine.includes(club.id);

  if (!query) {
    return db
      .select()
      .from(communities)
      .orderBy(desc(communities.createdAt))
      .all()
      .filter(visible);
  }

  const safe = query.replace(/[%_]/g, "");
  const uid = normalizeCommunityUid(safe);

  if (looksLikeCommunityUid(query)) {
    return db
      .select()
      .from(communities)
      .where(or(eq(communities.uid, uid), like(communities.uid, `%${uid}%`)))
      .orderBy(desc(communities.createdAt))
      .all();
  }

  return db
    .select()
    .from(communities)
    .where(or(eq(communities.uid, uid), like(communities.name, `%${safe}%`)))
    .orderBy(desc(communities.createdAt))
    .all()
    .filter(visible);
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

export function isOwner(communityId: string, userId: string) {
  const community = db.select().from(communities).where(eq(communities.id, communityId)).get();
  if (community?.createdById === userId) return true;
  const row = getApprovedMembership(communityId, userId);
  return row?.role === "owner";
}

export function isStaff(communityId: string, userId: string) {
  if (isOwner(communityId, userId)) return true;
  const row = getApprovedMembership(communityId, userId);
  return row?.role === "admin";
}

/** Owner or admin — used for events, polls, and waitlist. */
export function isAdmin(communityId: string, userId: string) {
  return isStaff(communityId, userId);
}

export function getClubMembership(communityId: string, userId: string) {
  return db
    .select()
    .from(memberships)
    .where(
      and(
        eq(memberships.communityId, communityId),
        eq(memberships.userId, userId),
        inArray(memberships.status, ["approved", "suspended"]),
      ),
    )
    .get();
}

export function isSuspended(communityId: string, userId: string) {
  return getClubMembership(communityId, userId)?.status === "suspended";
}

export function requireActiveMember(communityId: string, userId: string) {
  const membership = requireMember(communityId, userId);
  if (isSuspended(communityId, userId)) {
    throw new Error("Your membership is suspended.");
  }
  return membership;
}

export function requireMember(communityId: string, userId: string) {
  const membership = getApprovedMembership(communityId, userId);
  if (!membership) throw new Error("You are not a member of this community.");
  return membership;
}

export function requireStaff(communityId: string, userId: string) {
  const membership = requireMember(communityId, userId);
  if (membership.role !== "owner" && membership.role !== "admin" && !isOwner(communityId, userId)) {
    throw new Error("Only owners and admins can do that.");
  }
  return membership;
}

export function requireAdmin(communityId: string, userId: string) {
  return requireStaff(communityId, userId);
}

export function requireOwner(communityId: string, userId: string) {
  const membership = requireMember(communityId, userId);
  if (!isOwner(communityId, userId)) throw new Error("Only the community owner can do that.");
  return membership;
}

export function listMemberClubs(userId: string) {
  return db
    .select({
      id: communities.id,
      slug: communities.slug,
      name: communities.name,
    })
    .from(memberships)
    .innerJoin(communities, eq(communities.id, memberships.communityId))
    .where(
      and(
        eq(memberships.userId, userId),
        inArray(memberships.status, ["approved", "suspended"]),
      ),
    )
    .all();
}

export function hintedMemberClub(userId: string, hintedSlug?: string | null) {
  const clubs = listMemberClubs(userId);
  const slug = clubs.find((c) => c.slug === hintedSlug)?.slug ?? clubs[0]?.slug;
  if (!slug) return undefined;
  return getCommunityBySlug(slug);
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
        inArray(memberships.role, [...STAFF_ROLES]),
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
      imageUrl: users.imageUrl,
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
