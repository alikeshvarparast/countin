"use server";

import { and, eq, gte } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/auth";
import {
  getCommunityBySlug,
  listAdmins,
  listApprovedMembers,
  primaryAdminId,
  requireAdmin,
  requireMember,
} from "@/lib/access";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import {
  communities,
  contracts,
  invitations,
  ledgerEntries,
  seasonSessions,
  seasons,
  sessionSlots,
  users,
} from "@/lib/db/schema";
import { createId, now } from "@/lib/id";
import { notify, notifyMany } from "@/lib/notify";
import { eachSeasonDate, zonedDateTimeToUtcMs } from "@/lib/timezone";

function communityPath(slug: string, rest = "") {
  return `/app/c/${slug}${rest}`;
}

function hasContract(seasonId: string, userId: string) {
  return Boolean(
    db
      .select()
      .from(contracts)
      .where(and(eq(contracts.seasonId, seasonId), eq(contracts.userId, userId)))
      .get(),
  );
}

function nonContractMemberIds(communityId: string, seasonId: string) {
  return listApprovedMembers(communityId)
    .filter((m) => !hasContract(seasonId, m.userId))
    .map((m) => m.userId);
}

export async function createSeason(formData: FormData) {
  const user = await requireUser();
  const slug = String(formData.get("slug") ?? "");
  const community = getCommunityBySlug(slug);
  if (!community) return { error: "Community not found." };
  requireAdmin(community.id, user.id);

  const name = String(formData.get("name") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim() || community.location || "";
  const startDate = String(formData.get("startDate") ?? "");
  const endDate = String(formData.get("endDate") ?? "");
  const timeLocal = String(formData.get("timeLocal") ?? "");
  const regularPrice = Number(formData.get("regularPrice") ?? "");
  const minPlayers = Number(formData.get("minPlayers") ?? 10);
  const weekdays = formData.getAll("weekday").map((v) => Number(v)).filter((n) => n >= 0 && n <= 6);

  if (name.length < 2) return { error: "Name the season." };
  if (!startDate || !endDate) return { error: "Set start and end dates." };
  if (!timeLocal) return { error: "Set the kickoff time." };
  if (weekdays.length === 0) return { error: "Pick at least one weekday." };
  if (!Number.isFinite(regularPrice) || regularPrice <= 0) return { error: "Set the regular session price." };

  const dates = eachSeasonDate(startDate, endDate, weekdays);
  if (dates.length === 0) return { error: "That range has no matching weekdays." };

  const seasonId = createId();
  const t = now();
  db.insert(seasons)
    .values({
      id: seasonId,
      communityId: community.id,
      name,
      location: location || null,
      startDate,
      endDate,
      weekdays: JSON.stringify(weekdays),
      timeLocal,
      regularPriceCents: Math.round(regularPrice * 100),
      minPlayers: Number.isFinite(minPlayers) ? minPlayers : 10,
      createdAt: t,
    })
    .run();

  for (const date of dates) {
    db.insert(seasonSessions)
      .values({
        id: createId(),
        seasonId,
        communityId: community.id,
        startsAt: zonedDateTimeToUtcMs(date, timeLocal, community.timezone),
        status: "scheduled",
        createdAt: t,
      })
      .run();
  }

  audit({
    communityId: community.id,
    actorId: user.id,
    action: "season.create",
    entityType: "season",
    entityId: seasonId,
    meta: { sessions: dates.length },
  });

  await notifyMany(
    listApprovedMembers(community.id).map((m) => m.userId),
    {
      communityId: community.id,
      type: "new_season",
      title: `Season opened · ${name}`,
      body: `${dates.length} sessions are on the calendar for ${community.name}.`,
      href: communityPath(community.slug, `/seasons/${seasonId}`),
    },
  );

  revalidatePath(communityPath(community.slug, "/seasons"));
  return { ok: true, id: seasonId };
}

export async function addContract(formData: FormData) {
  const user = await requireUser();
  const seasonId = String(formData.get("seasonId") ?? "");
  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  const prepaid = String(formData.get("prepaid") ?? "on") === "on";
  const season = db.select().from(seasons).where(eq(seasons.id, seasonId)).get();
  if (!season) return { error: "Season not found." };
  requireAdmin(season.communityId, user.id);

  const target = db.select().from(users).where(eq(users.email, email)).get();
  if (!target) return { error: "No account with that email." };
  requireMember(season.communityId, target.id);
  if (hasContract(seasonId, target.id)) return { error: "They already have a contract." };

  const t = now();
  db.insert(contracts)
    .values({
      id: createId(),
      seasonId,
      userId: target.id,
      prepaid,
      createdAt: t,
    })
    .run();

  const future = db
    .select()
    .from(seasonSessions)
    .where(and(eq(seasonSessions.seasonId, seasonId), gte(seasonSessions.startsAt, t)))
    .all();

  for (const session of future) {
    const existing = db
      .select()
      .from(sessionSlots)
      .where(and(eq(sessionSlots.sessionId, session.id), eq(sessionSlots.userId, target.id)))
      .get();
    if (existing) continue;
    db.insert(sessionSlots)
      .values({
        id: createId(),
        sessionId: session.id,
        userId: target.id,
        kind: "contract",
        status: "contract_present",
        createdAt: t,
        updatedAt: t,
      })
      .run();
  }

  const community = db.select().from(communities).where(eq(communities.id, season.communityId)).get();
  if (!community) return { error: "Community not found." };
  const adminId = primaryAdminId(community.id);
  const sessionCount = db.select().from(seasonSessions).where(eq(seasonSessions.seasonId, seasonId)).all().length;
  if (prepaid && sessionCount > 0) {
    db.insert(ledgerEntries)
      .values({
        id: createId(),
        communityId: community.id,
        fromUserId: target.id,
        toUserId: adminId,
        amountCents: season.regularPriceCents * sessionCount,
        reason: "contract_prepay",
        status: "pending",
        createdAt: t,
      })
      .run();
  }

  audit({
    communityId: community.id,
    actorId: user.id,
    action: "season.add_contract",
    entityType: "contract",
    entityId: target.id,
    meta: { seasonId, prepaid, sessionCount },
  });

  await notify({
    userId: target.id,
    communityId: community.id,
    type: "contract_added",
    title: `Contract · ${season.name}`,
    body: `You are on the prepaid list and will be marked present each session.`,
    href: communityPath(community.slug, `/seasons/${season.id}`),
  });

  revalidatePath(communityPath(community.slug, `/seasons/${season.id}`));
  revalidatePath(communityPath(community.slug, "/ledger"));
  return { ok: true };
}

export async function markContractAbsent(formData: FormData) {
  const user = await requireUser();
  const sessionId = String(formData.get("sessionId") ?? "");
  const inviteType = String(formData.get("inviteType") ?? "none");
  const inviteEmail = String(formData.get("inviteEmail") ?? "").toLowerCase().trim();
  const session = db.select().from(seasonSessions).where(eq(seasonSessions.id, sessionId)).get();
  if (!session) return { error: "Session not found." };
  requireMember(session.communityId, user.id);
  if (!hasContract(session.seasonId, user.id)) {
    return { error: "Only contract players can mark a contract absence." };
  }

  const slot = db
    .select()
    .from(sessionSlots)
    .where(and(eq(sessionSlots.sessionId, sessionId), eq(sessionSlots.userId, user.id)))
    .get();
  if (!slot || slot.status !== "contract_present") {
    return { error: "You are not marked present on this session." };
  }

  const t = now();
  db.update(sessionSlots)
    .set({ status: "contract_absent", updatedAt: t })
    .where(eq(sessionSlots.id, slot.id))
    .run();

  const community = db.select().from(communities).where(eq(communities.id, session.communityId)).get();
  const season = db.select().from(seasons).where(eq(seasons.id, session.seasonId)).get();
  if (!community || !season) return { error: "Season not found." };
  const href = communityPath(community.slug, `/sessions/${session.id}`);

  if (inviteType === "open" || inviteType === "private") {
    let toUserId: string | null = null;
    if (inviteType === "private") {
      const target = db.select().from(users).where(eq(users.email, inviteEmail)).get();
      if (!target) return { error: "No account with that email to invite." };
      if (hasContract(session.seasonId, target.id)) {
        return { error: "Replacements must be outside the contract list." };
      }
      requireMember(community.id, target.id);
      toUserId = target.id;
    }
    const invitationId = createId();
    db.insert(invitations)
      .values({
        id: invitationId,
        sessionId,
        fromUserId: user.id,
        type: inviteType,
        toUserId,
        status: "open",
        createdAt: t,
      })
      .run();

    if (inviteType === "private" && toUserId) {
      await notify({
        userId: toUserId,
        communityId: community.id,
        type: "private_invitation",
        title: `Private invite · ${season.name}`,
        body: `${user.name} invited you to take their slot at the regular rate. Your payment goes to them.`,
        href,
      });
    } else {
      await notifyMany(nonContractMemberIds(community.id, season.id), {
        communityId: community.id,
        type: "open_invitation",
        title: `Open slot · ${season.name}`,
        body: `${user.name} opened a replacement invite at the regular rate. Claim it and pay them, not a premium.`,
        href,
      });
    }
  } else {
    await notifyMany(nonContractMemberIds(community.id, season.id), {
      communityId: community.id,
      type: "slot_opened",
      title: `Premium slot open · ${season.name}`,
      body: `A contract player is out with no invite. Apply on the waitlist — this fill is 50% more and the absentee is not credited.`,
      href,
    });
  }

  await notifyMany(
    listAdmins(community.id).map((a) => a.userId),
    {
      communityId: community.id,
      type: "contract_absent",
      title: `Absence · ${season.name}`,
      body: `${user.name} marked themselves out of a contract session.`,
      href,
    },
  );

  revalidatePath(href);
  return { ok: true };
}

export async function applyOccasional(sessionId: string) {
  const user = await requireUser();
  const session = db.select().from(seasonSessions).where(eq(seasonSessions.id, sessionId)).get();
  if (!session) return { error: "Session not found." };
  requireMember(session.communityId, user.id);
  if (hasContract(session.seasonId, user.id)) {
    return { error: "Contract players are already on the list." };
  }
  const existing = db
    .select()
    .from(sessionSlots)
    .where(and(eq(sessionSlots.sessionId, sessionId), eq(sessionSlots.userId, user.id)))
    .get();
  if (existing) return { error: "You already have a place on this session." };

  const t = now();
  db.insert(sessionSlots)
    .values({
      id: createId(),
      sessionId,
      userId: user.id,
      kind: "occasional",
      status: "occasional_pending",
      createdAt: t,
      updatedAt: t,
    })
    .run();

  const community = db.select().from(communities).where(eq(communities.id, session.communityId)).get();
  const season = db.select().from(seasons).where(eq(seasons.id, session.seasonId)).get();
  if (!community || !season) return { error: "Season not found." };

  await notifyMany(
    listAdmins(community.id).map((a) => a.userId),
    {
      communityId: community.id,
      type: "waitlist_application",
      title: `Waitlist · ${season.name}`,
      body: `${user.name} applied as an occasional player (50% more than contract).`,
      href: communityPath(community.slug, `/sessions/${session.id}`),
    },
  );

  revalidatePath(communityPath(community.slug, `/sessions/${session.id}`));
  return { ok: true };
}

export async function decideWaitlist(formData: FormData) {
  const user = await requireUser();
  const slotId = String(formData.get("slotId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const slot = db.select().from(sessionSlots).where(eq(sessionSlots.id, slotId)).get();
  if (!slot) return { error: "Application not found." };
  const session = db.select().from(seasonSessions).where(eq(seasonSessions.id, slot.sessionId)).get();
  if (!session) return { error: "Session not found." };
  requireAdmin(session.communityId, user.id);
  if (slot.status !== "occasional_pending") return { error: "This is not a pending application." };

  const community = db.select().from(communities).where(eq(communities.id, session.communityId)).get();
  const season = db.select().from(seasons).where(eq(seasons.id, session.seasonId)).get();
  if (!community || !season) return { error: "Season not found." };
  const href = communityPath(community.slug, `/sessions/${session.id}`);

  if (decision === "rejected") {
    db.update(sessionSlots)
      .set({ status: "occasional_rejected", updatedAt: now() })
      .where(eq(sessionSlots.id, slotId))
      .run();
    await notify({
      userId: slot.userId,
      communityId: community.id,
      type: "waitlist_rejected",
      title: `Waitlist declined · ${season.name}`,
      body: `Your occasional request was not approved.`,
      href,
    });
    revalidatePath(href);
    return { ok: true };
  }

  if (decision !== "approved") return { error: "Invalid decision." };

  const t = now();
  db.update(sessionSlots)
    .set({ status: "occasional_approved", updatedAt: t })
    .where(eq(sessionSlots.id, slotId))
    .run();

  const premium = Math.round(season.regularPriceCents * 1.5);
  db.insert(ledgerEntries)
    .values({
      id: createId(),
      communityId: community.id,
      fromUserId: slot.userId,
      toUserId: primaryAdminId(community.id),
      amountCents: premium,
      reason: "occasional_fee",
      status: "pending",
      sessionId: session.id,
      createdAt: t,
    })
    .run();

  audit({
    communityId: community.id,
    actorId: user.id,
    action: "session.approve_occasional",
    entityType: "session_slot",
    entityId: slot.id,
  });

  await notify({
    userId: slot.userId,
    communityId: community.id,
    type: "waitlist_approved",
    title: `You're in · ${season.name}`,
    body: `Approved as occasional. You pay 50% more than the contract rate, owed to the admin.`,
    href: communityPath(community.slug, "/ledger"),
  });

  revalidatePath(href);
  revalidatePath(communityPath(community.slug, "/ledger"));
  return { ok: true };
}

export async function claimInvitation(invitationId: string) {
  const user = await requireUser();
  const invitation = db.select().from(invitations).where(eq(invitations.id, invitationId)).get();
  if (!invitation || invitation.status !== "open") return { error: "Invitation is not available." };
  const session = db.select().from(seasonSessions).where(eq(seasonSessions.id, invitation.sessionId)).get();
  if (!session) return { error: "Session not found." };
  requireMember(session.communityId, user.id);
  if (hasContract(session.seasonId, user.id)) {
    return { error: "Contract players cannot take a replacement slot." };
  }
  if (invitation.type === "private" && invitation.toUserId !== user.id) {
    return { error: "This invite is for someone else." };
  }
  const existing = db
    .select()
    .from(sessionSlots)
    .where(and(eq(sessionSlots.sessionId, session.id), eq(sessionSlots.userId, user.id)))
    .get();
  if (existing) return { error: "You already have a place on this session." };

  const t = now();
  db.update(invitations).set({ status: "claimed" }).where(eq(invitations.id, invitationId)).run();
  db.insert(sessionSlots)
    .values({
      id: createId(),
      sessionId: session.id,
      userId: user.id,
      kind: "replacement",
      status: "replacement_filled",
      invitedById: invitation.fromUserId,
      createdAt: t,
      updatedAt: t,
    })
    .run();

  const community = db.select().from(communities).where(eq(communities.id, session.communityId)).get();
  const season = db.select().from(seasons).where(eq(seasons.id, session.seasonId)).get();
  if (!community || !season) return { error: "Season not found." };

  db.insert(ledgerEntries)
    .values({
      id: createId(),
      communityId: community.id,
      fromUserId: user.id,
      toUserId: invitation.fromUserId,
      amountCents: season.regularPriceCents,
      reason: "replacement_to_player",
      status: "pending",
      sessionId: session.id,
      createdAt: t,
    })
    .run();

  audit({
    communityId: community.id,
    actorId: user.id,
    action: "session.claim_invite",
    entityType: "invitation",
    entityId: invitation.id,
  });

  await notify({
    userId: invitation.fromUserId,
    communityId: community.id,
    type: "invitation_claimed",
    title: `Replacement found · ${season.name}`,
    body: `${user.name} took your slot at the regular rate. That payment is credited to you.`,
    href: communityPath(community.slug, "/ledger"),
  });

  revalidatePath(communityPath(community.slug, `/sessions/${session.id}`));
  revalidatePath(communityPath(community.slug, "/ledger"));
  return { ok: true };
}
