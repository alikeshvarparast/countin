import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { countAppBadge } from "@/lib/unread";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  return NextResponse.json({ unread: countAppBadge(session.user.id) });
}
