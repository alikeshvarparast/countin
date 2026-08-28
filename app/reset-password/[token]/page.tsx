import { createHash } from "node:crypto";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { AppHeader } from "@/components/header";
import { ResetPasswordForm } from "@/components/auth-forms";
import { Card } from "@/components/ui";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { now } from "@/lib/id";

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const user = db.select().from(users).where(eq(users.passwordResetToken, tokenHash)).get();
  const valid = Boolean(user?.passwordResetExpires && user.passwordResetExpires >= now());

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-md px-4 py-10 sm:py-16">
        <h1 className="font-display text-3xl text-cream sm:text-4xl">New password</h1>
        <Card className="mt-8">
          {valid ? (
            <ResetPasswordForm token={token} />
          ) : (
            <div className="space-y-3">
              <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm font-medium text-danger" role="alert">
                This reset link is invalid or has expired.
              </p>
              <Link href="/forgot-password" className="inline-block text-sm text-primary">
                Request a new one
              </Link>
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}
