"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui";

export function SubmitButton({
  children,
  variant = "primary",
}: {
  children: React.ReactNode;
  variant?: "primary" | "ghost" | "danger" | "cream";
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} disabled={pending}>
      {pending ? "Working…" : children}
    </Button>
  );
}
