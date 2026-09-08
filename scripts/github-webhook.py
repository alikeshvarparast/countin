#!/usr/bin/env python3
"""GitHub push webhook → countin rebuild. HMAC-SHA256 verified."""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import subprocess
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

SECRET = os.environ.get("COUNTIN_WEBHOOK_SECRET", "").encode()
BRANCH = os.environ.get("COUNTIN_BRANCH", "main")
REBUILD = os.environ.get(
    "COUNTIN_REBUILD_SCRIPT",
    "/opt/docker/countin/scripts/rebuild-from-github.sh",
)
HOST = os.environ.get("COUNTIN_WEBHOOK_HOST", "127.0.0.1")
PORT = int(os.environ.get("COUNTIN_WEBHOOK_PORT", "8096"))


def verify(sig_header: str | None, body: bytes) -> bool:
    if not SECRET or not sig_header or not sig_header.startswith("sha256="):
        return False
    expected = "sha256=" + hmac.new(SECRET, body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, sig_header)


def trigger_rebuild(reason: str) -> None:
    def run() -> None:
        print(f"[countin-webhook] rebuild: {reason}", flush=True)
        subprocess.run([REBUILD], check=False)

    threading.Thread(target=run, daemon=True).start()


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt: str, *args) -> None:
        print(f"[countin-webhook] {self.address_string()} {fmt % args}", flush=True)

    def _send(self, code: int, msg: str) -> None:
        body = msg.encode()
        self.send_response(code)
        self.send_header("Content-Type", "text/plain")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        if self.path in ("/", "/health"):
            self._send(200, "ok\n")
            return
        self._send(404, "not found\n")

    def do_POST(self) -> None:
        if self.path not in ("/", "/hooks/github", "/webhook"):
            self._send(404, "not found\n")
            return
        length = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(length)
        if not verify(self.headers.get("X-Hub-Signature-256"), body):
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
            payload = json.loads(body.decode())
        except json.JSONDecodeError:
            self._send(400, "bad json\n")
            return
        ref = payload.get("ref", "")
        if ref != f"refs/heads/{BRANCH}":
            self._send(200, f"ignored:{ref}\n")
            return
        sha = (payload.get("after") or "")[:12]
        self._send(202, f"rebuild:{sha}\n")
        trigger_rebuild(f"push {sha}")


def main() -> None:
    if not SECRET:
        raise SystemExit("COUNTIN_WEBHOOK_SECRET is required")
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"[countin-webhook] listening on {HOST}:{PORT}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
