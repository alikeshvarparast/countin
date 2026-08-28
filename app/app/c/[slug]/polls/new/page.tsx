import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCommunityBySlug, isStaff } from "@/lib/access";
import { ClubPollForm } from "@/components/club-poll-form";
import { Card } from "@/components/ui";

export default async function NewPollPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const community = getCommunityBySlug(slug);
  if (!community) notFound();
  const session = await auth();
  if (!session?.user?.id || !isStaff(community.id, session.user.id)) {
    redirect(`/app/c/${slug}`);
  }
  return (
    <div className="max-w-lg">
      <h2 className="font-display text-2xl">New poll</h2>
      <p className="mt-1 text-sm text-ink/55">Ask the squad anything — kickoff times, kits, who can drive.</p>
      <Card className="mt-6">
        <ClubPollForm slug={slug} />
      </Card>
    </div>
  );
}
