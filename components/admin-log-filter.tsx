"use client";

import { useRouter } from "next/navigation";
import { Button, Field, Input } from "@/components/ui";

export function AdminLogFilter({
  slug,
  from,
  to,
}: {
  slug: string;
  from?: string;
  to?: string;
}) {
  const router = useRouter();
  const base = `/app/c/${slug}/settings/log`;

  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const params = new URLSearchParams();
        const nextFrom = String(data.get("from") ?? "");
        const nextTo = String(data.get("to") ?? "");
        if (nextFrom) params.set("from", nextFrom);
        if (nextTo) params.set("to", nextTo);
        const query = params.toString();
        router.push(query ? `${base}?${query}` : base);
      }}
    >
      <Field label="From">
        <Input type="date" name="from" defaultValue={from ?? ""} />
      </Field>
      <Field label="To">
        <Input type="date" name="to" defaultValue={to ?? ""} />
      </Field>
      <Button type="submit" size="sm">
        Filter
      </Button>
      {(from || to) && (
        <button type="button" className="mb-1 text-sm text-primary" onClick={() => router.push(base)}>
          Clear dates
        </button>
      )}
    </form>
  );
}
