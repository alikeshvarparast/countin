function stripProtocol(value: string) {
  return value.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
}

function splitHost(value: string) {
  const cleaned = stripProtocol(value);
  const [hostname, port] = cleaned.split(":");
  return { hostname, port: port || "" };
}

export function hostsEqual(a: string, b: string) {
  const left = splitHost(a);
  const right = splitHost(b);
  if (left.hostname !== right.hostname) return false;
  if (!left.port || !right.port) return true;
  return left.port === right.port;
}

export function opsHostConfig() {
  return stripProtocol(process.env.OPS_HOST?.trim() || "ops.localhost:3000");
}

export function requestHostFromHeaders(headersList: { get(name: string): string | null }) {
  return stripProtocol(headersList.get("x-forwarded-host") ?? headersList.get("host") ?? "");
}

export function isOpsHostName(host: string) {
  const ops = opsHostConfig();
  return Boolean(ops && host && hostsEqual(host, ops));
}

export function memberOrigin() {
  return (process.env.AUTH_URL ?? process.env.APP_ORIGIN ?? "http://localhost:3000").replace(/\/$/, "");
}

export function opsOrigin() {
  const host = opsHostConfig();
  if (!host) return "";
  if (host.includes("localhost") || host.startsWith("127.0.0.1")) return `http://${host}`;
  return `https://${host}`;
}

export function isOpsAllowedPath(pathname: string) {
  return (
    pathname === "/" ||
    pathname.startsWith("/ops") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico"
  );
}
