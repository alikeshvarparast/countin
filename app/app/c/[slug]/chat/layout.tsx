export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 z-10 flex min-h-0 flex-col overflow-hidden bg-[#e8e0d5] pb-[calc(3.5rem+env(safe-area-inset-bottom))] transition-[padding] duration-200 lg:pb-0">
      <div className="chat-shell flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
    </div>
  );
}
