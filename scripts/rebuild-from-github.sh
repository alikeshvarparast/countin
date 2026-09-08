#!/usr/bin/env bash
# Pull latest main from GitHub and rebuild CountIn if SHA changed.
set -euo pipefail

REPO_DIR="/opt/docker/countin"
BRANCH="${COUNTIN_BRANCH:-main}"
LOCK="/var/lock/countin-rebuild.lock"
LOG_TAG="countin-rebuild"

log() { echo "[${LOG_TAG}] $*" >&2; }

exec 9>"$LOCK"
if ! flock -n 9; then
  log "another rebuild in progress; skip"
  exit 0
fi

cd "$REPO_DIR"

# Preserve local deploy overlays (Dockerfile, compose, webhook scripts) not in upstream.
git fetch --quiet origin "$BRANCH"
remote_sha="$(git rev-parse "origin/${BRANCH}")"

if git merge-base --is-ancestor "$remote_sha" HEAD; then
  if [[ "${FORCE_REBUILD:-0}" != "1" ]]; then
    log "already includes ${remote_sha:0:12}; nothing to do"
    exit 0
  fi
  log "forcing rebuild at $(git rev-parse --short HEAD)"
else
  local_sha="$(git rev-parse --short HEAD)"
  log "rebasing ${local_sha} onto ${remote_sha:0:12}"
  git checkout --quiet "$BRANCH"
  if ! git rebase --quiet "origin/${BRANCH}"; then
    log "rebase failed; aborting (resolve conflicts manually)"
    git rebase --abort
    exit 1
  fi
fi

log "building image"
docker compose build

log "recreating container"
docker compose up -d --force-recreate

log "done at $(git rev-parse --short HEAD)"
