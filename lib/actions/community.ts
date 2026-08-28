"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/auth";
import { getClubMembership, getCommunityBySlug, listAdmins, requireAdmin, requireMember, requireOwner } from "@/lib/access";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { communities, memberships, users } from "@/lib/db/schema";
import { createCommunityUid, createId, createInviteToken, now } from "@/lib/id";
import { saveImageUpload } from "@/lib/uploads";
import { notify, notifyMany } from "@/lib/notify";
import { CURRENCIES, TIMEZONES, slugify } from "@/lib/utils";

export async function createCommunity(formData: FormData) {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();
  const timezone = String(formData.get("timezone") ?? "America/Toronto");
  const currency = String(formData.get("currency") ?? "CAD");
  const isPublic = String(formData.get("isPublic") ?? "") === "on";

  if (name.length < 2) return { error: "Give the community a name." };
  if (!TIMEZONES.includes(timezone as (typeof TIMEZONES)[number])) {
    return { error: "Pick a valid timezone." };
  }
  if (!CURRENCIES.includes(currency as (typeof CURRENCIES)[number])) {
    return { error: "Pick a valid currency." };
  }

  let slug = slugify(name);
  let n = 1;
  while (db.select().from(communities).where(eq(communities.slug, slug)).get()) {
    slug = `${slugify(name)}-${++n}`;
  }

  const id = createId();
  const t = now();
  let uid = createCommunityUid();
  while (db.select().from(communities).where(eq(communities.uid, uid)).get()) {
    uid = createCommunityUid();
  }
  let inviteToken = createInviteToken();
  while (db.select().from(communities).where(eq(communities.inviteToken, inviteToken)).get()) {
    inviteToken = createInviteToken();
  }

  let imageUrl: string | null = null;
  try {
    imageUrl = await saveImageUpload(formData.get("avatar") as File | null, "communities", id);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not save the picture." };
  }

  db.insert(communities)
    .values({
      id,
      name,
      slug,
      uid,
      inviteToken,
      imageUrl,
      description: description || null,
      location: location || null,
      timezone,
      currency,
      isPublic,
      createdById: user.id,
      createdAt: t,
    })
    .run();

  db.insert(memberships)
    .values({
      id: createId(),
      communityId: id,
      userId: user.id,
      role: "owner",
      status: "approved",
      createdAt: t,
      updatedAt: t,
    })
    .run();

  audit({
    communityId: id,
    actorId: user.id,
    action: "community.create",
    entityType: "community",
    entityId: id,
  });

  revalidatePath("/communities");
  revalidatePath("/");
  revalidatePath("/app");
  return { ok: true, slug };
}

export async function updateCommunitySettings(formData: FormData) {
  const user = await requireUser();
  const slug = String(formData.get("slug") ?? "");
  const community = getCommunityBySlug(slug);
  if (!community) return { error: "Community not found." };
  requireOwner(community.id, user.id);

  const description = String(formData.get("description") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();
  const timezone = String(formData.get("timezone") ?? community.timezone);
  const currency = String(formData.get("currency") ?? community.currency);
  const name = String(formData.get("name") ?? community.name).trim();
  const isPublic = String(formData.get("isPublic") ?? "") === "on";

  if (name.length < 2) return { error: "Name is required." };
  if (!TIMEZONES.includes(timezone as (typeof TIMEZONES)[number])) {
    return { error: "Pick a valid timezone." };
  }
  if (!CURRENCIES.includes(currency as (typeof CURRENCIES)[number])) {
    return { error: "Pick a valid currency." };
  }

  let imageUrl = community.imageUrl;
  try {
    const uploaded = await saveImageUpload(formData.get("avatar") as File | null, "communities", community.id);
    if (uploaded) imageUrl = uploaded;
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not save the picture." };
  }

  db.update(communities)
    .set({
      name,
      description: description || null,
      location: location || null,
      timezone,
      currency,
      imageUrl,
      isPublic,
    })
    .where(eq(communities.id, community.id))
    .run();

  audit({
    communityId: community.id,
    actorId: user.id,
    action: "community.update",
    entityType: "community",
    entityId: community.id,
    meta: { timezone, currency, isPublic },
  });

  revalidatePath(`/app/c/${slug}`);
  revalidatePath(`/communities/${slug}`);
  revalidatePath("/");
  return { ok: true };
}

export async function updateCommunityPhoto(formData: FormData) {
  const user = await requireUser();
  const slug = String(formData.get("slug") ?? "");
  const community = getCommunityBySlug(slug);
  if (!community) return { error: "Community not found." };
  requireAdmin(community.id, user.id);

  let imageUrl: string | null = null;
  try {
    imageUrl = await saveImageUpload(formData.get("avatar"), "communities", community.id);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not save the picture." };
  }
  if (!imageUrl) return { error: "Choose a picture." };

  db.update(communities).set({ imageUrl }).where(eq(communities.id, community.id)).run();
  audit({
    communityId: community.id,
    actorId: user.id,
    action: "community.photo",
    entityType: "community",
    entityId: community.id,
  });
  revalidatePath(`/app/c/${slug}`);
  revalidatePath(`/communities/${slug}`);
  revalidatePath("/");
  return { ok: true, imageUrl };
}

export async function requestJoin(slug: string) {
  const user = await requireUser();
  const community = getCommunityBySlug(slug);
  if (!community) return { error: "Community not found." };
  if (!community.isPublic) {
    return { error: "This community is private. Ask an admin for an invite link." };
  }

  const existing = db
    .select()
    .from(memberships)
    .where(and(eq(memberships.communityId, community.id), eq(memberships.userId, user.id)))
    .get();

  if (existing?.status === "approved") return { error: "You are already a member." };
  if (existing?.status === "pending") return { error: "Your request is already waiting." };

  const t = now();
  if (existing) {
    db.update(memberships)
      .set({ status: "pending", role: "member", updatedAt: t })
      .where(eq(memberships.id, existing.id))
      .run();
  } else {
    db.insert(memberships)
      .values({
        id: createId(),
        communityId: community.id,
        userId: user.id,
        role: "member",
        status: "pending",
        createdAt: t,
        updatedAt: t,
      })
      .run();
  }

  const admins = listAdmins(community.id);
  await notifyMany(
    admins.map((a) => a.userId),
    {
      communityId: community.id,
      type: "join_request",
      title: `Join request · ${community.name}`,
      body: `${user.name} asked to join ${community.name}.`,
      href: `/app/c/${community.slug}/members`,
    },
  );

  revalidatePath(`/communities/${slug}`);
  revalidatePath(`/app/c/${slug}/members`);
  return { ok: true };
}

export async function decideMembership(formData: FormData) {
  const user = await requireUser();
  const membershipId = String(formData.get("membershipId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const membership = db.select().from(memberships).where(eq(memberships.id, membershipId)).get();
  if (!membership) return { error: "Request not found." };
  const community = db.select().from(communities).where(eq(communities.id, membership.communityId)).get();
  if (!community) return { error: "Community not found." };
  requireAdmin(community.id, user.id);

  if (decision !== "approved" && decision !== "rejected") {
    return { error: "Invalid decision." };
  }

  db.update(memberships)
    .set({ status: decision, updatedAt: now() })
    .where(eq(memberships.id, membershipId))
    .run();

  audit({
    communityId: community.id,
    actorId: user.id,
    action: decision === "approved" ? "membership.approve" : "membership.reject",
    entityType: "membership",
    entityId: membershipId,
  });

  await notify({
    userId: membership.userId,
    communityId: community.id,
    type: decision === "approved" ? "join_approved" : "join_rejected",
    title:
      decision === "approved"
        ? `You're in · ${community.name}`
        : `Request declined · ${community.name}`,
    body:
      decision === "approved"
        ? `${user.name} approved your request to join ${community.name}.`
        : `Your request to join ${community.name} was declined.`,
    href: decision === "approved" ? `/app/c/${community.slug}` : `/communities/${community.slug}`,
  });

  revalidatePath(`/app/c/${community.slug}/members`);
  revalidatePath(`/communities/${community.slug}`);
  return { ok: true };
}

export async function addMemberByEmail(formData: FormData) {
  const user = await requireUser();
  const slug = String(formData.get("slug") ?? "");
  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  const community = getCommunityBySlug(slug);
  if (!community) return { error: "Community not found." };
  requireAdmin(community.id, user.id);

  const target = db.select().from(users).where(eq(users.email, email)).get();
  if (!target) return { error: "No account with that email. They need to register first." };

  const existing = db
    .select()
    .from(memberships)
    .where(and(eq(memberships.communityId, community.id), eq(memberships.userId, target.id)))
    .get();

  const t = now();
  if (existing) {
    db.update(memberships)
      .set({ status: "approved", updatedAt: t })
      .where(eq(memberships.id, existing.id))
      .run();
  } else {
    db.insert(memberships)
      .values({
        id: createId(),
        communityId: community.id,
        userId: target.id,
        role: "member",
        status: "approved",
        createdAt: t,
        updatedAt: t,
      })
      .run();
  }

  audit({
    communityId: community.id,
    actorId: user.id,
    action: "membership.add",
    entityType: "user",
    entityId: target.id,
  });

  await notify({
    userId: target.id,
    communityId: community.id,
    type: "join_approved",
    title: `Added to ${community.name}`,
    body: `${user.name} added you to ${community.name}.`,
    href: `/app/c/${community.slug}`,
  });

  revalidatePath(`/app/c/${slug}/members`);
  return { ok: true };
}

export async function regenerateInviteLink(formData: FormData) {
  const user = await requireUser();
  const slug = String(formData.get("slug") ?? "");
  const community = getCommunityBySlug(slug);
  if (!community) return { error: "Community not found." };
  requireOwner(community.id, user.id);

  let inviteToken = createInviteToken();
  while (db.select().from(communities).where(eq(communities.inviteToken, inviteToken)).get()) {
    inviteToken = createInviteToken();
  }
  db.update(communities).set({ inviteToken }).where(eq(communities.id, community.id)).run();

  audit({
    communityId: community.id,
    actorId: user.id,
    action: "community.invite.regenerate",
    entityType: "community",
    entityId: community.id,
  });

  revalidatePath(`/app/c/${slug}/settings`);
  return { ok: true };
}

export async function setMembershipRole(formData: FormData) {
  const user = await requireUser();
  const membershipId = String(formData.get("membershipId") ?? "");
  const role = String(formData.get("role") ?? "");
  const membership = db.select().from(memberships).where(eq(memberships.id, membershipId)).get();
  if (!membership) return { error: "Member not found." };
  const community = db.select().from(communities).where(eq(communities.id, membership.communityId)).get();
  if (!community) return { error: "Community not found." };
  requireOwner(community.id, user.id);

  if (role !== "admin" && role !== "member") return { error: "Pick admin or member." };
  if (membership.userId === community.createdById || membership.role === "owner") {
    return { error: "The owner role cannot be changed." };
  }

  db.update(memberships)
    .set({ role, updatedAt: now() })
    .where(eq(memberships.id, membershipId))
    .run();

  audit({
    communityId: community.id,
    actorId: user.id,
    action: role === "admin" ? "membership.promote" : "membership.demote",
    entityType: "membership",
    entityId: membershipId,
    meta: { role },
  });

  revalidatePath(`/app/c/${community.slug}/members`);
  return { ok: true };
}

export async function setMembershipStatus(formData: FormData) {
  const user = await requireUser();
  const membershipId = String(formData.get("membershipId") ?? "");
  const status = String(formData.get("status") ?? "");
  const membership = db.select().from(memberships).where(eq(memberships.id, membershipId)).get();
  if (!membership) return { error: "Member not found." };
  const community = db.select().from(communities).where(eq(communities.id, membership.communityId)).get();
  if (!community) return { error: "Community not found." };
  requireOwner(community.id, user.id);
  if (membership.userId === community.createdById || membership.role === "owner") {
    return { error: "The owner cannot be removed or suspended." };
  }
  if (status !== "suspended" && status !== "approved" && status !== "removed") {
    return { error: "Invalid status." };
  }
  if (status === "removed") {
    db.delete(memberships).where(eq(memberships.id, membership.id)).run();
  } else {
    db.update(memberships)
      .set({ status, updatedAt: now() })
      .where(eq(memberships.id, membership.id))
      .run();
  }
  audit({
    communityId: community.id,
    actorId: user.id,
    action: status === "removed" ? "membership.remove" : `membership.${status}`,
    entityType: "membership",
    entityId: membership.id,
  });
  await notify({
    userId: membership.userId,
    communityId: community.id,
    type: status === "removed" ? "membership_removed" : status === "suspended" ? "membership_suspended" : "membership_restored",
    title:
      status === "removed"
        ? `Removed from ${community.name}`
        : status === "suspended"
          ? `Suspended · ${community.name}`
          : `Restored · ${community.name}`,
    body:
      status === "removed"
        ? "You are no longer a member of this community."
        : status === "suspended"
          ? "You can still open the clubhouse, but you cannot vote or see poll details until restored."
          : "Your membership is active again.",
    href: status === "removed" ? `/communities/${community.slug}` : `/app/c/${community.slug}`,
  });
  revalidatePath(`/app/c/${community.slug}/members`);
  return { ok: true };
}

export async function acceptLedgerDisclaimer(formData: FormData) {
  const user = await requireUser();
  const slug = String(formData.get("slug") ?? "");
  const community = getCommunityBySlug(slug);
  if (!community) return { error: "Community not found." };
  const membership = getClubMembership(community.id, user.id);
  if (!membership) return { error: "You are not a member of this community." };
  db.update(memberships)
    .set({ ledgerAcceptedAt: now(), updatedAt: now() })
    .where(eq(memberships.id, membership.id))
    .run();
  revalidatePath(`/app/c/${slug}`, "layout");
  revalidatePath(`/app/c/${slug}/ledger`);
  return { ok: true };
}

export async function deleteCommunity(formData: FormData) {
  const user = await requireUser();
  const slug = String(formData.get("slug") ?? "");
  const community = getCommunityBySlug(slug);
  if (!community) return { error: "Community not found." };
  requireOwner(community.id, user.id);
  const { sqlite } = await import("@/lib/db");
  sqlite.pragma("foreign_keys = OFF");
  const id = community.id;
  sqlite.exec(`
    DELETE FROM vote_logs WHERE poll_id IN (SELECT id FROM club_polls WHERE community_id = '${id}')
      OR poll_id IN (SELECT p.id FROM polls p JOIN weekly_events e ON e.id = p.event_id WHERE e.community_id = '${id}');
    DELETE FROM poll_suggestions WHERE poll_id IN (SELECT id FROM club_polls WHERE community_id = '${id}')
      OR poll_id IN (SELECT p.id FROM polls p JOIN weekly_events e ON e.id = p.event_id WHERE e.community_id = '${id}');
    DELETE FROM club_poll_votes WHERE option_id IN (SELECT o.id FROM club_poll_options o JOIN club_polls p ON p.id = o.poll_id WHERE p.community_id = '${id}');
    DELETE FROM club_poll_options WHERE poll_id IN (SELECT id FROM club_polls WHERE community_id = '${id}');
    DELETE FROM club_polls WHERE community_id = '${id}';
    DELETE FROM votes WHERE option_id IN (SELECT o.id FROM poll_options o JOIN polls p ON p.id = o.poll_id JOIN weekly_events e ON e.id = p.event_id WHERE e.community_id = '${id}');
    DELETE FROM poll_options WHERE poll_id IN (SELECT p.id FROM polls p JOIN weekly_events e ON e.id = p.event_id WHERE e.community_id = '${id}');
    DELETE FROM polls WHERE event_id IN (SELECT id FROM weekly_events WHERE community_id = '${id}');
    DELETE FROM event_guests WHERE weekly_event_id IN (SELECT id FROM weekly_events WHERE community_id = '${id}')
      OR session_id IN (SELECT id FROM season_sessions WHERE community_id = '${id}');
    DELETE FROM rsvps WHERE event_id IN (SELECT id FROM weekly_events WHERE community_id = '${id}');
    DELETE FROM ledger_entries WHERE community_id = '${id}';
    DELETE FROM chat_reactions WHERE message_id IN (SELECT id FROM chat_messages WHERE community_id = '${id}');
    DELETE FROM chat_messages WHERE community_id = '${id}';
    DELETE FROM invitations WHERE session_id IN (SELECT id FROM season_sessions WHERE community_id = '${id}');
    DELETE FROM session_slots WHERE session_id IN (SELECT id FROM season_sessions WHERE community_id = '${id}');
    DELETE FROM season_signups WHERE season_id IN (SELECT id FROM seasons WHERE community_id = '${id}');
    DELETE FROM contracts WHERE season_id IN (SELECT id FROM seasons WHERE community_id = '${id}');
    DELETE FROM season_sessions WHERE community_id = '${id}';
    DELETE FROM seasons WHERE community_id = '${id}';
    DELETE FROM weekly_events WHERE community_id = '${id}';
    DELETE FROM notifications WHERE community_id = '${id}';
    DELETE FROM audit_logs WHERE community_id = '${id}';
    DELETE FROM memberships WHERE community_id = '${id}';
    DELETE FROM communities WHERE id = '${id}';
  `);
  sqlite.pragma("foreign_keys = ON");
  revalidatePath("/");
  return { ok: true, deleted: true };
}

export async function updateProfile(formData: FormData) {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  const telegramUsername = String(formData.get("telegram") ?? "")
    .trim()
    .replace(/^@/, "");
  const whatsappPhone = String(formData.get("whatsapp") ?? "").trim();
  if (name.length < 2) return { error: "Enter your name." };
  if (telegramUsername.length < 3) return { error: "Enter a Telegram username or ID." };

  const current = db.select().from(users).where(eq(users.id, user.id)).get();
  const telegramChanged = current && current.telegramUsername !== telegramUsername;

  let imageUrl = current?.imageUrl ?? null;
  try {
    const uploaded = await saveImageUpload(formData.get("avatar") as File | null, "users", user.id);
    if (uploaded) imageUrl = uploaded;
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not save the picture." };
  }

  db.update(users)
    .set({
      name,
      telegramUsername,
      whatsappPhone: whatsappPhone || null,
      imageUrl,
      ...(telegramChanged ? { telegramChatId: null, telegramLinkToken: createId() } : {}),
    })
    .where(eq(users.id, user.id))
    .run();

  revalidatePath("/app/profile");
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateProfilePhoto(formData: FormData) {
  const user = await requireUser();
  let imageUrl: string | null = null;
  try {
    imageUrl = await saveImageUpload(formData.get("avatar"), "users", user.id);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not save the picture." };
  }
  if (!imageUrl) return { error: "Choose a picture." };

  db.update(users).set({ imageUrl }).where(eq(users.id, user.id)).run();
  revalidatePath("/app/profile");
  revalidatePath("/", "layout");
  revalidatePath("/app");
  return { ok: true, imageUrl };
}

export async function regenerateTelegramLink() {
  const user = await requireUser();
  db.update(users)
    .set({ telegramLinkToken: createId(), telegramChatId: null })
    .where(eq(users.id, user.id))
    .run();
  revalidatePath("/app/profile");
  return { ok: true };
}

export async function requireCommunityMember(slug: string) {
  const user = await requireUser();
  const community = getCommunityBySlug(slug);
  if (!community) throw new Error("Community not found.");
  const membership = requireMember(community.id, user.id);
  return { user, community, membership };
}
