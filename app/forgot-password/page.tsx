import Link from "next/link";
import { AppHeader } from "@/components/header";
import { ForgotPasswordForm } from "@/components/auth-forms";
import { Card } from "@/components/ui";

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-md px-4 py-10 sm:py-16">
        <h1 className="font-display text-3xl text-cream sm:text-4xl">Forgot password</h1>
        <p className="mt-2 text-cream/60">
          Enter the email and Telegram username you used to register. Then you can choose a new password.
        </p>
        <Card className="mt-8">
          <ForgotPasswordForm />
        </Card>
        <p className="mt-4 text-sm text-cream/50">
          Remembered it?{" "}
          <Link href="/login" className="text-lime">
            Log in
          </Link>
        </p>
      </main>
    </div>
  );
}
