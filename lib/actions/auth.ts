"use server";

import { createHash, randomBytes } from "node:crypto";
import { hash } from "bcryptjs";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { APP_NAME } from "@/lib/brand";
import { createId, now } from "@/lib/id";
import { AuthError } from "next-auth";
import { headers } from "next/headers";
import { isOpsHostName, requestHostFromHeaders } from "@/lib/hosts";
import { safeNextPath } from "@/lib/utils";
import { notify } from "@/lib/notify";

const RESET_WINDOW_MS = 60 * 60 * 1000;

function normalizeTelegram(value: string) {
  return value.trim().replace(/^@/, "");
}

function nextAfterAuth(raw: unknown) {
  return safeNextPath(raw);
}

function hashResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function signInAndStay(email: string, password: string, rawNext: unknown) {
  const host = requestHostFromHeaders(await headers());
  const onOps = isOpsHostName(host);
  const next = onOps ? "/ops" : nextAfterAuth(rawNext);
  await signIn("credentials", { email, password, redirect: false });
  redirect(next);
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
    await signInAndStay(email, password, formData.get("next"));
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
    await signInAndStay(email, password, formData.get("next"));
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Email or password is incorrect." };
    }
    throw error;
  }
}

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  const telegramUsername = normalizeTelegram(String(formData.get("telegram") ?? ""));
  if (!email.includes("@")) return { error: "Enter a valid email." };
  if (telegramUsername.length < 3) {
    return { error: "Enter the Telegram username you registered with." };
  }

  const user = db.select().from(users).where(eq(users.email, email)).get();
  if (!user || normalizeTelegram(user.telegramUsername) !== telegramUsername) {
    return { error: "We could not find an account with that email and Telegram username." };
  }

  const token = randomBytes(32).toString("hex");
  db.update(users)
    .set({
      passwordResetToken: hashResetToken(token),
      passwordResetExpires: now() + RESET_WINDOW_MS,
    })
    .where(eq(users.id, user.id))
    .run();

  await notify({
    userId: user.id,
    type: "password_reset",
    title: "Password reset",
    body: `Someone started a ${APP_NAME} password reset for this account. If that was not you, you can ignore it.`,
    href: `/reset-password/${token}`,
  });

  redirect(`/reset-password/${token}`);
}

export async function resetPassword(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (token.length < 16) return { error: "This reset link is not valid." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (password !== confirm) return { error: "Those passwords do not match." };

  const tokenHash = hashResetToken(token);
  const user = db.select().from(users).where(eq(users.passwordResetToken, tokenHash)).get();
  if (!user || !user.passwordResetExpires || user.passwordResetExpires < now()) {
    return { error: "This reset link has expired. Request a new one." };
  }

  const passwordHash = await hash(password, 10);
  db.update(users)
    .set({
      passwordHash,
      passwordResetToken: null,
      passwordResetExpires: null,
    })
    .where(eq(users.id, user.id))
    .run();

  try {
    await signIn("credentials", {
      email: user.email,
      password,
      redirectTo: "/app",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Password updated. Log in with your new password." };
    }
    throw error;
  }
}
