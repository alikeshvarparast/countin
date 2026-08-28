"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAccount, registerAccount, requestPasswordReset, resetPassword } from "@/lib/actions/auth";
import { Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

function AuthError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm font-medium text-danger" role="alert">
      {message}
    </p>
  );
}

export function RegisterForm({ next = "/app" }: { next?: string }) {
  const [state, action] = useActionState(
    async (_prev: { error?: string } | undefined, formData: FormData) => registerAccount(formData),
    undefined,
  );
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <Field label="Name">
        <Input name="name" required placeholder="Alex" />
      </Field>
      <Field label="Email">
        <Input name="email" type="email" required placeholder="you@club.com" />
      </Field>
      <Field label="Password">
        <Input name="password" type="password" required minLength={8} />
      </Field>
      <Field label="Telegram username or ID">
        <Input name="telegram" required placeholder="@yourhandle or numeric id" />
      </Field>
      <AuthError message={state?.error} />
      <SubmitButton>Create account</SubmitButton>
    </form>
  );
}

export function LoginForm({
  next = "/app",
  identifierLabel = "Email",
}: {
  next?: string;
  identifierLabel?: string;
}) {
  const [state, action] = useActionState(
    async (_prev: { error?: string } | undefined, formData: FormData) => loginAccount(formData),
    undefined,
  );
  const forgotHref = next !== "/app" && next !== "/ops" ? `/forgot-password?next=${encodeURIComponent(next)}` : "/forgot-password";
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <Field label={identifierLabel}>
        <Input name="email" type="text" required autoComplete="username" />
      </Field>
      <Field label="Password">
        <Input name="password" type="password" required autoComplete="current-password" />
      </Field>
      <AuthError message={state?.error} />
      <SubmitButton>Log in</SubmitButton>
      {identifierLabel === "Email" && (
        <p className="text-center text-sm">
          <Link href={forgotHref} className="text-primary hover:underline">
            Forgot password?
          </Link>
        </p>
      )}
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action] = useActionState(
    async (_prev: { error?: string } | undefined, formData: FormData) => requestPasswordReset(formData),
    undefined,
  );
  return (
    <form action={action} className="space-y-4">
      <Field label="Email">
        <Input name="email" type="email" required />
      </Field>
      <Field label="Telegram username or ID">
        <Input name="telegram" required placeholder="@yourhandle or numeric id" />
      </Field>
      <AuthError message={state?.error} />
      <SubmitButton>Continue</SubmitButton>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action] = useActionState(
    async (_prev: { error?: string } | undefined, formData: FormData) => resetPassword(formData),
    undefined,
  );
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <Field label="New password">
        <Input name="password" type="password" required minLength={8} />
      </Field>
      <Field label="Confirm password">
        <Input name="confirm" type="password" required minLength={8} />
      </Field>
      <AuthError message={state?.error} />
      <SubmitButton>Save new password</SubmitButton>
    </form>
  );
}
