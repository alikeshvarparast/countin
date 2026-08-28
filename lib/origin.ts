import { headers } from "next/headers";
import { isOpsHostName, requestHostFromHeaders } from "@/lib/hosts";

export async function getAppOrigin() {
  const env = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL;
  if (env) return env.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function isOpsRequest() {
  const h = await headers();
  return isOpsHostName(requestHostFromHeaders(h));
}
