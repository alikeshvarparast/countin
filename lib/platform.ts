import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

export function platformOwnerEmails() {
  return (process.env.PLATFORM_OWNER_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

export function isPlatformOwner(user: { id: string; email?: string | null }) {
  const email = user.email?.trim().toLowerCase();
  if (email && platformOwnerEmails().includes(email)) return true;
  const row = db.select({ platformRole: users.platformRole }).from(users).where(eq(users.id, user.id)).get();
  return row?.platformRole === "owner";
}

export async function requirePlatformOwner() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?next=/ops");
  const user = db.select().from(users).where(eq(users.id, session.user.id)).get();
  if (!user || !isPlatformOwner({ id: user.id, email: user.email })) notFound();
  return { id: user.id, name: user.name, email: user.email };
}
