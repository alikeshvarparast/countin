"use server";

import { hash } from "bcryptjs";
import { eq } from "drizzle-orm";
import { signIn } from "@/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { createId, now } from "@/lib/id";
import { AuthError } from "next-auth";

function normalizeTelegram(value: string) {
  return value.trim().replace(/^@/, "");
}

export async function registerAccount(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  const password = String(formData.get("password") ?? "");
  const telegramUsername = normalizeTelegram(String(formData.get("telegram") ?? ""));

  if (name.length < 2) return { error: "Enter your name." };
  if (!email.includes("@")) return { error: "Enter a valid email." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (telegramUsername.length < 3) {
    return { error: "Enter your Telegram username or numeric ID." };
  }

  const existing = db.select().from(users).where(eq(users.email, email)).get();
  if (existing) return { error: "An account with that email already exists." };

  const passwordHash = await hash(password, 10);
  db.insert(users)
    .values({
      id: createId(),
      name,
      email,
      passwordHash,
      telegramUsername,
      telegramLinkToken: createId(),
      createdAt: now(),
    })
    .run();

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: "/app",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Account created, but sign-in failed. Try logging in." };
    }
    throw error;
  }
}

export async function loginAccount(formData: FormData) {
  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  const password = String(formData.get("password") ?? "");
  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: "/app",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Email or password is incorrect." };
    }
    throw error;
  }
}
