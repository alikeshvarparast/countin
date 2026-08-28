import Link from "next/link";
import { AppHeader } from "@/components/header";
import { LoginForm } from "@/components/auth-forms";
import { Card } from "@/components/ui";
import { isOpsRequest } from "@/lib/origin";
import { APP_NAME } from "@/lib/brand";
import { safeNextPath } from "@/lib/utils";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const ops = await isOpsRequest();
  const next = ops ? "/ops" : safeNextPath((await searchParams).next);
  const registerHref = next !== "/app" ? `/register?next=${encodeURIComponent(next)}` : "/register";

  if (ops) {
    return (
      <div className="min-h-screen bg-muted">
        <header className="border-b border-line bg-ink text-card">
          <div className="flex h-14 items-center px-4 sm:h-16 sm:px-6">
            <span className="font-display text-lg">{APP_NAME} Ops</span>
          </div>
        </header>
        <main className="mx-auto max-w-md px-4 py-10 sm:py-16">
          <h1 className="font-display text-3xl sm:text-4xl">Operator sign-in</h1>
          <p className="mt-2 text-sm text-ink/50">This console is separate from {APP_NAME}.</p>
          <Card className="mt-8">
            <LoginForm next={next} identifierLabel="Username" />
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-md px-4 py-10 sm:py-16">
        <h1 className="font-display text-3xl text-cream sm:text-4xl">Welcome back</h1>
        <p className="mt-2 text-cream/60">Log in to your communities.</p>
        <Card className="mt-8">
          <LoginForm next={next} />
        </Card>
        <p className="mt-4 text-sm text-cream/50">
          New here?{" "}
          <Link href={registerHref} className="text-lime">
            Create an account
          </Link>
        </p>
      </main>
    </div>
  );
}