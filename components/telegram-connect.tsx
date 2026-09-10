"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { regenerateTelegramLink } from "@/lib/actions/community";
import { Button } from "@/components/ui";
import { APP_NAME } from "@/lib/brand";

export function TelegramConnect({
  linked,
  href,
  bot,
}: {
  linked: boolean;
  href: string | null;
  bot: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function makeNewLink() {
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const result = await regenerateTelegramLink();
      router.refresh();
      if (result && "error" in result && result.error) {
        setError(result.error);
        return;
      }
      setStatus("New start link ready.");
      if (result && "href" in result && result.href) {
        window.location.href = result.href;
      }
    } catch {
      setError("Could not create a start link. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2 space-y-3 text-sm text-ink/70">
      {linked ? (
        <p>Linked. DMs will arrive from the {APP_NAME} bot.</p>
      ) : (
        <p>Messages are not linked yet. Open the bot and tap Start so Telegram can deliver alerts.</p>
      )}
      {href ? (
        <a
          href={href}
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-4 text-sm font-medium text-ink"
        >
          Open @{bot || "bot"} and tap Start
        </a>
      ) : (
        <p>
          The bot username is missing on the server, so a start link cannot be built yet. You can still use the in-app
          inbox.
        </p>
      )}
      {status && <p className="text-primary">{status}</p>}
      {error && <p className="text-danger">{error}</p>}
      <div>
        <Button type="button" variant="ghost" disabled={busy} onClick={() => void makeNewLink()}>
          {busy ? "Creating link…" : "New start link"}
        </Button>
      </div>
    </div>
  );
}
