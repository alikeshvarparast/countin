export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="-mx-4 -mb-24 -mt-4 flex min-h-0 flex-1 flex-col sm:-mx-6 lg:mx-0 lg:-mb-8 lg:-mt-6 lg:mr-[-2rem]">
      <div className="chat-shell flex min-h-0 flex-1 flex-col overflow-hidden pb-[calc(3.5rem+env(safe-area-inset-bottom))] transition-[padding] duration-200 lg:pb-0">
        {children}
      </div>
    </div>
  );
}
