/**
 * Seed public demo communities for the directory, plus one rich showcase club.
 * Creates 13 public clubs (6–79 members), club avatars for most, and showcase content.
 *
 * Marker: data/.demo-directory-v13 — delete to re-run on next boot.
 */
import { hash } from "bcryptjs";
import { eq } from "drizzle-orm";
import fs from "fs";
import path from "path";
import { db } from "@/lib/db";
import {
  chatMessages,
  chatReads,
  clubPollOptions,
  clubPollVotes,
  clubPolls,
  communities,
  ledgerEntries,
  memberships,
  rsvps,
  users,
  weeklyEvents,
} from "@/lib/db/schema";
import { createCommunityUid, createId, createInviteToken, now } from "@/lib/id";
import { saveImageBuffer } from "@/lib/uploads";

export const DEMO_DIRECTORY_MARKER = ".demo-directory-v14";

const DEMO_EMAIL_RE = /^(alex|sam|jordan|riley|demo\d+)@club\.com$/i;

function isDemoAccount(email: string | null | undefined) {
  return Boolean(email && DEMO_EMAIL_RE.test(email));
}

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

const FIRST = [
  "Alex", "Sam", "Jordan", "Riley", "Casey", "Morgan", "Taylor", "Avery",
  "Quinn", "Jamie", "Drew", "Cameron", "Reese", "Parker", "Skyler", "Hayden",
  "Blake", "Rowan", "Finley", "Emerson", "Kai", "Noah", "Mia", "Liam",
  "Olivia", "Ethan", "Sophia", "Lucas", "Amelia", "Mason", "Harper", "Logan",
  "Evelyn", "James", "Luna", "Benjamin", "Chloe", "Henry", "Penelope", "Jack",
  "Layla", "Leo", "Nora", "Owen", "Zoe", "Wyatt", "Ellie", "Caleb",
  "Stella", "Isaac", "Hazel", "Gabriel", "Violet", "Carter", "Aurora", "Julian",
  "Savannah", "Grayson", "Brooklyn", "Levi", "Paisley", "Sebastian", "Naomi", "Adrian",
  "Elena", "Nolan", "Ivy", "Ezra", "Willow", "Miles", "Ruby", "Theo",
  "Clara", "Felix", "Iris", "Arthur", "Daisy", "Hugo", "Freya", "Oscar",
];

const LAST = [
  "Nguyen", "Patel", "Kim", "Garcia", "Singh", "Chen", "Rossi", "Silva",
  "Anders", "Brooks", "Hayes", "Reed", "Cole", "Diaz", "Fox", "Grant",
  "Hill", "Lane", "Moss", "Park", "Quinn", "Shaw", "West", "Young",
];

/** 13 public demo clubs — sizes span ~6 to 79. Last entry is the rich showcase. */
const CLUBS: { name: string; members: number; color: string; withPic?: boolean }[] = [
  { name: "Riverside Kickers", members: 6, color: "2f6b4f", withPic: true },
  { name: "Harbor Night FC", members: 9, color: "1d4e89", withPic: true },
  { name: "Lakeview United", members: 16, color: "8b3a3a", withPic: true },
  { name: "Oak Street 8v8", members: 22, color: "5b4b8a", withPic: true },
  { name: "Maple Grove FC", members: 31, color: "b45309", withPic: true },
  { name: "Parkdale Pickups", members: 44, color: "0f766e", withPic: true },
  { name: "Southbank Strikers", members: 50, color: "7c3aed" },
  { name: "Dockside Dynamo", members: 57, color: "be123c", withPic: true },
  { name: "Riverbend Rovers", members: 69, color: "365314" },
  { name: "Crown Point FC", members: 66, color: "9a3412" },
  { name: "Station Yard FC", members: 73, color: "1e3a5f", withPic: true },
  { name: "Beacon Hill Ball", members: 76, color: "4c1d95" },
  { name: "Showcase United", members: 79, color: "14532d", withPic: true },
];

const LOCATIONS = [
  "Riverside turf",
  "Harbor field 2",
  "Lakeview dome",
  "Oak Street pitch",
  "Cedar sportsplex",
  "North End courts",
];

const CHAT_LINES = [
  "Who's bringing cones tonight?",
  "I can do 8 if we start on time.",
  "Field is booked — see you at the gate.",
  "Anyone have a spare bib?",
  "Traffic is light, leaving now.",
  "Great session last week.",
  "Let's keep 8v8 if we hit 16.",
  "I'll collect after we finish.",
  "Weather looks clear.",
  "Can we do a quick warm-up at 7:45?",
  "I'm bringing extras for guests.",
  "Vote on the poll when you can.",
  "Payment e-transfer works for me.",
  "Who is goalkeeping first half?",
  "See you on the pitch!",
  "That finish from Sam was filthy.",
  "Next week same time?",
  "I'll take the far side.",
  "Bring water — taps are off.",
  "Count me in for Sunday.",
];

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

async function fetchBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url, { headers: { "User-Agent": "CountIn-Seed/1.0" } });
  if (!res.ok) throw new Error(`fetch ${url} → ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function attachClubAvatar(communityId: string, name: string, color: string) {
  const label = encodeURIComponent(name.replace(/ FC| United| Ball$/g, "").split(" ").slice(0, 2).join(" "));
  const url = `https://ui-avatars.com/api/?name=${label}&background=${color}&color=fff&size=256&bold=true&format=png`;
  const buf = await fetchBuffer(url);
  const imageUrl = saveImageBuffer(buf, "communities", communityId, "image/png", "club.png");
  if (imageUrl) {
    db.update(communities).set({ imageUrl }).where(eq(communities.id, communityId)).run();
  }
  return imageUrl;
}

async function attachUserAvatar(userId: string, name: string, color: string) {
  const label = encodeURIComponent(name.split(" ").slice(0, 2).join(" "));
  const url = `https://ui-avatars.com/api/?name=${label}&background=${color}&color=fff&size=128&bold=true&format=png`;
  const buf = await fetchBuffer(url);
  const imageUrl = saveImageBuffer(buf, "users", userId, "image/png", "user.png");
  if (imageUrl) {
    db.update(users).set({ imageUrl }).where(eq(users.id, userId)).run();
  }
  return imageUrl;
}

async function ensureUserPool(passwordHash: string, needed: number) {
  // Only demo personas — never pull real live accounts into the member pool.
  const pool = db
    .select()
    .from(users)
    .all()
    .filter((u) => isDemoAccount(u.email) && u.platformRole !== "offline");
  let n = 0;
  while (pool.length < needed) {
    const first = FIRST[n % FIRST.length];
    const last = LAST[Math.floor(n / FIRST.length) % LAST.length];
    const email = `demo${String(n).padStart(3, "0")}@club.com`;
    const found = db.select().from(users).where(eq(users.email, email)).get();
    if (found) {
      if (!pool.some((u) => u.id === found.id)) pool.push(found);
    } else {
      const row = {
        id: createId(),
        name: `${first} ${last}`,
        email,
        passwordHash,
        telegramUsername: `demo${n}`,
        telegramLinkToken: createId(),
        paymentInfo: n % 3 === 0 ? "e-Transfer: demo@pay.local" : null,
        createdAt: now() - n * HOUR,
      };
      db.insert(users).values(row).run();
      pool.push(row as (typeof pool)[number]);
    }
    n += 1;
  }
  return pool;
}

/** Drop real-user memberships that earlier seeds attached to demo clubs. */
function pruneNonDemoMembers(communityId: string, keepUserIds: Set<string>) {
  const rows = db.select().from(memberships).where(eq(memberships.communityId, communityId)).all();
  for (const row of rows) {
    if (keepUserIds.has(row.userId)) continue;
    const member = db.select().from(users).where(eq(users.id, row.userId)).get();
    if (member && isDemoAccount(member.email)) continue;
    db.delete(memberships).where(eq(memberships.id, row.id)).run();
  }
}

function ensureMembership(communityId: string, userId: string, role: string, t: number) {
  const existing = db
    .select()
    .from(memberships)
    .where(eq(memberships.communityId, communityId))
    .all()
    .find((m) => m.userId === userId);
  if (existing) {
    if (existing.status !== "approved" || existing.role !== role) {
      db.update(memberships)
        .set({ status: "approved", role, updatedAt: t, ledgerAcceptedAt: t })
        .where(eq(memberships.id, existing.id))
        .run();
    }
    return;
  }
  db.insert(memberships)
    .values({
      id: createId(),
      communityId,
      userId,
      role,
      status: "approved",
      ledgerAcceptedAt: t,
      createdAt: t,
      updatedAt: t,
    })
    .run();
}

function seedShowcase(
  communityId: string,
  owner: { id: string; name: string },
  members: { id: string; name: string }[],
  t: number,
) {
  // Clear prior showcase content for idempotent re-runs (keep community + memberships).
  const oldEvents = db.select().from(weeklyEvents).where(eq(weeklyEvents.communityId, communityId)).all();
  for (const e of oldEvents) {
    db.delete(rsvps).where(eq(rsvps.eventId, e.id)).run();
    db.delete(ledgerEntries).where(eq(ledgerEntries.weeklyEventId, e.id)).run();
  }
  db.delete(weeklyEvents).where(eq(weeklyEvents.communityId, communityId)).run();
  db.delete(ledgerEntries).where(eq(ledgerEntries.communityId, communityId)).run();
  db.delete(chatMessages).where(eq(chatMessages.communityId, communityId)).run();
  db.delete(chatReads).where(eq(chatReads.communityId, communityId)).run();
  const oldPolls = db.select().from(clubPolls).where(eq(clubPolls.communityId, communityId)).all();
  for (const p of oldPolls) {
    const opts = db.select().from(clubPollOptions).where(eq(clubPollOptions.pollId, p.id)).all();
    for (const o of opts) {
      db.delete(clubPollVotes).where(eq(clubPollVotes.optionId, o.id)).run();
    }
    db.delete(clubPollOptions).where(eq(clubPollOptions.pollId, p.id)).run();
  }
  db.delete(clubPolls).where(eq(clubPolls.communityId, communityId)).run();

  const cast = members.slice(0, Math.min(24, members.length));
  const payerA = cast[1] ?? members[1];
  const payerB = cast[2] ?? members[2];

  // Club poll
  const pollId = createId();
  db.insert(clubPolls)
    .values({
      id: pollId,
      communityId,
      question: "Preferred kickoff for Thursday pickups?",
      createdById: owner.id,
      closesAt: t + 5 * DAY,
      createdAt: t - 2 * DAY,
    })
    .run();
  const optionLabels = ["7:30 PM", "8:00 PM", "8:30 PM"];
  const optionIds = optionLabels.map((label) => {
    const id = createId();
    db.insert(clubPollOptions).values({ id, pollId, label }).run();
    return id;
  });
  for (let i = 0; i < Math.min(12, cast.length); i++) {
    db.insert(clubPollVotes)
      .values({
        id: createId(),
        optionId: optionIds[i % optionIds.length],
        userId: cast[i].id,
        createdAt: t - DAY + i * HOUR,
      })
      .run();
  }

  // 2 upcoming events
  const upcomingSpecs = [
    { title: "Thursday night 8v8", offset: 2 * DAY + 3 * HOUR, duration: 90 },
    { title: "Sunday morning turf", offset: 5 * DAY + 10 * HOUR, duration: 90 },
  ];
  for (const spec of upcomingSpecs) {
    const id = createId();
    const startsAt = t + spec.offset;
    db.insert(weeklyEvents)
      .values({
        id,
        communityId,
        title: spec.title,
        location: "Riverside turf",
        startsAt,
        durationMinutes: spec.duration,
        hasTime: true,
        minPlayers: 10,
        maxPlayers: 16,
        rsvpDeadlineAt: startsAt - DAY,
        status: "booked",
        paymentMode: "postpay",
        collectorUserId: owner.id,
        createdById: owner.id,
        createdAt: t - 3 * DAY,
      })
      .run();
    for (let i = 0; i < Math.min(14, cast.length); i++) {
      db.insert(rsvps)
        .values({
          id: createId(),
          eventId: id,
          userId: cast[i].id,
          status: i % 7 === 0 ? "not_going" : "going",
          updatedAt: t - DAY,
        })
        .run();
    }
  }

  // Several past events
  const pastTitles = [
    "Tuesday open play",
    "Friday lights session",
    "Weekend mix",
    "Captain's pick",
    "Rain check make-up",
    "Skills + scrimmage",
  ];
  for (let i = 0; i < pastTitles.length; i++) {
    const id = createId();
    const startsAt = t - (i + 2) * DAY - 2 * HOUR;
    const completed = i < 4;
    db.insert(weeklyEvents)
      .values({
        id,
        communityId,
        title: pastTitles[i],
        location: "Riverside turf",
        startsAt,
        durationMinutes: 90,
        hasTime: true,
        minPlayers: 10,
        status: completed ? "completed" : "cancelled",
        paymentMode: "postpay",
        totalCostCents: completed ? 8000 : null,
        collectorUserId: owner.id,
        paymentRequestedAt: completed ? startsAt + 2 * HOUR : null,
        createdById: owner.id,
        createdAt: startsAt - 5 * DAY,
      })
      .run();
    for (let j = 0; j < Math.min(12, cast.length); j++) {
      db.insert(rsvps)
        .values({
          id: createId(),
          eventId: id,
          userId: cast[j].id,
          status: "going",
          updatedAt: startsAt - DAY,
        })
        .run();
    }
  }

  // Ledger: one pay request (pending owed by viewer/owner's teammate viewing as Alex)
  // For Alex as the demo viewer:
  //  - pending from Alex → request to pay (I owe)
  //  - claimed to Alex → waiting for approve
  const payEventId = createId();
  db.insert(weeklyEvents)
    .values({
      id: payEventId,
      communityId,
      title: "Ledger demo night",
      location: "Riverside turf",
      startsAt: t - 3 * DAY,
      durationMinutes: 90,
      hasTime: true,
      minPlayers: 8,
      status: "booked",
      paymentMode: "postpay",
      totalCostCents: 9000,
      collectorUserId: owner.id,
      paymentRequestedAt: t - 2 * DAY,
      createdById: owner.id,
      createdAt: t - 4 * DAY,
    })
    .run();

  // Alex owes (pending) — badge + "I have paid"
  db.insert(ledgerEntries)
    .values({
      id: createId(),
      communityId,
      fromUserId: owner.id,
      toUserId: payerA.id,
      amountCents: 1500,
      reason: "field_share",
      status: "pending",
      weeklyEventId: payEventId,
      createdAt: t - 2 * DAY,
    })
    .run();

  // Someone marked paid, Alex must verify — badge + "Verified"
  db.insert(ledgerEntries)
    .values({
      id: createId(),
      communityId,
      fromUserId: payerB.id,
      toUserId: owner.id,
      amountCents: 1500,
      reason: "field_share",
      status: "claimed",
      claimedAt: t - HOUR,
      weeklyEventId: payEventId,
      createdAt: t - 2 * DAY,
    })
    .run();

  // Extra settled rows for realism
  for (let i = 3; i < 7 && i < cast.length; i++) {
    db.insert(ledgerEntries)
      .values({
        id: createId(),
        communityId,
        fromUserId: cast[i].id,
        toUserId: owner.id,
        amountCents: 1500,
        reason: "field_share",
        status: "settled",
        claimedAt: t - DAY,
        settledAt: t - 12 * HOUR,
        settledById: owner.id,
        weeklyEventId: payEventId,
        createdAt: t - 2 * DAY,
      })
      .run();
  }

  // Chat history spanning 15 days
  const chatStart = t - 15 * DAY;
  const messages: { id: string; userId: string; body: string; createdAt: number }[] = [];
  let msgAt = chatStart;
  let line = 0;
  while (msgAt < t - 3 * HOUR) {
    const author = cast[line % cast.length];
    const body = CHAT_LINES[line % CHAT_LINES.length];
    const id = createId();
    messages.push({ id, userId: author.id, body, createdAt: msgAt });
    db.insert(chatMessages)
      .values({
        id,
        communityId,
        userId: author.id,
        body,
        createdAt: msgAt,
      })
      .run();
    msgAt += (2 + (line % 5)) * HOUR + (line % 3) * 15 * 60 * 1000;
    line += 1;
  }

  // Recent back-and-forth (still within the 15-day window)
  const recent = [
    { who: 1, body: "I'm in for Thursday." },
    { who: 2, body: "Same — bringing a guest if ok." },
    { who: 0, body: "Guest is fine if we're under 16." },
    { who: 3, body: "Poll is still open btw." },
    { who: 4, body: "Who's collecting this week?" },
    { who: 1, body: "Alex has the ledger open." },
    { who: 2, body: "I'll e-transfer tonight." },
    { who: 5, body: "See you at the gate." },
    { who: 3, body: "Bring an extra ball." },
    { who: 4, body: "Done — marked paid on my side." },
  ];
  for (let i = 0; i < recent.length; i++) {
    const author = cast[recent[i].who % cast.length];
    const createdAt = t - (recent.length - i) * 25 * 60 * 1000;
    const id = createId();
    messages.push({ id, userId: author.id, body: recent[i].body, createdAt });
    db.insert(chatMessages)
      .values({
        id,
        communityId,
        userId: author.id,
        body: recent[i].body,
        createdAt,
      })
      .run();
  }

  // Exactly 7 unread chat messages for the owner (from others)
  const fromOthers = messages.filter((m) => m.userId !== owner.id).sort((a, b) => a.createdAt - b.createdAt);
  const unread = fromOthers.slice(-7);
  const lastReadAt = unread.length > 0 ? unread[0].createdAt - 1 : t - DAY;
  db.insert(chatReads)
    .values({ communityId, userId: owner.id, lastReadAt })
    .run();

  console.log(
    `showcase: poll=1 upcoming=2 past=${pastTitles.length} chat=${messages.length} unreadForOwner=${unread.length} ledger=pending+claimed`,
  );
}

export async function seedDemoDirectory(opts?: { force?: boolean }) {
  const markerPath = path.join(process.cwd(), "data", DEMO_DIRECTORY_MARKER);
  if (!opts?.force && fs.existsSync(markerPath)) {
    return { skipped: true as const, reason: "already seeded" };
  }

  const t = now();
  const passwordHash = await hash("password123", 10);

  let alex = db.select().from(users).where(eq(users.email, "alex@club.com")).get();
  if (!alex) {
    const id = createId();
    db.insert(users)
      .values({
        id,
        name: "Alex Admin",
        email: "alex@club.com",
        passwordHash,
        telegramUsername: "alexfc",
        telegramLinkToken: createId(),
        paymentInfo: "e-Transfer: alex@club.com",
        createdAt: t,
      })
      .run();
    alex = db.select().from(users).where(eq(users.id, id)).get()!;
  }

  const pool = await ensureUserPool(passwordHash, 90);
  // Prefer alex first in pool
  const people = [alex, ...pool.filter((u) => u.id !== alex.id)];

  // Profile pics for a handful of members (directory face stacks)
  for (let i = 0; i < 18 && i < people.length; i++) {
    if (people[i].imageUrl) continue;
    const colors = ["2f6b4f", "1d4e89", "8b3a3a", "5b4b8a", "b45309", "0f766e"];
    try {
      await attachUserAvatar(people[i].id, people[i].name, colors[i % colors.length]);
    } catch (err) {
      console.warn("user avatar skip", people[i].email, err);
    }
  }

  const created: { name: string; slug: string; members: number; showcase?: boolean }[] = [];

  for (let i = 0; i < CLUBS.length; i++) {
    const spec = CLUBS[i];
    const name = spec.name;
    const slug = slugify(name);
    const targetMembers = spec.members;
    const showcase = i === CLUBS.length - 1;

    const ownerUser = showcase ? alex : people[(i % (people.length - 1)) + 1];

    let community = db.select().from(communities).where(eq(communities.slug, slug)).get();
    if (!community) {
      const id = createId();
      db.insert(communities)
        .values({
          id,
          name,
          slug,
          uid: createCommunityUid(),
          inviteToken: createInviteToken(),
          description: showcase
            ? "Demo club packed with poll, events, chat, and ledger activity."
            : `Public pickup community · ${name}.`,
          location: LOCATIONS[i % LOCATIONS.length],
          timezone: "America/Toronto",
          currency: "CAD",
          isPublic: true,
          createdById: ownerUser.id,
          createdAt: t - (CLUBS.length - i) * DAY,
        })
        .run();
      community = db.select().from(communities).where(eq(communities.id, id)).get()!;
    } else {
      db.update(communities)
        .set({
          isPublic: true,
          name,
          createdById: ownerUser.id,
          description: showcase
            ? "Demo club packed with poll, events, chat, and ledger activity."
            : community.description,
        })
        .where(eq(communities.id, community.id))
        .run();
    }

    // Members: Alex only joins the showcase club (so the directory stays public for demos).
    const ids = new Set<string>();
    if (showcase) ids.add(alex.id);
    ids.add(ownerUser.id);
    for (const u of people) {
      if (ids.size >= targetMembers) break;
      if (!showcase && u.id === alex.id) continue;
      ids.add(u.id);
    }
    for (const userId of ids) {
      const finalRole =
        showcase && userId === alex.id
          ? "owner"
          : !showcase && userId === ownerUser.id
            ? "owner"
            : "member";
      ensureMembership(community.id, userId, finalRole, t);
    }
    pruneNonDemoMembers(community.id, ids);

    if (spec.withPic) {
      try {
        await attachClubAvatar(community.id, name, spec.color);
      } catch (err) {
        console.warn("club avatar skip", slug, err);
      }
    }

    if (showcase) {
      const memberRows = [...ids]
        .map((id) => people.find((p) => p.id === id)!)
        .filter(Boolean);
      seedShowcase(community.id, alex, memberRows, t);
    }

    created.push({ name, slug, members: ids.size, showcase });
  }

  // Also mark existing football-test public if present
  const footballTest = db.select().from(communities).where(eq(communities.slug, "football-test")).get();
  if (footballTest && !footballTest.isPublic) {
    db.update(communities).set({ isPublic: true }).where(eq(communities.id, footballTest.id)).run();
  }

  fs.mkdirSync(path.dirname(markerPath), { recursive: true });
  fs.writeFileSync(markerPath, `${new Date().toISOString()}\n`);

  console.log("\nCreated / updated public communities:");
  for (const c of created) {
    console.log(
      `  ${c.slug.padEnd(24)} members=${String(c.members).padStart(2)}${c.showcase ? "  ← SHOWCASE (login alex@club.com)" : ""}`,
    );
  }

  return { skipped: false as const, created };
}
