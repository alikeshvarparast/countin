"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/auth";
import {
  getCommunityBySlug,
  listAdmins,
  requireAdmin,
  requireMember,
} from "@/lib/access";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { communities, memberships, users } from "@/lib/db/schema";
import { createId, now } from "@/lib/id";
import { notify, notifyMany } from "@/lib/notify";
import { CURRENCIES, TIMEZONES, slugify } from "@/lib/utils";

export async function createCommunity(formData: FormData) {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();
  const timezone = String(formData.get("timezone") ?? "America/Toronto");
  const currency = String(formData.get("currency") ?? "CAD");

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
  db.insert(communities)
    .values({
      id,
      name,
      slug,
      description: description || null,
      location: location || null,
      timezone,
      currency,
      createdById: user.id,
      createdAt: t,
    })
    .run();

  db.insert(memberships)
    .values({
      id: createId(),
      communityId: id,
      userId: user.id,
      role: "admin",
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
  revalidatePath("/app");
  return { ok: true, slug };
}

export async function updateCommunitySettings(formData: FormData) {
  const user = await requireUser();
  const slug = String(formData.get("slug") ?? "");
  const community = getCommunityBySlug(slug);
  if (!community) return { error: "Community not found." };
  requireAdmin(community.id, user.id);

  const description = String(formData.get("description") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();
  const timezone = String(formData.get("timezone") ?? community.timezone);
  const currency = String(formData.get("currency") ?? community.currency);
  const name = String(formData.get("name") ?? community.name).trim();

  if (name.length < 2) return { error: "Name is required." };
  if (!TIMEZONES.includes(timezone as (typeof TIMEZONES)[number])) {
    return { error: "Pick a valid timezone." };
  }
  if (!CURRENCIES.includes(currency as (typeof CURRENCIES)[number])) {
    return { error: "Pick a valid currency." };
  }

  db.update(communities)
    .set({ name, description: description || null, location: location || null, timezone, currency })
    .where(eq(communities.id, community.id))
    .run();

  audit({
    communityId: community.id,
    actorId: user.id,
    action: "community.update",
    entityType: "community",
    entityId: community.id,
    meta: { timezone, currency },
  });

  revalidatePath(`/app/c/${slug}`);
  revalidatePath(`/communities/${slug}`);
  return { ok: true };
}

export async function requestJoin(slug: string) {
  const user = await requireUser();
  const community = getCommunityBySlug(slug);
  if (!community) return { error: "Community not found." };

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

  db.update(users)
    .set({
      name,
      telegramUsername,
      whatsappPhone: whatsappPhone || null,
      ...(telegramChanged ? { telegramChatId: null, telegramLinkToken: createId() } : {}),
    })
    .where(eq(users.id, user.id))
    .run();

  revalidatePath("/app/profile");
  return { ok: true };
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
