import Link from "next/link";
import { AppHeader } from "@/components/header";
import { RegisterForm } from "@/components/auth-forms";
import { Card } from "@/components/ui";

export default function RegisterPage() {
  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-md px-4 py-16">
        <h1 className="font-display text-4xl text-cream">Join Pitchside</h1>
        <p className="mt-2 text-cream/60">
          Telegram is required so the app bot can DM you polls, invites, and costs. After you register, open the bot and tap Start.
        </p>
        <Card className="mt-8">
          <RegisterForm />
        </Card>
        <p className="mt-4 text-sm text-cream/50">
          Already registered?{" "}
          <Link href="/login" className="text-lime">
            Log in
          </Link>
        </p>
      </main>
    </div>
  );
}
