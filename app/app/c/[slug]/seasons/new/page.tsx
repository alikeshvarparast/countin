import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getCommunityBySlug, isAdmin } from "@/lib/access";
import { SeasonForm } from "@/components/season-form";
import { Card } from "@/components/ui";

export default async function NewSeasonPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const community = getCommunityBySlug(slug);
  if (!community) notFound();
  const session = await auth();
  if (!session?.user?.id || !isAdmin(community.id, session.user.id)) {
    return <p>Only admins can create seasons.</p>;
  }
  return (
    <div className="max-w-lg">
      <h2 className="font-display text-2xl">New season</h2>
      <p className="mt-1 text-sm text-ink/55">
        Starts as a contract agreement, not an event. Nights appear only after you close the vote and create them.
      </p>
      <Card className="mt-6">
        <SeasonForm slug={slug} defaultLocation={community.location ?? ""} />
      </Card>
    </div>
  );
}
