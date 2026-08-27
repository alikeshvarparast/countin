import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppHeader } from "@/components/header";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return (
    <div className="min-h-screen">
      <AppHeader />
      {children}
    </div>
  );
}
