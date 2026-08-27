import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { requestJoin } from "@/lib/actions/community";
import { AppHeader } from "@/components/header";
import { SubmitButton } from "@/components/submit-button";
import { Badge, Card } from "@/components/ui";
import { db } from "@/lib/db";
import { communities, memberships } from "@/lib/db/schema";

export default async function CommunityPublicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const community = db.select().from(communities).where(eq(communities.slug, slug)).get();
  if (!community) {
    return (
      <div className="min-h-screen">
        <AppHeader />
        <p className="p-8">Community not found.</p>
      </div>
    );
  }
  const session = await auth();
  const membership = session?.user?.id
    ? db
        .select()
        .from(memberships)
        .where(and(eq(memberships.communityId, community.id), eq(memberships.userId, session.user.id)))
        .get()
    : undefined;

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="font-display text-5xl">{community.name}</h1>
        <p className="mt-2 text-cream/60">
          {community.location || "Pitch TBD"} · {community.timezone} · {community.currency}
        </p>
        {community.description && <p className="mt-6 text-lg text-cream/80">{community.description}</p>}
        <Card className="mt-8">
          {!session && (
            <p>
              <Link href="/login" className="text-lime">
                Log in
              </Link>{" "}
              to request a spot.
            </p>
          )}
          {membership?.status === "approved" && (
            <div className="flex items-center justify-between gap-4">
              <Badge tone="lime">Member</Badge>
              <Link href={`/app/c/${community.slug}`} className="text-lime">
                Open clubhouse →
              </Link>
            </div>
          )}
          {membership?.status === "pending" && <Badge tone="clay">Request pending</Badge>}
          {membership?.status === "rejected" && (
            <div className="space-y-3">
              <Badge tone="cream">Previously declined</Badge>
              <form
                action={async () => {
                  "use server";
                  await requestJoin(slug);
                }}
              >
                <SubmitButton>Request again</SubmitButton>
              </form>
            </div>
          )}
          {session && !membership && (
            <form
              action={async () => {
                "use server";
                await requestJoin(slug);
              }}
            >
              <SubmitButton>Request to join</SubmitButton>
            </form>
          )}
        </Card>
      </main>
    </div>
  );
}
