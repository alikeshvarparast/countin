"use server";

import { and, eq, gte } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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
import { postClubChat } from "@/lib/chat";
import { db } from "@/lib/db";
import {
  communities,
  contracts,
  invitations,
  ledgerEntries,
  seasonSessions,
  seasonSignups,
  seasons,
  sessionSlots,
  users,
} from "@/lib/db/schema";
import { createId, now } from "@/lib/id";
import { notify, notifyMany } from "@/lib/notify";
import { eachSeasonDate, zonedDateTimeToUtcMs } from "@/lib/timezone";
import { formatMoney, localInputToMs, parseDurationMinutes, formatEventWhen } from "@/lib/utils";

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
  const durationMinutes = parseDurationMinutes(formData.get("durationHours"), formData.get("durationMinutes"));
  const minPlayers = Number(formData.get("minPlayers") ?? 10);
  const homeVisibleWeeksRaw = Number(formData.get("homeVisibleWeeks") ?? 4);
  const homeVisibleWeeks =
    Number.isFinite(homeVisibleWeeksRaw) && homeVisibleWeeksRaw >= 1 ? Math.min(52, Math.round(homeVisibleWeeksRaw)) : 4;
  const weekdays = formData.getAll("weekday").map((v) => Number(v)).filter((n) => n >= 0 && n <= 6);
  const signupClosesAt = localInputToMs(String(formData.get("signupClosesAt") ?? ""));

  if (name.length < 2) return { error: "Name the season." };
  if (!startDate || !endDate) return { error: "Set start and end dates." };
  if (!timeLocal) return { error: "Set the kickoff time." };
  if (durationMinutes == null) return { error: "Set how long the session lasts." };
  if (weekdays.length === 0) return { error: "Pick at least one weekday." };
  if (!signupClosesAt) return { error: "Set how long members have to agree to the contract." };

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
      durationMinutes,
      regularPriceCents: 0,
      occasionalPriceCents: null,
      homeVisibleWeeks,
      minPlayers: Number.isFinite(minPlayers) ? minPlayers : 10,
      signupClosesAt,
      status: "signup",
      createdAt: t,
    })
    .run();

  audit({
    communityId: community.id,
    actorId: user.id,
    action: "season.create",
    entityType: "season",
    entityId: seasonId,
    meta: { nights: dates.length },
  });

  await notifyMany(
    listApprovedMembers(community.id).map((m) => m.userId),
    {
      communityId: community.id,
      type: "new_season",
      title: `Contract season · ${name}`,
      body: `Say whether you want a long-term contract place. Nights stay off the event list until an admin closes this agreement and then creates the season nights.`,
      href: communityPath(community.slug, `/seasons/${seasonId}`),
    },
  );

  revalidatePath(communityPath(community.slug, "/seasons"));
  return { ok: true, id: seasonId };
}

export async function updateSeasonRates(formData: FormData) {
  const user = await requireUser();
  const seasonId = String(formData.get("seasonId") ?? "");
  const season = db.select().from(seasons).where(eq(seasons.id, seasonId)).get();
  if (!season) return { error: "Season not found." };
  requireAdmin(season.communityId, user.id);
  const regular = Number(formData.get("regularPrice") ?? "");
  const premiumPercent = Number(formData.get("occasionalPremiumPercent") ?? "");
  const prepaidRaw = String(formData.get("prepaidSessionCount") ?? "").trim();
  const prepaidSessionCount = prepaidRaw ? Number(prepaidRaw) : null;
  const paymentInfo = String(formData.get("paymentInfo") ?? "").trim();
  const collectorUserId = String(formData.get("collectorUserId") ?? "").trim() || user.id;
  const homeWeeksRaw = Number(formData.get("homeVisibleWeeks") ?? season.homeVisibleWeeks ?? 4);
  if (!Number.isFinite(regular) || regular <= 0) return { error: "Set the contract session rate." };
  if (!Number.isFinite(premiumPercent) || premiumPercent < 0) {
    return { error: "Set the occasional premium percent (0 or more)." };
  }
  if (prepaidSessionCount != null && (!Number.isFinite(prepaidSessionCount) || prepaidSessionCount < 1)) {
    return { error: "Advance sessions must be at least 1." };
  }
  if (!Number.isFinite(homeWeeksRaw) || homeWeeksRaw < 1 || homeWeeksRaw > 52) {
    return { error: "Home weeks must be between 1 and 52." };
  }
  const regularCents = Math.round(regular * 100);
  const occasionalCents = Math.round(regularCents * (1 + premiumPercent / 100));
  const homeVisibleWeeks = Math.round(homeWeeksRaw);
  db.update(seasons)
    .set({
      regularPriceCents: regularCents,
      occasionalPriceCents: occasionalCents,
      occasionalPremiumPercent: Math.round(premiumPercent),
      prepaidSessionCount,
      paymentInfo: paymentInfo || null,
      collectorUserId,
      homeVisibleWeeks,
    })
    .where(eq(seasons.id, seasonId))
    .run();

  const updated = db.select().from(seasons).where(eq(seasons.id, seasonId)).get()!;
  if (updated.paymentRequestedAt) {
    syncSeasonPrepayLedger(updated);
  }

  audit({
    communityId: season.communityId,
    actorId: user.id,
    action: "season.update_rates",
    entityType: "season",
    entityId: seasonId,
  });

  const community = db.select().from(communities).where(eq(communities.id, season.communityId)).get();
  if (community) {
    revalidatePath(communityPath(community.slug, `/seasons/${seasonId}`));
    revalidatePath(communityPath(community.slug));
    revalidatePath(communityPath(community.slug, "/ledger"));
  }
  return { ok: true };
}

function seasonPrepayAmountCents(season: typeof seasons.$inferSelect) {
  if (!season.regularPriceCents || !season.prepaidSessionCount) return null;
  return season.regularPriceCents * season.prepaidSessionCount;
}

/** Keep pending/claimed season prepay rows aligned with current contract list and rates. */
function syncSeasonPrepayLedger(season: typeof seasons.$inferSelect) {
  if (!season.paymentRequestedAt) return;
  const amountCents = seasonPrepayAmountCents(season);
  if (amountCents == null) return;
  const collectorId = season.collectorUserId ?? primaryAdminId(season.communityId);
  const contractPlayers = db.select().from(contracts).where(eq(contracts.seasonId, season.id)).all();
  const contractIds = new Set(contractPlayers.map((c) => c.userId));
  const existing = db
    .select()
    .from(ledgerEntries)
    .where(and(eq(ledgerEntries.seasonId, season.id), eq(ledgerEntries.reason, "contract_prepay")))
    .all();

  for (const row of existing) {
    if (row.status === "settled") continue;
    if (!contractIds.has(row.fromUserId) || row.fromUserId === collectorId) {
      db.delete(ledgerEntries).where(eq(ledgerEntries.id, row.id)).run();
      continue;
    }
    if (row.amountCents !== amountCents || row.toUserId !== collectorId) {
      db.update(ledgerEntries)
        .set({ amountCents, toUserId: collectorId })
        .where(eq(ledgerEntries.id, row.id))
        .run();
    }
  }

  const openFrom = new Set(
    existing
      .filter((r) => r.status !== "settled" && contractIds.has(r.fromUserId))
      .map((r) => r.fromUserId),
  );
  const settledFrom = new Set(existing.filter((r) => r.status === "settled").map((r) => r.fromUserId));
  const t = now();
  for (const row of contractPlayers) {
    if (row.userId === collectorId) continue;
    if (openFrom.has(row.userId) || settledFrom.has(row.userId)) continue;
    db.insert(ledgerEntries)
      .values({
        id: createId(),
        communityId: season.communityId,
        fromUserId: row.userId,
        toUserId: collectorId,
        amountCents,
        reason: "contract_prepay",
        status: "pending",
        seasonId: season.id,
        createdAt: t,
      })
      .run();
  }
}

export async function sendSeasonPaymentRequest(formData: FormData) {
  const user = await requireUser();
  const seasonId = String(formData.get("seasonId") ?? "");
  const season = db.select().from(seasons).where(eq(seasons.id, seasonId)).get();
  if (!season) return { error: "Season not found." };
  requireAdmin(season.communityId, user.id);
  if (season.paymentRequestedAt) return { error: "Payment requests were already sent." };
  if (!season.regularPriceCents) return { error: "Set the contract rate first." };
  if (!season.prepaidSessionCount) return { error: "Set how many sessions are paid in advance." };
  if (!season.paymentInfo) return { error: "Add payment details first." };
  const collectorId = season.collectorUserId ?? primaryAdminId(season.communityId);
  const contractPlayers = db.select().from(contracts).where(eq(contracts.seasonId, seasonId)).all();
  if (contractPlayers.length === 0) return { error: "No contract players yet." };

  const community = db.select().from(communities).where(eq(communities.id, season.communityId)).get();
  if (!community) return { error: "Community not found." };
  const amountCents = season.regularPriceCents * season.prepaidSessionCount;
  const collector =
    db.select().from(users).where(eq(users.id, collectorId)).get()?.name ?? "the collector";
  const t = now();

  db.update(seasons).set({ paymentRequestedAt: t, collectorUserId: collectorId }).where(eq(seasons.id, seasonId)).run();

  for (const row of contractPlayers) {
    if (row.userId === collectorId) continue;
    db.insert(ledgerEntries)
      .values({
        id: createId(),
        communityId: community.id,
        fromUserId: row.userId,
        toUserId: collectorId,
        amountCents,
        reason: "contract_prepay",
        status: "pending",
        seasonId: season.id,
        createdAt: t,
      })
      .run();
    await notify({
      userId: row.userId,
      communityId: community.id,
      type: "cost_posted",
      title: `Season payment due · ${season.name}`,
      body: `Pay ${formatMoney(amountCents, community.currency)} to ${collector} for ${season.prepaidSessionCount} nights. ${season.paymentInfo}`,
      href: communityPath(community.slug, "/ledger"),
    });
  }

  audit({
    communityId: community.id,
    actorId: user.id,
    action: "season.payment_request",
    entityType: "season",
    entityId: season.id,
    meta: { amountCents, players: contractPlayers.length },
  });

  revalidatePath(communityPath(community.slug, `/seasons/${seasonId}`));
  revalidatePath(communityPath(community.slug, "/ledger"));
  return { ok: true };
}

function agreeSignups(seasonId: string) {
  return db
    .select()
    .from(seasonSignups)
    .where(eq(seasonSignups.seasonId, seasonId))
    .all()
    .filter((row) => row.intent !== "decline");
}

function ensureSeasonSessions(season: typeof seasons.$inferSelect) {
  const existing = db.select().from(seasonSessions).where(eq(seasonSessions.seasonId, season.id)).all();
  if (existing.length > 0) return existing;
  const community = db.select().from(communities).where(eq(communities.id, season.communityId)).get();
  if (!community) return [];
  const weekdays = JSON.parse(season.weekdays) as number[];
  const dates = eachSeasonDate(season.startDate, season.endDate, weekdays);
  const t = now();
  for (const date of dates) {
    db.insert(seasonSessions)
      .values({
        id: createId(),
        seasonId: season.id,
        communityId: community.id,
        startsAt: zonedDateTimeToUtcMs(date, season.timeLocal, community.timezone),
        status: "scheduled",
        createdAt: t,
      })
      .run();
  }
  return db.select().from(seasonSessions).where(eq(seasonSessions.seasonId, season.id)).all();
}

function writeContractsFromAgrees(seasonId: string) {
  const t = now();
  for (const signup of agreeSignups(seasonId)) {
    if (hasContract(seasonId, signup.userId)) continue;
    db.insert(contracts)
      .values({
        id: createId(),
        seasonId,
        userId: signup.userId,
        prepaid: true,
        createdAt: t,
      })
      .run();
  }
}

function slotContractsOnFutureNights(season: typeof seasons.$inferSelect) {
  const t = now();
  const sessions = ensureSeasonSessions(season);
  const future = sessions.filter((session) => session.startsAt >= t);
  const holders = db.select().from(contracts).where(eq(contracts.seasonId, season.id)).all();
  for (const holder of holders) {
    for (const session of future) {
      const existing = db
        .select()
        .from(sessionSlots)
        .where(and(eq(sessionSlots.sessionId, session.id), eq(sessionSlots.userId, holder.userId)))
        .get();
      if (existing) continue;
      db.insert(sessionSlots)
        .values({
          id: createId(),
          sessionId: session.id,
          userId: holder.userId,
          kind: "contract",
          status: "contract_present",
          createdAt: t,
          updatedAt: t,
        })
        .run();
    }
  }
  return sessions;
}

export async function closeSeasonSignup(seasonId: string) {
  const user = await requireUser();
  const season = db.select().from(seasons).where(eq(seasons.id, seasonId)).get();
  if (!season) return { error: "Season not found." };
  requireAdmin(season.communityId, user.id);
  if (season.status !== "signup") return { error: "The agreement is already closed." };

  writeContractsFromAgrees(seasonId);
  db.update(seasons).set({ status: "agreed" }).where(eq(seasons.id, seasonId)).run();

  audit({
    communityId: season.communityId,
    actorId: user.id,
    action: "season.close_signup",
    entityType: "season",
    entityId: seasonId,
  });
  const community = db.select().from(communities).where(eq(communities.id, season.communityId)).get();
  if (community) {
    const agreeCount = db
      .select()
      .from(contracts)
      .where(eq(contracts.seasonId, seasonId))
      .all().length;
    await notifyMany(
      listApprovedMembers(community.id).map((m) => m.userId),
      {
        communityId: community.id,
        type: "season_agreed",
        title: `Agreement closed · ${season.name}`,
        body: `${agreeCount} ${agreeCount === 1 ? "person is" : "people are"} on this season's contract. Nights stay off the event list until an admin creates them.`,
        href: communityPath(community.slug, `/seasons/${seasonId}`),
      },
    );
    revalidatePath(communityPath(community.slug, `/seasons/${seasonId}`));
    revalidatePath(communityPath(community.slug, "/seasons"));
    revalidatePath(communityPath(community.slug));
  }
  return { ok: true };
}

export async function updateSeasonHomeWeeks(formData: FormData) {
  const user = await requireUser();
  const seasonId = String(formData.get("seasonId") ?? "");
  const season = db.select().from(seasons).where(eq(seasons.id, seasonId)).get();
  if (!season) return { error: "Season not found." };
  requireAdmin(season.communityId, user.id);
  const raw = Number(formData.get("homeVisibleWeeks") ?? "");
  if (!Number.isFinite(raw) || raw < 1 || raw > 52) {
    return { error: "Set how many weeks of nights to show on Home (1–52)." };
  }
  const homeVisibleWeeks = Math.round(raw);
  db.update(seasons).set({ homeVisibleWeeks }).where(eq(seasons.id, seasonId)).run();
  audit({
    communityId: season.communityId,
    actorId: user.id,
    action: "season.home_weeks",
    entityType: "season",
    entityId: seasonId,
    meta: { homeVisibleWeeks },
  });
  const community = db.select().from(communities).where(eq(communities.id, season.communityId)).get();
  if (community) {
    revalidatePath(communityPath(community.slug, `/seasons/${seasonId}`));
    revalidatePath(communityPath(community.slug));
  }
  return { ok: true };
}

export async function createSeasonNights(seasonId: string) {
  const user = await requireUser();
  const season = db.select().from(seasons).where(eq(seasons.id, seasonId)).get();
  if (!season) return { error: "Season not found." };
  requireAdmin(season.communityId, user.id);
  if (season.status === "signup") return { error: "Close the agreement first." };
  if (season.status === "locked") return { error: "Nights are already created." };
  if (season.status === "cancelled") return { error: "This season was cancelled." };
  if (season.status !== "agreed") return { error: "This season is not ready for nights." };

  slotContractsOnFutureNights(season);
  db.update(seasons).set({ status: "locked" }).where(eq(seasons.id, seasonId)).run();

  audit({
    communityId: season.communityId,
    actorId: user.id,
    action: "season.create_nights",
    entityType: "season",
    entityId: seasonId,
  });
  const community = db.select().from(communities).where(eq(communities.id, season.communityId)).get();
  if (community) {
    await notifyMany(
      listApprovedMembers(community.id).map((m) => m.userId),
      {
        communityId: community.id,
        type: "season_opened",
        title: `${season.name} nights are open`,
        body: `Each night is now its own event. People who agreed are contract members; everyone else is occasional.`,
        href: communityPath(community.slug, `/seasons/${season.id}`),
      },
    );
    revalidatePath(communityPath(community.slug, `/seasons/${seasonId}`));
    revalidatePath(communityPath(community.slug, "/seasons"));
    revalidatePath(communityPath(community.slug));
  }
  return { ok: true };
}

export async function cancelSeason(seasonId: string) {
  const user = await requireUser();
  const season = db.select().from(seasons).where(eq(seasons.id, seasonId)).get();
  if (!season) return { error: "Season not found." };
  requireAdmin(season.communityId, user.id);
  if (season.status === "cancelled") return { error: "This season is already cancelled." };

  db.update(seasons).set({ status: "cancelled" }).where(eq(seasons.id, seasonId)).run();
  db.update(seasonSessions).set({ status: "cancelled" }).where(eq(seasonSessions.seasonId, seasonId)).run();

  audit({
    communityId: season.communityId,
    actorId: user.id,
    action: "season.cancel",
    entityType: "season",
    entityId: seasonId,
  });
  const community = db.select().from(communities).where(eq(communities.id, season.communityId)).get();
  if (community) {
    const wasAgreement = season.status === "signup" || season.status === "agreed";
    await notifyMany(
      listApprovedMembers(community.id).map((m) => m.userId),
      {
        communityId: community.id,
        type: "season_cancelled",
        title: `Cancelled · ${season.name}`,
        body: wasAgreement
          ? `The contract agreement for ${season.name} was cancelled.`
          : `${season.name} and its nights were cancelled.`,
        href: communityPath(community.slug),
      },
    );
    revalidatePath(communityPath(community.slug, `/seasons/${seasonId}`));
    revalidatePath(communityPath(community.slug, "/seasons"));
    revalidatePath(communityPath(community.slug));
  }
  redirect(community ? communityPath(community.slug) : "/app");
}

export async function cancelSeasonSession(sessionId: string) {
  const user = await requireUser();
  const session = db.select().from(seasonSessions).where(eq(seasonSessions.id, sessionId)).get();
  if (!session) return { error: "Session not found." };
  requireAdmin(session.communityId, user.id);
  if (session.status === "cancelled") return { error: "This night is already cancelled." };

  const season = db.select().from(seasons).where(eq(seasons.id, session.seasonId)).get();
  if (!season) return { error: "Season not found." };
  if (season.status === "cancelled") return { error: "This season is already cancelled." };

  db.update(seasonSessions).set({ status: "cancelled" }).where(eq(seasonSessions.id, sessionId)).run();

  audit({
    communityId: session.communityId,
    actorId: user.id,
    action: "session.cancel",
    entityType: "season_session",
    entityId: sessionId,
  });
  const community = db.select().from(communities).where(eq(communities.id, session.communityId)).get();
  if (community) {
    await notifyMany(
      listApprovedMembers(community.id).map((m) => m.userId),
      {
        communityId: community.id,
        type: "session_cancelled",
        title: `Cancelled night · ${season.name}`,
        body: `One ${season.name} night was cancelled.`,
        href: communityPath(community.slug),
      },
    );
    revalidatePath(communityPath(community.slug, `/sessions/${sessionId}`));
    revalidatePath(communityPath(community.slug, `/seasons/${season.id}`));
    revalidatePath(communityPath(community.slug));
  }
  redirect(community ? communityPath(community.slug) : "/app");
}

export async function setSeasonIntent(seasonId: string, intent: "agree" | "decline") {
  const user = await requireUser();
  const season = db.select().from(seasons).where(eq(seasons.id, seasonId)).get();
  if (!season) return { error: "Season not found." };
  requireMember(season.communityId, user.id);
  if (season.status !== "signup") return { error: "The agreement window has closed." };
  if (hasContract(seasonId, user.id)) return { error: "You already have a contract place." };
  const existing = db
    .select()
    .from(seasonSignups)
    .where(and(eq(seasonSignups.seasonId, seasonId), eq(seasonSignups.userId, user.id)))
    .get();
  if (existing) {
    db.update(seasonSignups)
      .set({ intent, createdAt: now() })
      .where(eq(seasonSignups.id, existing.id))
      .run();
  } else {
    db.insert(seasonSignups)
      .values({
        id: createId(),
        seasonId,
        userId: user.id,
        intent,
        createdAt: now(),
      })
      .run();
  }
  const community = db.select().from(communities).where(eq(communities.id, season.communityId)).get();
  if (community) {
    revalidatePath(communityPath(community.slug, `/seasons/${seasonId}`));
    revalidatePath(communityPath(community.slug));
  }
  return { ok: true };
}

export async function agreeToSeason(seasonId: string) {
  return setSeasonIntent(seasonId, "agree");
}

export async function addContract(formData: FormData) {
  const user = await requireUser();
  const seasonId = String(formData.get("seasonId") ?? "");
  const userId = String(formData.get("userId") ?? "").trim();
  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  const season = db.select().from(seasons).where(eq(seasons.id, seasonId)).get();
  if (!season) return { error: "Season not found." };
  requireAdmin(season.communityId, user.id);
  if (season.status === "signup") {
    return { error: "Close the agreement before adding someone to this season's contract." };
  }
  if (season.status === "cancelled") return { error: "This season was cancelled." };

  const target = userId
    ? db.select().from(users).where(eq(users.id, userId)).get()
    : email
      ? db.select().from(users).where(eq(users.email, email)).get()
      : undefined;
  if (!target) return { error: "Pick a club member to add." };
  requireMember(season.communityId, target.id);
  if (hasContract(seasonId, target.id)) return { error: "They already have a contract." };

  const t = now();
  db.insert(contracts)
    .values({
      id: createId(),
      seasonId,
      userId: target.id,
      prepaid: true,
      createdAt: t,
    })
    .run();

  const future = db
    .select()
    .from(seasonSessions)
    .where(and(eq(seasonSessions.seasonId, seasonId), gte(seasonSessions.startsAt, t)))
    .all()
    .filter((s) => s.status !== "cancelled");

  for (const session of future) {
    const existing = db
      .select()
      .from(sessionSlots)
      .where(and(eq(sessionSlots.sessionId, session.id), eq(sessionSlots.userId, target.id)))
      .get();
    if (existing) {
      db.update(sessionSlots)
        .set({ kind: "contract", status: "contract_present", updatedAt: t })
        .where(eq(sessionSlots.id, existing.id))
        .run();
      continue;
    }
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

  const refreshed = db.select().from(seasons).where(eq(seasons.id, seasonId)).get()!;
  syncSeasonPrepayLedger(refreshed);

  const community = db.select().from(communities).where(eq(communities.id, season.communityId)).get();
  if (!community) return { error: "Community not found." };

  audit({
    communityId: community.id,
    actorId: user.id,
    action: "season.add_contract",
    entityType: "contract",
    entityId: target.id,
    meta: { seasonId },
  });

  await notify({
    userId: target.id,
    communityId: community.id,
    type: "contract_added",
    title: `Contract · ${season.name}`,
    body: `You are on this season's contract list.`,
    href: communityPath(community.slug, `/seasons/${season.id}`),
  });

  revalidatePath(communityPath(community.slug, `/seasons/${season.id}`));
  revalidatePath(communityPath(community.slug, "/ledger"));
  revalidatePath(communityPath(community.slug));
  return { ok: true };
}

export async function removeContract(formData: FormData) {
  const user = await requireUser();
  const seasonId = String(formData.get("seasonId") ?? "");
  const userId = String(formData.get("userId") ?? "").trim();
  const season = db.select().from(seasons).where(eq(seasons.id, seasonId)).get();
  if (!season) return { error: "Season not found." };
  requireAdmin(season.communityId, user.id);
  if (season.status === "signup" || season.status === "cancelled") {
    return { error: "Cannot change contracts in this state." };
  }

  const existing = db
    .select()
    .from(contracts)
    .where(and(eq(contracts.seasonId, seasonId), eq(contracts.userId, userId)))
    .get();
  if (!existing) return { error: "They are not on this contract." };

  const settled = db
    .select()
    .from(ledgerEntries)
    .where(
      and(
        eq(ledgerEntries.seasonId, seasonId),
        eq(ledgerEntries.reason, "contract_prepay"),
        eq(ledgerEntries.fromUserId, userId),
        eq(ledgerEntries.status, "settled"),
      ),
    )
    .get();
  if (settled) {
    return { error: "Their season payment is already settled. Replace them instead of removing." };
  }

  const t = now();
  db.delete(contracts).where(eq(contracts.id, existing.id)).run();

  const future = db
    .select()
    .from(seasonSessions)
    .where(and(eq(seasonSessions.seasonId, seasonId), gte(seasonSessions.startsAt, t)))
    .all()
    .filter((s) => s.status !== "cancelled");
  for (const session of future) {
    const slot = db
      .select()
      .from(sessionSlots)
      .where(and(eq(sessionSlots.sessionId, session.id), eq(sessionSlots.userId, userId)))
      .get();
    if (slot && slot.kind === "contract") {
      db.delete(sessionSlots).where(eq(sessionSlots.id, slot.id)).run();
    }
  }

  const refreshed = db.select().from(seasons).where(eq(seasons.id, seasonId)).get()!;
  syncSeasonPrepayLedger(refreshed);

  const community = db.select().from(communities).where(eq(communities.id, season.communityId)).get();
  if (community) {
    audit({
      communityId: community.id,
      actorId: user.id,
      action: "season.remove_contract",
      entityType: "contract",
      entityId: userId,
      meta: { seasonId },
    });
    await notify({
      userId,
      communityId: community.id,
      type: "contract_removed",
      title: `Off contract · ${season.name}`,
      body: `You were removed from this season's contract list. Outstanding season dues were updated on the ledger.`,
      href: communityPath(community.slug, `/seasons/${season.id}`),
    });
    revalidatePath(communityPath(community.slug, `/seasons/${season.id}`));
    revalidatePath(communityPath(community.slug, "/ledger"));
    revalidatePath(communityPath(community.slug));
  }
  return { ok: true };
}

export async function replaceContractMember(formData: FormData) {
  const user = await requireUser();
  const seasonId = String(formData.get("seasonId") ?? "");
  const fromUserId = String(formData.get("fromUserId") ?? "").trim();
  const toUserId = String(formData.get("toUserId") ?? "").trim();
  const season = db.select().from(seasons).where(eq(seasons.id, seasonId)).get();
  if (!season) return { error: "Season not found." };
  requireAdmin(season.communityId, user.id);
  if (season.status === "signup" || season.status === "cancelled") {
    return { error: "Cannot change contracts in this state." };
  }
  if (!fromUserId || !toUserId) return { error: "Pick who to replace and who takes their place." };
  if (fromUserId === toUserId) return { error: "Pick a different member." };
  requireMember(season.communityId, toUserId);
  if (hasContract(seasonId, toUserId)) return { error: "That member is already on the contract." };

  const result = transferRemainingContract(seasonId, fromUserId, toUserId, now());
  if ("error" in result) return result;

  // Move open prepay ledger rows to the replacement.
  const openRows = db
    .select()
    .from(ledgerEntries)
    .where(
      and(
        eq(ledgerEntries.seasonId, seasonId),
        eq(ledgerEntries.reason, "contract_prepay"),
        eq(ledgerEntries.fromUserId, fromUserId),
      ),
    )
    .all()
    .filter((r) => r.status === "pending" || r.status === "claimed");
  for (const row of openRows) {
    db.update(ledgerEntries).set({ fromUserId: toUserId }).where(eq(ledgerEntries.id, row.id)).run();
  }

  const refreshed = db.select().from(seasons).where(eq(seasons.id, seasonId)).get()!;
  syncSeasonPrepayLedger(refreshed);

  const community = db.select().from(communities).where(eq(communities.id, season.communityId)).get();
  const fromName = db.select().from(users).where(eq(users.id, fromUserId)).get()?.name ?? "Member";
  const toName = db.select().from(users).where(eq(users.id, toUserId)).get()?.name ?? "Member";
  if (community) {
    audit({
      communityId: community.id,
      actorId: user.id,
      action: "season.replace_contract",
      entityType: "contract",
      entityId: toUserId,
      meta: { seasonId, fromUserId, toUserId },
    });
    await notify({
      userId: fromUserId,
      communityId: community.id,
      type: "contract_replaced",
      title: `Contract transferred · ${season.name}`,
      body: `Your contract place was given to ${toName}.`,
      href: communityPath(community.slug, `/seasons/${season.id}`),
    });
    await notify({
      userId: toUserId,
      communityId: community.id,
      type: "contract_added",
      title: `Contract · ${season.name}`,
      body: `You took ${fromName}'s contract place. Check the ledger for any season dues.`,
      href: communityPath(community.slug, `/seasons/${season.id}`),
    });
    revalidatePath(communityPath(community.slug, `/seasons/${season.id}`));
    revalidatePath(communityPath(community.slug, "/ledger"));
    revalidatePath(communityPath(community.slug));
  }
  return { ok: true };
}

function transferRemainingContract(
  seasonId: string,
  fromUserId: string,
  toUserId: string,
  fromStartsAt: number,
) {
  const existing = db
    .select()
    .from(contracts)
    .where(and(eq(contracts.seasonId, seasonId), eq(contracts.userId, fromUserId)))
    .get();
  if (!existing) return { error: "That contract is no longer available." };
  if (hasContract(seasonId, toUserId)) return { error: "You already have a contract place." };

  const t = now();
  db.delete(contracts).where(eq(contracts.id, existing.id)).run();
  db.insert(contracts)
    .values({
      id: createId(),
      seasonId,
      userId: toUserId,
      prepaid: existing.prepaid,
      createdAt: t,
    })
    .run();

  const remainingNights = db
    .select()
    .from(seasonSessions)
    .where(and(eq(seasonSessions.seasonId, seasonId), gte(seasonSessions.startsAt, fromStartsAt)))
    .all()
    .filter((row) => row.status !== "cancelled");
  const laterNights = remainingNights.filter((row) => row.startsAt > fromStartsAt);

  for (const night of laterNights) {
    const fromSlot = db
      .select()
      .from(sessionSlots)
      .where(and(eq(sessionSlots.sessionId, night.id), eq(sessionSlots.userId, fromUserId)))
      .get();
    if (fromSlot) db.delete(sessionSlots).where(eq(sessionSlots.id, fromSlot.id)).run();

    const toSlot = db
      .select()
      .from(sessionSlots)
      .where(and(eq(sessionSlots.sessionId, night.id), eq(sessionSlots.userId, toUserId)))
      .get();
    if (toSlot) {
      db.update(sessionSlots)
        .set({ kind: "contract", status: "contract_present", invitedById: fromUserId, updatedAt: t })
        .where(eq(sessionSlots.id, toSlot.id))
        .run();
    } else {
      db.insert(sessionSlots)
        .values({
          id: createId(),
          sessionId: night.id,
          userId: toUserId,
          kind: "contract",
          status: "contract_present",
          invitedById: fromUserId,
          createdAt: t,
          updatedAt: t,
        })
        .run();
    }
  }
  return { ok: true as const, remainingNightCount: remainingNights.length, wasPrepaid: Boolean(existing.prepaid) };
}

export async function markContractAbsent(formData: FormData) {
  const user = await requireUser();
  const sessionId = String(formData.get("sessionId") ?? "");
  const inviteType = String(formData.get("inviteType") ?? "none");
  const inviteUserId = String(formData.get("inviteUserId") ?? "").trim();
  const inviteEmail = String(formData.get("inviteEmail") ?? "").toLowerCase().trim();
  const paymentInfo = String(formData.get("paymentInfo") ?? "").trim();
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
    let toUserName = "";
    if (inviteType === "private") {
      const target = inviteUserId
        ? db.select().from(users).where(eq(users.id, inviteUserId)).get()
        : inviteEmail
          ? db.select().from(users).where(eq(users.email, inviteEmail)).get()
          : undefined;
      if (!target) return { error: "Pick a member to invite." };
      if (hasContract(session.seasonId, target.id)) {
        return { error: "Replacements must be outside the contract list." };
      }
      requireMember(community.id, target.id);
      toUserId = target.id;
      toUserName = target.name;
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
        paymentInfo: paymentInfo || null,
        createdAt: t,
      })
      .run();

    const nightLabel = formatEventWhen(session.startsAt, community.timezone, true, season.durationMinutes);
    const payHint = paymentInfo ? ` Pay them via: ${paymentInfo}.` : "";
    if (inviteType === "private" && toUserId) {
      await notify({
        userId: toUserId,
        communityId: community.id,
        type: "private_invitation",
        title: `Private exchange · ${season.name}`,
        body: `${user.name} asked you to take ${nightLabel}. You can cover that night only, or take over their remaining contract.${payHint}`,
        href,
      });
      postClubChat(
        community.id,
        user.id,
        `Exchange request (private): asked ${toUserName} to take ${nightLabel} for ${season.name}. They can cover that night or take over the contract.`,
      );
    } else {
      await notifyMany(nonContractMemberIds(community.id, season.id), {
        communityId: community.id,
        type: "open_invitation",
        title: `Open exchange · ${season.name}`,
        body: `${user.name} is looking for a replacement for ${nightLabel}. Cover that night only, or take over their remaining contract.${payHint}`,
        href,
      });
      postClubChat(
        community.id,
        user.id,
        `Exchange request: looking for a replacement for ${nightLabel} (${season.name}). Occasional players can take that night only or take over the contract.`,
      );
    }
  } else {
    const nightLabel = formatEventWhen(session.startsAt, community.timezone, true, season.durationMinutes);
    await notifyMany(nonContractMemberIds(community.id, season.id), {
      communityId: community.id,
      type: "slot_opened",
      title: `Premium slot open · ${season.name}`,
      body: `A contract player is out with no invite. Apply on the waitlist — this fill is 50% more and the absentee is not credited.`,
      href,
    });
    postClubChat(
      community.id,
      user.id,
      `I'm out for ${nightLabel} (${season.name}) and opened the slot on the waitlist.`,
    );
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
  revalidatePath(communityPath(community.slug, "/chat"));
  revalidatePath(communityPath(community.slug), "layout");
  return { ok: true };
}

export async function applyOccasional(sessionId: string) {
  const user = await requireUser();
  const session = db.select().from(seasonSessions).where(eq(seasonSessions.id, sessionId)).get();
  if (!session) return { error: "Session not found." };
  requireMember(session.communityId, user.id);
  const seasonRow = db.select().from(seasons).where(eq(seasons.id, session.seasonId)).get();
  if (!seasonRow || seasonRow.status !== "locked") {
    return { error: "This season's nights are not open yet." };
  }
  if (session.status === "cancelled") return { error: "This night was cancelled." };
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
      body: `${user.name} applied as an occasional player.`,
      href: communityPath(community.slug, `/sessions/${session.id}`),
    },
  );

  revalidatePath(communityPath(community.slug, `/sessions/${session.id}`));
  revalidatePath(communityPath(community.slug));
  revalidatePath(communityPath(community.slug, `/seasons/${season.id}`));
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
    revalidatePath(communityPath(community.slug));
    revalidatePath(communityPath(community.slug, `/seasons/${season.id}`));
    return { ok: true };
  }

  const premium =
    season.occasionalPriceCents ??
    Math.round(season.regularPriceCents * (1 + (season.occasionalPremiumPercent ?? 50) / 100));
  if (!premium) {
    return { error: "Set the occasional rate before approving waitlist players." };
  }

  const t = now();
  db.update(sessionSlots)
    .set({ status: "occasional_approved", updatedAt: t })
    .where(eq(sessionSlots.id, slotId))
    .run();

  const collectorId = season.collectorUserId ?? primaryAdminId(community.id);
  db.insert(ledgerEntries)
    .values({
      id: createId(),
      communityId: community.id,
      fromUserId: slot.userId,
      toUserId: collectorId,
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

  const collector = db.select().from(users).where(eq(users.id, collectorId)).get()?.name ?? "the collector";
  await notify({
    userId: slot.userId,
    communityId: community.id,
    type: "waitlist_approved",
    title: `You're in · ${season.name}`,
    body: `Pay ${formatMoney(premium, community.currency)} to ${collector}${season.paymentInfo ? `. ${season.paymentInfo}` : ""}. Then mark I have paid on the ledger.`,
    href: communityPath(community.slug, "/ledger"),
  });

  revalidatePath(href);
  revalidatePath(communityPath(community.slug));
  revalidatePath(communityPath(community.slug, `/seasons/${season.id}`));
  revalidatePath(communityPath(community.slug, "/ledger"));
  return { ok: true };
}

export async function claimInvitation(formData: FormData) {
  const user = await requireUser();
  const invitationId = String(formData.get("invitationId") ?? "");
  const mode = String(formData.get("mode") ?? "night");
  if (mode !== "night" && mode !== "contract") {
    return { error: "Choose this night only, or take over the contract." };
  }
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

  const community = db.select().from(communities).where(eq(communities.id, session.communityId)).get();
  const season = db.select().from(seasons).where(eq(seasons.id, session.seasonId)).get();
  if (!community || !season) return { error: "Season not found." };
  if (!season.regularPriceCents) return { error: "Set the contract session rate before filling replacements." };

  let remainingNightCount = 1;
  if (mode === "contract") {
    const transferred = transferRemainingContract(
      session.seasonId,
      invitation.fromUserId,
      user.id,
      session.startsAt,
    );
    if ("error" in transferred) return transferred;
    remainingNightCount = transferred.remainingNightCount;
  }

  const amountCents = season.regularPriceCents * remainingNightCount;
  const payee = db.select().from(users).where(eq(users.id, invitation.fromUserId)).get();
  const payeeName = payee?.name ?? "the contract player";
  const paymentHint =
    invitation.paymentInfo?.trim() ||
    (payee?.whatsappPhone ? `WhatsApp ${payee.whatsappPhone}` : null) ||
    season.paymentInfo?.trim() ||
    null;

  const t = now();
  db.update(invitations).set({ status: "claimed" }).where(eq(invitations.id, invitationId)).run();
  db.insert(sessionSlots)
    .values({
      id: createId(),
      sessionId: session.id,
      userId: user.id,
      kind: mode === "contract" ? "contract" : "replacement",
      status: mode === "contract" ? "contract_present" : "replacement_filled",
      invitedById: invitation.fromUserId,
      createdAt: t,
      updatedAt: t,
    })
    .run();

  db.insert(ledgerEntries)
    .values({
      id: createId(),
      communityId: community.id,
      fromUserId: user.id,
      toUserId: invitation.fromUserId,
      amountCents,
      reason: mode === "contract" ? "contract_takeover" : "replacement_to_player",
      status: "pending",
      sessionId: session.id,
      seasonId: season.id,
      createdAt: t,
    })
    .run();

  audit({
    communityId: community.id,
    actorId: user.id,
    action: mode === "contract" ? "session.claim_contract" : "session.claim_invite",
    entityType: "invitation",
    entityId: invitation.id,
  });

  const nightLabel = formatEventWhen(session.startsAt, community.timezone, true, season.durationMinutes);
  const moneyLabel = formatMoney(amountCents, community.currency);
  const payLine = paymentHint
    ? `Pay ${moneyLabel} to ${payeeName}. ${paymentHint}`
    : `Pay ${moneyLabel} to ${payeeName} (ask them how).`;

  await notify({
    userId: invitation.fromUserId,
    communityId: community.id,
    type: "invitation_claimed",
    title: mode === "contract" ? `Contract taken over · ${season.name}` : `Replacement found · ${season.name}`,
    body:
      mode === "contract"
        ? `${user.name} took over your remaining contract (${remainingNightCount} nights), starting with ${nightLabel}. They owe you ${moneyLabel}.`
        : `${user.name} took ${nightLabel} at the regular rate. They owe you ${moneyLabel}.`,
    href: communityPath(community.slug, "/ledger"),
  });

  await notify({
    userId: user.id,
    communityId: community.id,
    type: "cost_posted",
    title: mode === "contract" ? `Contract takeover payment · ${season.name}` : `Replacement payment · ${season.name}`,
    body: `${payLine} Then mark I have paid on the ledger.`,
    href: communityPath(community.slug, "/ledger"),
  });

  postClubChat(
    community.id,
    user.id,
    mode === "contract"
      ? `I took over ${payeeName}'s contract on ${season.name}, starting ${nightLabel}.`
      : `I took ${payeeName}'s place for ${nightLabel} (${season.name}) this night only.`,
  );

  revalidatePath(communityPath(community.slug, `/sessions/${session.id}`));
  revalidatePath(communityPath(community.slug, `/seasons/${season.id}`));
  revalidatePath(communityPath(community.slug, "/ledger"));
  revalidatePath(communityPath(community.slug, "/chat"));
  revalidatePath(communityPath(community.slug));
  revalidatePath(communityPath(community.slug), "layout");
  return { ok: true };
}
