import { CreateCommunityForm } from "@/components/community-forms";
import { Card } from "@/components/ui";

export default function NewCommunityPage() {
  return (
    <main className="mx-auto max-w-lg px-4 py-10">
      <h1 className="font-display text-4xl">New community</h1>
      <p className="mt-2 text-cream/60">You’ll be the admin. Others request to join.</p>
      <Card className="mt-8">
        <CreateCommunityForm />
      </Card>
    </main>
  );
}
