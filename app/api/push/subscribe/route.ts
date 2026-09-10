import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { deletePushSubscription, savePushSubscription } from "@/lib/push";

export const runtime = "nodejs";

type SubscriptionBody = {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
};

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as SubscriptionBody;
  if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
    return NextResponse.json({ error: "Invalid subscription." }, { status: 400 });
  }
  savePushSubscription({
    userId: session.user.id,
    endpoint: body.endpoint,
    p256dh: body.keys.p256dh,
    auth: body.keys.auth,
    userAgent: request.headers.get("user-agent"),
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { endpoint?: string };
  if (!body.endpoint) return NextResponse.json({ error: "Missing endpoint." }, { status: 400 });
  deletePushSubscription(body.endpoint, session.user.id);
  return NextResponse.json({ ok: true });
}
