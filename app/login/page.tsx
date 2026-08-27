import Link from "next/link";
import { AppHeader } from "@/components/header";
import { LoginForm } from "@/components/auth-forms";
import { Card } from "@/components/ui";

export default function LoginPage() {
  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-md px-4 py-16">
        <h1 className="font-display text-4xl text-cream">Welcome back</h1>
        <p className="mt-2 text-cream/60">Log in to your communities.</p>
        <Card className="mt-8">
          <LoginForm />
        </Card>
        <p className="mt-4 text-sm text-cream/50">
          New here?{" "}
          <Link href="/register" className="text-lime">
            Create an account
          </Link>
        </p>
      </main>
    </div>
  );
}
