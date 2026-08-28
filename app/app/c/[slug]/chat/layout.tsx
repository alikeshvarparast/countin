export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-x-0 top-[calc(env(safe-area-inset-top)+8.25rem)] bottom-[calc(env(safe-area-inset-bottom)+3.5rem)] z-10 flex flex-col overflow-hidden bg-muted sm:top-[calc(env(safe-area-inset-top)+8.75rem)] lg:inset-auto lg:bottom-0 lg:left-[4.5rem] lg:right-0 lg:top-[calc(env(safe-area-inset-top)+4rem)]">
      {children}
    </div>
  );
}
