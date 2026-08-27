"use client";

import { useActionState } from "react";
import { loginAccount, registerAccount } from "@/lib/actions/auth";
import { Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

export function RegisterForm() {
  const [state, action] = useActionState(
    async (_prev: { error?: string } | undefined, formData: FormData) => registerAccount(formData),
    undefined,
  );
  return (
    <form action={action} className="space-y-4">
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
      {state?.error && <p className="text-sm text-clay">{state.error}</p>}
      <SubmitButton>Create account</SubmitButton>
    </form>
  );
}

export function LoginForm() {
  const [state, action] = useActionState(
    async (_prev: { error?: string } | undefined, formData: FormData) => loginAccount(formData),
    undefined,
  );
  return (
    <form action={action} className="space-y-4">
      <Field label="Email">
        <Input name="email" type="email" required />
      </Field>
      <Field label="Password">
        <Input name="password" type="password" required />
      </Field>
      {state?.error && <p className="text-sm text-clay">{state.error}</p>}
      <SubmitButton>Log in</SubmitButton>
    </form>
  );
}
