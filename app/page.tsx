import Link from "next/link";
import { AppHeader } from "@/components/header";
import { auth } from "@/auth";

export default async function HomePage() {
  const session = await auth();
  return (
    <div className="pitch-grid min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-6xl px-4 py-16">
        <p className="text-sm uppercase tracking-[0.3em] text-lime/80">Community football, without the group chat chaos</p>
        <h1 className="mt-4 max-w-3xl font-display text-5xl leading-tight text-cream md:text-7xl">
          Book the pitch when the numbers are there.
        </h1>
        <p className="mt-6 max-w-xl text-lg text-cream/70">
          Pitchside runs weekly pickup and prepaid seasons: polls, RSVPs, waitlists, replacements, and a ledger for who owes whom.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link href={session ? "/app" : "/register"} className="rounded-full bg-lime px-5 py-3 font-medium text-pitch">
            {session ? "Open your clubs" : "Start a community"}
          </Link>
          <Link href="/communities" className="rounded-full border border-line px-5 py-3 text-cream">
            Browse communities
          </Link>
        </div>
        <div className="mt-20 grid gap-6 md:grid-cols-3">
          {[
            {
              title: "Weekly arrangement",
              body: "Poll a time, lock it, collect presence until the deadline, then book when you hit the minimum. Split the cost after the game.",
            },
            {
              title: "Long-term contract",
              body: "Prepaid players are auto-in. Occasionals wait for approval and pay 50% more. Absent contract players can invite a replacement at the regular rate.",
            },
            {
              title: "Alerts that land",
              body: "Inbox in the app, and the same message from the Pitchside Telegram bot. WhatsApp uses the same pipeline later.",
            },
          ].map((item) => (
            <div key={item.title} className="rounded-2xl border border-line bg-pitch-2/70 p-6">
              <h2 className="font-display text-2xl text-lime">{item.title}</h2>
              <p className="mt-3 text-cream/70">{item.body}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
