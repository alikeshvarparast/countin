import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppHeader } from "@/components/header";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader />
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
