"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/auth";
import { getCommunityBySlug, requireAdmin } from "@/lib/access";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { paymentMethods } from "@/lib/db/schema";
import { createId, now } from "@/lib/id";

export async function createPaymentMethod(formData: FormData) {
  const user = await requireUser();
  const slug = String(formData.get("slug") ?? "");
  const community = getCommunityBySlug(slug);
  if (!community) return { error: "Community not found." };
  requireAdmin(community.id, user.id);
  const label = String(formData.get("label") ?? "").trim();
  const details = String(formData.get("details") ?? "").trim();
  if (label.length < 2) return { error: "Give this method a short label." };
  if (details.length < 2) return { error: "Add payment details." };

  const id = createId();
  db.insert(paymentMethods)
    .values({
      id,
      communityId: community.id,
      label,
      details,
      createdById: user.id,
      createdAt: now(),
    })
    .run();

  audit({
    communityId: community.id,
    actorId: user.id,
    action: "payment_method.create",
    entityType: "payment_method",
    entityId: id,
  });

  revalidatePath(`/app/c/${slug}`);
  return { ok: true as const, id };
}

export async function deletePaymentMethod(formData: FormData) {
  const user = await requireUser();
  const slug = String(formData.get("slug") ?? "");
  const methodId = String(formData.get("methodId") ?? "");
  const community = getCommunityBySlug(slug);
  if (!community) return { error: "Community not found." };
  requireAdmin(community.id, user.id);
  const row = db.select().from(paymentMethods).where(eq(paymentMethods.id, methodId)).get();
  if (!row || row.communityId !== community.id) return { error: "Method not found." };
  db.delete(paymentMethods).where(eq(paymentMethods.id, methodId)).run();
  revalidatePath(`/app/c/${slug}`);
  return { ok: true as const };
}
