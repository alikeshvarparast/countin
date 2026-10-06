#!/usr/bin/env python3
"""Front proxy: trycloudflare → CountIn app + GitHub webhook path."""
from __future__ import annotations

import http.client
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

LISTEN = ("127.0.0.1", 8097)
APP = ("127.0.0.1", 8095)
HOOK = ("127.0.0.1", 8096)
COFORMIA = ("127.0.0.1", 8102)
COFORMIA_HOSTS = frozenset({
    "coformia.com",
    "www.coformia.com",
    "keshvarco.com",
    "www.keshvarco.com",
})
HOOK_PREFIXES = ("/hooks/", "/webhook")


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt: str, *args) -> None:
        print(f"[countin-proxy] {fmt % args}", flush=True)

    def _host(self) -> str:
        return (self.headers.get("Host") or "").split(":")[0].lower()

    def _hook_path(self) -> str:
        path = self.path
        bare, qs = (path.split("?", 1) + [""])[:2]
        suffix = f"?{qs}" if qs else ""
        if self._host() in COFORMIA_HOSTS and bare in ("/hooks/github", "/webhook"):
            return f"/hooks/github/coformia{suffix}"
        return path

    def _is_hook_path(self) -> bool:
        bare = self.path.split("?", 1)[0]
        return (
            bare == "/health"
            or bare.startswith(HOOK_PREFIXES)
            or bare in ("/hooks/github", "/webhook")
        )

    def _target(self):
        host = self._host()
        if host in COFORMIA_HOSTS:
            if self._is_hook_path():
                return HOOK
            return COFORMIA
        if self._is_hook_path():
            return HOOK
        return APP

    def _proxy(self) -> None:
        upstream_host, upstream_port = self._target()
        length = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(length) if length else None
        conn = http.client.HTTPConnection(upstream_host, upstream_port, timeout=120)
        original_host = self.headers.get("Host", "")
        headers = {k: v for k, v in self.headers.items() if k.lower() != "host"}
        headers["Host"] = original_host or f"{upstream_host}:{upstream_port}"
        if original_host and "x-forwarded-host" not in {k.lower() for k in headers}:
            headers["X-Forwarded-Host"] = original_host.split(":")[0]
        if "x-forwarded-proto" not in {k.lower() for k in headers}:
            headers["X-Forwarded-Proto"] = "https"
        try:
            upstream_path = self._hook_path() if self._target() == HOOK else self.path
            conn.request(self.command, upstream_path, body=body, headers=headers)
            resp = conn.getresponse()
            data = resp.read()
            self.send_response(resp.status, resp.reason)
            for k, v in resp.getheaders():
                if k.lower() in ("transfer-encoding", "connection"):
                    continue
                self.send_header(k, v)
            self.end_headers()
            if self.command != "HEAD":
                self.wfile.write(data)
        except Exception as exc:  # noqa: BLE001
            self.send_error(502, f"upstream error: {exc}")
        finally:
            conn.close()

    def do_GET(self) -> None:
        self._proxy()

    def do_POST(self) -> None:
        self._proxy()

    def do_PUT(self) -> None:
        self._proxy()

    def do_PATCH(self) -> None:
        self._proxy()

    def do_DELETE(self) -> None:
        self._proxy()

    def do_HEAD(self) -> None:
        self._proxy()

    def do_OPTIONS(self) -> None:
        self._proxy()


def main() -> None:
    server = ThreadingHTTPServer(LISTEN, Handler)
    print(f"[countin-proxy] {LISTEN[0]}:{LISTEN[1]} → app {APP} / hook {HOOK}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
