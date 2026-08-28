import Link from "next/link";
import { AppHeader } from "@/components/header";
import { APP_NAME } from "@/lib/brand";
import { RegisterForm } from "@/components/auth-forms";
import { Card } from "@/components/ui";
import { safeNextPath } from "@/lib/utils";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const next = safeNextPath((await searchParams).next);
  const loginHref = next !== "/app" ? `/login?next=${encodeURIComponent(next)}` : "/login";

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-md px-4 py-10 sm:py-16">
        <h1 className="font-display text-3xl text-cream sm:text-4xl">Join {APP_NAME}</h1>
        <p className="mt-2 text-cream/60">
          Telegram is required so the app bot can DM you polls, invites, and costs. After you register, open the bot and tap Start.
        </p>
        <Card className="mt-8">
          <RegisterForm next={next} />
        </Card>
        <p className="mt-4 text-sm text-cream/50">
          Already registered?{" "}
          <Link href={loginHref} className="text-lime">
            Log in
          </Link>
        </p>
      </main>
    </div>
  );
}
