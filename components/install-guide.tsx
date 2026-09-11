"use client";

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { Check, EllipsisVertical, Share, Smartphone, SquarePlus } from "lucide-react";
import { Button } from "@/components/ui";
import {
  canPromptInstall,
  installPlatform,
  isStandaloneDisplay,
  promptInstall,
  subscribeInstallPrompt,
} from "@/lib/pwa-client";

const emptySubscribe = () => () => {};

export function InstallGuide() {
  const platform = useSyncExternalStore(emptySubscribe, installPlatform, () => "desktop" as const);
  const standalone = useSyncExternalStore(emptySubscribe, isStandaloneDisplay, () => false);
  const [installable, setInstallable] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setInstallable(canPromptInstall());
    return subscribeInstallPrompt(() => setInstallable(canPromptInstall()));
  }, []);

  if (standalone) {
    return (
      <div className="flex items-start gap-3 text-sm text-ink">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary">
          <Check className="h-4 w-4" />
        </span>
        <p>
          CountIn is on this Home Screen. Open it from the icon so alerts and the unread badge stay
          attached to the app.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 text-sm text-ink/70">
      <p>
        Install CountIn on your phone. It opens full-screen, keeps you signed in, and can show
        notifications on the app icon.
      </p>
      {installable && (
        <Button
          type="button"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void promptInstall().finally(() => setBusy(false));
          }}
        >
          {busy ? "Installing…" : "Install CountIn"}
        </Button>
      )}
      {platform === "ios" && <IosSteps />}
      {platform === "android" && <AndroidSteps installable={installable} />}
      {platform === "desktop" && <DesktopSteps />}
    </div>
  );
}

function IosSteps() {
  return (
    <ol className="space-y-3">
      <Step n={1} icon={<Share className="h-4 w-4" />} title="Tap Share">
        In Safari, tap the Share button — the square with the arrow pointing up.
      </Step>
      <PhoneFrame>
        <div className="flex items-center justify-between border-b border-line px-3 py-2 text-[11px] text-ink/55">
          <span>Safari</span>
          <span>countin</span>
        </div>
        <div className="flex flex-1 items-end justify-center pb-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
            <Share className="h-4 w-4 text-primary" />
          </div>
        </div>
      </PhoneFrame>
      <Step n={2} icon={<SquarePlus className="h-4 w-4" />} title="Add to Home Screen">
        Scroll the sheet and tap <strong className="font-medium text-ink">Add to Home Screen</strong>,
        then tap Add.
      </Step>
      <PhoneFrame>
        <div className="space-y-1.5 px-3 py-3">
          <SheetRow icon={<SquarePlus className="h-3.5 w-3.5" />} label="Add to Home Screen" active />
          <SheetRow icon={<Share className="h-3.5 w-3.5" />} label="Share…" />
        </div>
      </PhoneFrame>
      <Step n={3} icon={<Smartphone className="h-4 w-4" />} title="Open the CountIn icon">
        Leave Safari and tap the new CountIn icon. Notifications only work from that icon, not from
        the Safari tab.
      </Step>
    </ol>
  );
}

function AndroidSteps({ installable }: { installable: boolean }) {
  return (
    <ol className="space-y-3">
      <Step n={1} icon={<EllipsisVertical className="h-4 w-4" />} title="Open the browser menu">
        Tap the three dots in Chrome or Edge.
      </Step>
      <PhoneFrame>
        <div className="flex justify-end px-3 py-2">
          <EllipsisVertical className="h-4 w-4 text-primary" />
        </div>
        <div className="space-y-1.5 px-3 pb-3">
          <SheetRow icon={<Smartphone className="h-3.5 w-3.5" />} label="Install app" active />
          <SheetRow icon={<SquarePlus className="h-3.5 w-3.5" />} label="Add to Home screen" />
        </div>
      </PhoneFrame>
      <Step n={2} icon={<Smartphone className="h-4 w-4" />} title="Install CountIn">
        {installable
          ? "Use Install CountIn above, or choose Install app in the menu."
          : "Tap Install app or Add to Home screen, then confirm."}
      </Step>
      <Step n={3} icon={<Check className="h-4 w-4" />} title="Open it from the icon">
        Launch CountIn from your Home Screen so it runs without the browser bar.
      </Step>
    </ol>
  );
}

function DesktopSteps() {
  return (
    <ol className="space-y-3">
      <Step n={1} icon={<Smartphone className="h-4 w-4" />} title="Open this site on your phone">
        On iPhone use Safari. On Android use Chrome. Then follow the install steps on that device.
      </Step>
      <Step n={2} icon={<Share className="h-4 w-4" />} title="Add to Home Screen">
        iPhone: Share → Add to Home Screen. Android: browser menu → Install app.
      </Step>
    </ol>
  );
}

function Step({
  n,
  icon,
  title,
  children,
}: {
  n: number;
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-ink">
        {n}
      </span>
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 font-medium text-ink">
          {icon}
          {title}
        </p>
        <p className="mt-0.5">{children}</p>
      </div>
    </li>
  );
}

function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="ml-10 w-44 overflow-hidden rounded-2xl border border-line bg-card shadow-[0_8px_24px_rgba(63,58,52,0.08)]">
      <div className="flex justify-center bg-muted py-1.5">
        <span className="h-1 w-8 rounded-full bg-ink/15" />
      </div>
      <div className="flex min-h-24 flex-col">{children}</div>
    </div>
  );
}

function SheetRow({
  icon,
  label,
  active,
}: {
  icon: ReactNode;
  label: string;
  active?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2 rounded-xl px-2.5 py-2 text-[11px] ${
        active ? "bg-primary/15 font-medium text-ink" : "bg-muted text-ink/55"
      }`}
    >
      {icon}
      {label}
    </div>
  );
}
