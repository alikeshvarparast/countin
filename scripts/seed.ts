import { hash } from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "../lib/db";
import {
  communities,
  contracts,
  memberships,
  seasonSessions,
  seasonSignups,
  seasons,
  sessionSlots,
  users,
  weeklyEvents,
} from "../lib/db/schema";
import { createCommunityUid, createId, createInviteToken, now } from "../lib/id";
import { APP_NAME } from "../lib/brand";
import { notify } from "../lib/notify";
import { eachSeasonDate, zonedDateTimeToUtcMs } from "../lib/timezone";

async function upsertUser(name: string, email: string, telegram: string, passwordHash: string) {
  const existing = db.select().from(users).where(eq(users.email, email)).get();
  if (existing) return existing;
  const row = {
    id: createId(),
    name,
    email,
    passwordHash,
    telegramUsername: telegram,
    telegramLinkToken: createId(),
    createdAt: now(),
  };
  db.insert(users).values(row).run();
  return row;
}

async function main() {
  const passwordHash = await hash("password123", 10);
  const t = now();
  const ownerHash = await hash("Owner123!@#", 10);
  const ownerExisting = db.select().from(users).where(eq(users.email, "owner")).get();
  if (ownerExisting) {
    db.update(users)
      .set({ passwordHash: ownerHash, platformRole: "owner", name: "Owner" })
      .where(eq(users.id, ownerExisting.id))
      .run();
  } else {
    db.insert(users)
      .values({
        id: createId(),
        name: "Owner",
        email: "owner",
        passwordHash: ownerHash,
        telegramUsername: "owner",
        telegramLinkToken: createId(),
        platformRole: "owner",
        createdAt: t,
      })
      .run();
  }
  const alex = await upsertUser("Alex Admin", "alex@club.com", "alexfc", passwordHash);
  const sam = await upsertUser("Sam Player", "sam@club.com", "samfc", passwordHash);

  const riley = await upsertUser("Riley Occasional", "riley@club.com", "rileyfc", passwordHash);
  const jordan = await upsertUser("Jordan Occasional", "jordan@club.com", "jordanfc", passwordHash);

  let community = db.select().from(communities).where(eq(communities.slug, "tuesday-night-fc")).get();
  if (!community) {
    const id = createId();
    db.insert(communities)
      .values({
        id,
        name: "Tuesday Night FC",
        slug: "tuesday-night-fc",
        uid: createCommunityUid(),
        inviteToken: createInviteToken(),
        description: "Pickup and a prepaid autumn block.",
        location: "Riverside turf",
        timezone: "America/Toronto",
        currency: "CAD",
        createdById: alex.id,
        createdAt: t,
      })
      .run();
    community = db.select().from(communities).where(eq(communities.id, id)).get()!;
    for (const [user, role] of [
      [alex, "owner"],
      [sam, "member"],
      [riley, "member"],
      [jordan, "member"],
    ] as const) {
      db.insert(memberships)
        .values({
          id: createId(),
          communityId: community.id,
          userId: user.id,
          role,
          status: "approved",
          createdAt: t,
          updatedAt: t,
        })
        .run();
    }
  }

  const hasEvent = db.select().from(weeklyEvents).where(eq(weeklyEvents.communityId, community.id)).get();
  if (!hasEvent) {
    db.insert(weeklyEvents)
      .values({
        id: createId(),
        communityId: community.id,
        title: "Wednesday 8v8",
        location: "Riverside turf",
        startsAt: t + 3 * 24 * 60 * 60 * 1000,
        durationMinutes: 90,
        hasTime: true,
        minPlayers: 2,
        rsvpDeadlineAt: t + 2 * 24 * 60 * 60 * 1000,
        status: "open",
        createdById: alex.id,
        createdAt: t,
      })
      .run();
  }

  const hasSeason = db.select().from(seasons).where(eq(seasons.communityId, community.id)).get();
  if (!hasSeason) {
    const seasonId = createId();
    const start = new Date();
    const end = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000);
    const ymd = (d: Date) => d.toISOString().slice(0, 10);
    const weekdays = [2, 4];
    db.insert(seasons)
      .values({
        id: seasonId,
        communityId: community.id,
        name: "Autumn turf",
        location: "Riverside turf",
        startDate: ymd(start),
        endDate: ymd(end),
        weekdays: JSON.stringify(weekdays),
        timeLocal: "20:00",
        durationMinutes: 90,
        regularPriceCents: 1200,
        homeVisibleWeeks: 4,
        minPlayers: 10,
        signupClosesAt: t + 7 * 24 * 60 * 60 * 1000,
        status: "locked",
        createdAt: t,
      })
      .run();
    const dates = eachSeasonDate(ymd(start), ymd(end), weekdays);
    for (const date of dates) {
      const sessionId = createId();
      db.insert(seasonSessions)
        .values({
          id: sessionId,
          seasonId,
          communityId: community.id,
          startsAt: zonedDateTimeToUtcMs(date, "20:00", "America/Toronto"),
          status: "scheduled",
          createdAt: t,
        })
        .run();
      db.insert(sessionSlots)
        .values({
          id: createId(),
          sessionId,
          userId: alex.id,
          kind: "contract",
          status: "contract_present",
          createdAt: t,
          updatedAt: t,
        })
        .run();
    }
    db.insert(contracts)
      .values({
        id: createId(),
        seasonId,
        userId: alex.id,
        prepaid: true,
        createdAt: t,
      })
      .run();
  }

  const hasAgreementDemo = db
    .select()
    .from(seasons)
    .where(eq(seasons.communityId, community.id))
    .all()
    .some((s) => s.name === "Spring agreement demo");
  if (!hasAgreementDemo) {
    const seasonId = createId();
    const start = new Date();
    const end = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
    const ymd = (d: Date) => d.toISOString().slice(0, 10);
    db.insert(seasons)
      .values({
        id: seasonId,
        communityId: community.id,
        name: "Spring agreement demo",
        location: "Riverside turf",
        startDate: ymd(start),
        endDate: ymd(end),
        weekdays: JSON.stringify([2, 4]),
        timeLocal: "20:00",
        durationMinutes: 90,
        regularPriceCents: 1500,
        occasionalPriceCents: 2250,
        occasionalPremiumPercent: 50,
        homeVisibleWeeks: 3,
        minPlayers: 2,
        signupClosesAt: t - 24 * 60 * 60 * 1000,
        status: "agreed",
        createdAt: t,
      })
      .run();
    for (const user of [alex, sam, riley]) {
      db.insert(seasonSignups)
        .values({
          id: createId(),
          seasonId,
          userId: user.id,
          intent: "agree",
          createdAt: t,
        })
        .run();
      db.insert(contracts)
        .values({
          id: createId(),
          seasonId,
          userId: user.id,
          prepaid: true,
          createdAt: t,
        })
        .run();
    }
  }

  await notify({
    userId: alex.id,
    communityId: community.id,
    type: "welcome",
    title: `Welcome to ${APP_NAME}`,
    body: "Your clubhouse is ready. Telegram DMs wait until the bot is linked.",
    href: "/app/c/tuesday-night-fc",
  });

  console.log("demo club: /app/c/tuesday-night-fc");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
