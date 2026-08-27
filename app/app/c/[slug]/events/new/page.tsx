import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getCommunityBySlug, isAdmin } from "@/lib/access";
import { WeeklyEventForm } from "@/components/weekly-form";
import { Card } from "@/components/ui";

export default async function NewEventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const community = getCommunityBySlug(slug);
  if (!community) notFound();
  const session = await auth();
  if (!session?.user?.id || !isAdmin(community.id, session.user.id)) {
    return <p>Only admins can create events.</p>;
  }
  return (
    <div className="max-w-lg">
      <h2 className="font-display text-3xl">New weekly event</h2>
      <Card className="mt-6">
        <WeeklyEventForm slug={slug} defaultLocation={community.location ?? ""} />
      </Card>
    </div>
  );
}
