import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { MapPin } from "lucide-react";
import { auth } from "@/auth";
import { requestJoin } from "@/lib/actions/community";
import { AppHeader } from "@/components/header";
import { Avatar } from "@/components/avatar";
import { CommunityUid } from "@/components/community-uid";
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
      <main className="mx-auto max-w-3xl px-4 py-10">
        <div className="rounded-3xl border border-line bg-card p-6 text-ink sm:p-8">
          <div className="flex items-start gap-4">
            <Avatar src={community.imageUrl} name={community.name} size="xl" />
            <div className="min-w-0">
              <h1 className="font-display text-4xl leading-none text-ink sm:text-5xl">{community.name}</h1>
              <p className="mt-3 flex items-center gap-1.5 text-ink/70">
                <MapPin className="h-4 w-4" />
                {community.location || "Pitch TBD"} · {community.timezone} · {community.currency}
              </p>
              <div className="mt-3">
                <CommunityUid uid={community.uid} />
              </div>
            </div>
          </div>
        </div>
        {community.description && <p className="mt-6 text-lg text-ink/75">{community.description}</p>}
        <Card className="mt-8">
          {community.isPublic ? (
            <>
              {!session && (
                <p>
                  <Link href="/login" className="text-primary">
                    Log in
                  </Link>{" "}
                  to request a spot.
                </p>
              )}
              {membership?.status === "approved" && (
                <div className="flex items-center justify-between gap-4">
                  <Badge tone="lime">Member</Badge>
                  <Link href={`/app/c/${community.slug}`} className="font-medium text-primary">
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
            </>
          ) : (
            <>
              {membership?.status === "approved" || membership?.status === "suspended" ? (
                <div className="flex items-center justify-between gap-4">
                  <Badge tone="lime">Member</Badge>
                  <Link href={`/app/c/${community.slug}`} className="font-medium text-primary">
                    Open clubhouse →
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  <Badge tone="cream">Private</Badge>
                  <p className="text-sm text-ink/70">
                    This community is private. You can find it by UID, but joining is by invite link only.
                  </p>
                </div>
              )}
            </>
          )}
        </Card>
      </main>
    </div>
  );
}
