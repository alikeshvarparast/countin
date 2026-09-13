"use client";

import { useMemo, useState } from "react";
import { Avatar } from "@/components/avatar";

type Person = { id: string; name: string; imageUrl?: string | null };

export function NonVotersToggle({ people }: { people: Person[] }) {
  const [show, setShow] = useState(false);
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return people;
    return people.filter((p) => p.name.toLowerCase().includes(q));
  }, [people, query]);

  if (people.length === 0) return null;

  return (
    <div className="mt-5 border-t border-line pt-5">
      <label className="flex cursor-pointer items-center gap-2 text-sm text-ink/70">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-line"
          checked={show}
          onChange={(e) => setShow(e.target.checked)}
        />
        Show who did not vote
        <span className="text-ink/45">· {people.length}</span>
      </label>
      {show && (
        <div className="mt-3 space-y-2">
          {people.length > 12 && (
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search names…"
              className="w-full rounded-xl border border-line bg-card px-3 py-2 text-sm outline-none focus:border-primary"
              autoComplete="off"
            />
          )}
          <ul className="max-h-64 space-y-1 overflow-y-auto rounded-xl border border-line bg-muted/30 p-2 text-sm">
            {filtered.length === 0 && <li className="px-1 py-2 text-ink/45">No matching names.</li>}
            {filtered.map((p) => (
              <li key={p.id} className="flex items-center gap-2 rounded-lg px-1 py-1">
                <Avatar src={p.imageUrl} name={p.name} size="xs" />
                <span className="truncate">{p.name}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
