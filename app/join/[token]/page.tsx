import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCommunityByInviteToken } from "@/lib/access";
import { acceptInviteMembership } from "@/lib/join";
import { AppHeader } from "@/components/header";
import { LoginForm, RegisterForm } from "@/components/auth-forms";
import { Avatar } from "@/components/avatar";
import { Card } from "@/components/ui";

export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const community = getCommunityByInviteToken(token);
  if (!community) notFound();
  const session = await auth();
  if (session?.user?.id) {
    const result = acceptInviteMembership(token, session.user.id);
    if ("ok" in result) redirect(`/app/c/${result.slug}`);
    return (
      <div className="min-h-screen">
        <AppHeader />
        <main className="mx-auto max-w-md px-4 py-10">
          <p className="text-clay">{result.error}</p>
        </main>
      </div>
    );
  }

  const next = `/join/${token}`;

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-md px-4 py-10 sm:py-16">
        <div className="flex items-center gap-3">
          <Avatar src={community.imageUrl} name={community.name} size="lg" />
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-secondary">You&apos;re invited</p>
            <h1 className="font-display text-3xl">{community.name}</h1>
          </div>
        </div>
        <p className="mt-3 text-sm text-ink/60">
          Create an account or log in and you&apos;ll join this community right away.
        </p>
        <Card className="mt-8">
          <h2 className="mb-4 font-display text-xl">Register and join</h2>
          <RegisterForm next={next} />
        </Card>
        <p className="mt-4 text-sm text-ink/50">
          Already registered?{" "}
          <Link href={`/login?next=${encodeURIComponent(next)}`} className="text-primary">
            Log in
          </Link>
        </p>
        <Card className="mt-6">
          <h2 className="mb-4 font-display text-xl">Log in</h2>
          <LoginForm next={next} />
        </Card>
      </main>
    </div>
  );
}
