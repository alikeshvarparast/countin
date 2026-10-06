#!/usr/bin/env python3
"""GitHub push webhooks → per-repo rebuild scripts. HMAC-SHA256 verified."""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import subprocess
import threading
from dataclasses import dataclass
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs

HOST = os.environ.get("COUNTIN_WEBHOOK_HOST", "127.0.0.1")
PORT = int(os.environ.get("COUNTIN_WEBHOOK_PORT", "8096"))


@dataclass(frozen=True)
class WebhookRoute:
    name: str
    secret: bytes
    branch: str
    rebuild_script: str


def _route(
    name: str,
    secret_env: str,
    branch_env: str,
    branch_default: str,
    rebuild_env: str,
    rebuild_default: str,
) -> WebhookRoute | None:
    secret = os.environ.get(secret_env, "").encode()
    if not secret:
        return None
    return WebhookRoute(
        name=name,
        secret=secret,
        branch=os.environ.get(branch_env, branch_default),
        rebuild_script=os.environ.get(rebuild_env, rebuild_default),
    )


def load_routes() -> dict[str, WebhookRoute]:
    routes: dict[str, WebhookRoute] = {}
    countin = _route(
        "countin",
        "COUNTIN_WEBHOOK_SECRET",
        "COUNTIN_BRANCH",
        "main",
        "COUNTIN_REBUILD_SCRIPT",
        "/opt/docker/countin/scripts/rebuild-from-github.sh",
    )
    if countin:
        for path in ("/", "/hooks/github", "/webhook"):
            routes[path] = countin
    coformia = _route(
        "coformia",
        "COFORMIA_WEBHOOK_SECRET",
        "COFORMIA_BRANCH",
        "main",
        "COFORMIA_REBUILD_SCRIPT",
        "/opt/docker/coformia/scripts/rebuild-from-github.sh",
    )
    if coformia:
        routes["/hooks/github/coformia"] = coformia
    return routes


def verify(secret: bytes, sig_header: str | None, body: bytes) -> bool:
    if not secret or not sig_header or not sig_header.startswith("sha256="):
        return False
    expected = "sha256=" + hmac.new(secret, body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, sig_header)


def parse_github_payload(body: bytes, content_type: str | None) -> dict:
    ctype = (content_type or "").split(";", 1)[0].strip().lower()
    if ctype == "application/x-www-form-urlencoded":
        fields = parse_qs(body.decode("utf-8", errors="replace"), keep_blank_values=True)
        raw = (fields.get("payload") or [None])[0]
        if not raw:
            raise json.JSONDecodeError("missing payload field", "", 0)
        return json.loads(raw)
    return json.loads(body.decode("utf-8"))


def trigger_rebuild(route: WebhookRoute, reason: str) -> None:
    def run() -> None:
        print(f"[github-webhook:{route.name}] rebuild: {reason}", flush=True)
        subprocess.run([route.rebuild_script], check=False)

    threading.Thread(target=run, daemon=True).start()


def make_handler(routes: dict[str, WebhookRoute]) -> type[BaseHTTPRequestHandler]:
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, fmt: str, *args) -> None:
            print(f"[github-webhook] {self.address_string()} {fmt % args}", flush=True)

        def _send(self, code: int, msg: str) -> None:
            body = msg.encode()
            self.send_response(code)
            self.send_header("Content-Type", "text/plain")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self) -> None:
            path = self.path.split("?", 1)[0]
            if path in ("/health",) or path in routes:
                self._send(200, "ok\n")
                return
            self._send(404, "not found\n")

        def do_POST(self) -> None:
            path = self.path.split("?", 1)[0]
            route = routes.get(path)
            if not route:
                self._send(404, "not found\n")
                return
            length = int(self.headers.get("Content-Length", "0"))
            body = self.rfile.read(length)
            if not verify(route.secret, self.headers.get("X-Hub-Signature-256"), body):
                self._send(401, "bad signature\n")
                return
            event = self.headers.get("X-GitHub-Event", "")
            if event == "ping":
                self._send(200, "pong\n")
                return
            if event != "push":
                self._send(200, f"ignored:{event}\n")
                return
            try:
                payload = parse_github_payload(body, self.headers.get("Content-Type"))
            except json.JSONDecodeError:
                self._send(400, "bad json\n")
                return
            ref = payload.get("ref", "")
            if ref != f"refs/heads/{route.branch}":
                self._send(200, f"ignored:{ref}\n")
                return
            sha = (payload.get("after") or "")[:12]
            self._send(202, f"rebuild:{route.name}:{sha}\n")
            trigger_rebuild(route, f"push {sha}")

    return Handler


def main() -> None:
    routes = load_routes()
    if not routes:
        raise SystemExit("At least one webhook secret is required (COUNTIN_WEBHOOK_SECRET or COFORMIA_WEBHOOK_SECRET)")
    handler = make_handler(routes)
    server = ThreadingHTTPServer((HOST, PORT), handler)
    names = sorted({r.name for r in routes.values()})
    print(f"[github-webhook] listening on {HOST}:{PORT} routes={names}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
