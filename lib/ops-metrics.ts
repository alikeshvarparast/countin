import { count, countDistinct, desc, eq, gt, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  auditLogs,
  chatMessages,
  clubPolls,
  communities,
  contracts,
  eventGuests,
  ledgerEntries,
  memberships,
  notifications,
  polls,
  rsvps,
  seasons,
  seasonSessions,
  supportTickets,
  users,
  weeklyEvents,
} from "@/lib/db/schema";
import { now } from "@/lib/id";

function daysAgo(days: number) {
  return now() - days * 24 * 60 * 60 * 1000;
}

function counted(n: number | undefined | null) {
  return n ?? 0;
}

export function getOpsOverview() {
  const week = daysAgo(7);
  const month = daysAgo(30);

  const usersTotal = counted(db.select({ n: count() }).from(users).get()?.n);
  const usersWeek = counted(db.select({ n: count() }).from(users).where(gt(users.createdAt, week)).get()?.n);
  const usersMonth = counted(db.select({ n: count() }).from(users).where(gt(users.createdAt, month)).get()?.n);
  const telegramLinked = counted(
    db.select({ n: count() }).from(users).where(isNotNull(users.telegramChatId)).get()?.n,
  );

  const clubsTotal = counted(db.select({ n: count() }).from(communities).get()?.n);
  const clubsPublic = counted(db.select({ n: count() }).from(communities).where(eq(communities.isPublic, true)).get()?.n);
  const clubsWeek = counted(db.select({ n: count() }).from(communities).where(gt(communities.createdAt, week)).get()?.n);

  const membersApproved = counted(
    db.select({ n: count() }).from(memberships).where(eq(memberships.status, "approved")).get()?.n,
  );
  const uniqueMembers = counted(
    db
      .select({ n: countDistinct(memberships.userId) })
      .from(memberships)
      .where(eq(memberships.status, "approved"))
      .get()?.n,
  );
  const membersPending = counted(
    db.select({ n: count() }).from(memberships).where(eq(memberships.status, "pending")).get()?.n,
  );
  const membersSuspended = counted(
    db.select({ n: count() }).from(memberships).where(eq(memberships.status, "suspended")).get()?.n,
  );

  const eventsOpen = counted(db.select({ n: count() }).from(weeklyEvents).where(eq(weeklyEvents.status, "open")).get()?.n);
  const eventsTotal = counted(db.select({ n: count() }).from(weeklyEvents).get()?.n);
  const rsvpGoing = counted(db.select({ n: count() }).from(rsvps).where(eq(rsvps.status, "going")).get()?.n);
  const guests = counted(db.select({ n: count() }).from(eventGuests).get()?.n);

  const seasonsTotal = counted(db.select({ n: count() }).from(seasons).get()?.n);
  const sessionsTotal = counted(db.select({ n: count() }).from(seasonSessions).get()?.n);
  const contractsTotal = counted(db.select({ n: count() }).from(contracts).get()?.n);

  const chatTotal = counted(db.select({ n: count() }).from(chatMessages).get()?.n);
  const chatWeek = counted(db.select({ n: count() }).from(chatMessages).where(gt(chatMessages.createdAt, week)).get()?.n);
  const clubPollsTotal = counted(db.select({ n: count() }).from(clubPolls).get()?.n);
  const eventPollsTotal = counted(db.select({ n: count() }).from(polls).get()?.n);

  const ledgerPending = counted(
    db.select({ n: count() }).from(ledgerEntries).where(eq(ledgerEntries.status, "pending")).get()?.n,
  );
  const ledgerSettled = counted(
    db.select({ n: count() }).from(ledgerEntries).where(eq(ledgerEntries.status, "settled")).get()?.n,
  );

  const notificationsTotal = counted(db.select({ n: count() }).from(notifications).get()?.n);
  const ticketsOpen = counted(
    db.select({ n: count() }).from(supportTickets).where(eq(supportTickets.status, "open")).get()?.n,
  );
  const ticketsPending = counted(
    db.select({ n: count() }).from(supportTickets).where(eq(supportTickets.status, "pending")).get()?.n,
  );
  const ticketsTotal = counted(db.select({ n: count() }).from(supportTickets).get()?.n);
  const auditTotal = counted(db.select({ n: count() }).from(auditLogs).get()?.n);

  return {
    usersTotal,
    usersWeek,
    usersMonth,
    telegramLinked,
    clubsTotal,
    clubsPublic,
    clubsPrivate: clubsTotal - clubsPublic,
    clubsWeek,
    membersApproved,
    uniqueMembers,
    membersPending,
    membersSuspended,
    eventsOpen,
    eventsTotal,
    rsvpGoing,
    guests,
    seasonsTotal,
    sessionsTotal,
    contractsTotal,
    chatTotal,
    chatWeek,
    pollsTotal: clubPollsTotal + eventPollsTotal,
    ledgerPending,
    ledgerSettled,
    notificationsTotal,
    ticketsOpen,
    ticketsPending,
    ticketsTotal,
    auditTotal,
  };
}

export function getOpsCommunities() {
  const clubs = db.select().from(communities).all();
  const owners = db.select({ id: users.id, name: users.name, email: users.email }).from(users).all();
  const ownerMap = new Map(owners.map((row) => [row.id, row]));
  const memberRows = db
    .select({
      communityId: memberships.communityId,
      status: memberships.status,
      n: count(),
    })
    .from(memberships)
    .groupBy(memberships.communityId, memberships.status)
    .all();
  const memberMap = new Map<string, { approved: number; pending: number; suspended: number }>();
  for (const row of memberRows) {
    const current = memberMap.get(row.communityId) ?? { approved: 0, pending: 0, suspended: 0 };
    if (row.status === "approved") current.approved = row.n;
    else if (row.status === "pending") current.pending = row.n;
    else if (row.status === "suspended") current.suspended = row.n;
    memberMap.set(row.communityId, current);
  }

  return clubs
    .map((club) => {
      const members = memberMap.get(club.id) ?? { approved: 0, pending: 0, suspended: 0 };
      const owner = ownerMap.get(club.createdById);
      return {
        id: club.id,
        name: club.name,
        slug: club.slug,
        uid: club.uid,
        isPublic: club.isPublic,
        location: club.location,
        createdAt: club.createdAt,
        ownerName: owner?.name ?? "Unknown",
        ownerEmail: owner?.email ?? "",
        membersApproved: members.approved,
        membersPending: members.pending,
        membersSuspended: members.suspended,
        membersTotal: members.approved + members.pending + members.suspended,
      };
    })
    .sort((a, b) => b.membersApproved - a.membersApproved || b.createdAt - a.createdAt);
}

export function getOpsActivity(limit = 120) {
  const rows = db
    .select({
      log: auditLogs,
      actorName: users.name,
      actorEmail: users.email,
      clubName: communities.name,
      clubSlug: communities.slug,
    })
    .from(auditLogs)
    .innerJoin(users, eq(users.id, auditLogs.actorId))
    .innerJoin(communities, eq(communities.id, auditLogs.communityId))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit)
    .all();

  return rows.map((row) => ({
    id: row.log.id,
    action: row.log.action,
    entityType: row.log.entityType,
    entityId: row.log.entityId,
    meta: row.log.meta,
    createdAt: row.log.createdAt,
    actorName: row.actorName,
    actorEmail: row.actorEmail,
    clubName: row.clubName,
    clubSlug: row.clubSlug,
  }));
}
