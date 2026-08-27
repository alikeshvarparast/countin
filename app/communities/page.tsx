import Link from "next/link";
import { desc } from "drizzle-orm";
import { AppHeader } from "@/components/header";
import { db } from "@/lib/db";
import { communities } from "@/lib/db/schema";
import { Card } from "@/components/ui";

export default function CommunitiesDirectoryPage() {
  const rows = db.select().from(communities).orderBy(desc(communities.createdAt)).all();
  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-4xl px-4 py-12">
        <h1 className="font-display text-4xl">Communities</h1>
        <p className="mt-2 text-cream/60">Anyone can browse. Joining needs an admin’s approval.</p>
        <div className="mt-8 space-y-4">
          {rows.length === 0 && (
            <Card>
              <p className="text-cream/70">No communities yet. Register and start one.</p>
            </Card>
          )}
          {rows.map((c) => (
            <Link key={c.id} href={`/communities/${c.slug}`}>
              <Card className="transition hover:border-lime/40">
                <h2 className="font-display text-2xl text-lime">{c.name}</h2>
                <p className="mt-1 text-sm text-cream/50">
                  {c.location || "Pitch TBD"} · {c.timezone} · {c.currency}
                </p>
                {c.description && <p className="mt-3 text-cream/70">{c.description}</p>}
              </Card>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
