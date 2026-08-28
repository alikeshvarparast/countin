import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isOpsAllowedPath, isOpsHostName, memberOrigin, opsHostConfig, requestHostFromHeaders } from "@/lib/hosts";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/uploads/")) return NextResponse.next();

  const opsHost = opsHostConfig();
  const host = requestHostFromHeaders(request.headers);
  const onOps = Boolean(opsHost) && isOpsHostName(host);

  if (onOps) {
    if (pathname === "/") {
      const url = request.nextUrl.clone();
      url.pathname = "/ops";
      return NextResponse.rewrite(url);
    }
    if (isOpsAllowedPath(pathname)) return NextResponse.next();
    const member = memberOrigin();
    return NextResponse.redirect(new URL(pathname + request.nextUrl.search, member));
  }

  if (pathname === "/ops" || pathname.startsWith("/ops/")) {
    if (!opsHost) return NextResponse.next();
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/((?!_next/static|_next/image).*)",
  ],
};
