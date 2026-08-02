#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STATE_DIR="$APP_DIR/deploy/.state"
CURRENT_FILE="$STATE_DIR/current"
VERSIONS_FILE="$STATE_DIR/versions"
COMPOSE_FILE="$APP_DIR/deploy/docker-compose.prod.yml"

TARGET_SHA="${1:-$(git -C "$APP_DIR" rev-parse HEAD)}"
if [[ ! "$TARGET_SHA" =~ ^[0-9a-f]{7,64}$ ]]; then
  echo "Invalid deployment SHA: $TARGET_SHA" >&2
  exit 2
fi

if [[ ! -f "$APP_DIR/.env" || ! -f "$APP_DIR/backend/.env" ]]; then
  echo "Missing production environment files." >&2
  echo "Expected: $APP_DIR/.env and $APP_DIR/backend/.env" >&2
  exit 2
fi

mkdir -p "$STATE_DIR"
exec 9>"$STATE_DIR/deploy.lock"
flock -n 9 || {
  echo "Another deployment is already running." >&2
  exit 1
}

compose() {
  docker compose --env-file "$APP_DIR/.env" -f "$COMPOSE_FILE" "$@"
}

wait_for_health() {
  local attempt mysql_status
  for attempt in $(seq 1 30); do
    mysql_status="$(docker inspect -f '{{.State.Health.Status}}' strusnik_mysql 2>/dev/null || true)"
    if [[ "$mysql_status" == "healthy" ]] \
      && curl -fsS --max-time 3 http://127.0.0.1:5000/health >/dev/null \
      && curl -fsS --max-time 3 http://127.0.0.1:3000/ >/dev/null; then
      return 0
    fi
    sleep 2
  done

  compose ps >&2 || true
  compose logs --tail=80 >&2 || true
  return 1
}

cleanup_old_images() {
  local image tag
  if [[ ! -f "$VERSIONS_FILE" ]]; then
    return
  fi

  while read -r tag; do
    [[ -z "$tag" ]] && continue
    docker image rm "strusnik-api:$tag" "strusnik-frontend:$tag" >/dev/null 2>&1 || true
  done < <(tail -n +4 "$VERSIONS_FILE")
}

previous_sha=""
if [[ -f "$CURRENT_FILE" ]]; then
  previous_sha="$(tr -d '[:space:]' < "$CURRENT_FILE")"
fi

export IMAGE_TAG="$TARGET_SHA"
echo "Deploying $TARGET_SHA"
compose build
compose up -d --remove-orphans

if ! wait_for_health; then
  echo "Health check failed for $TARGET_SHA." >&2
  if [[ -n "$previous_sha" && "$previous_sha" != "$TARGET_SHA" ]]; then
    echo "Rolling back to $previous_sha"
    git -C "$APP_DIR" reset --hard "$previous_sha"
    export IMAGE_TAG="$previous_sha"
    compose up -d --no-build --remove-orphans
    if ! wait_for_health; then
      echo "Rollback health check also failed." >&2
      exit 1
    fi
  fi
  exit 1
fi

printf '%s\n' "$TARGET_SHA" > "$CURRENT_FILE"
{
  printf '%s\n' "$TARGET_SHA"
  [[ -n "$previous_sha" ]] && printf '%s\n' "$previous_sha"
  [[ -f "$VERSIONS_FILE" ]] && cat "$VERSIONS_FILE"
} | awk 'NF && !seen[$0]++' | head -n 3 > "$VERSIONS_FILE.tmp"
mv "$VERSIONS_FILE.tmp" "$VERSIONS_FILE"
cleanup_old_images

echo "Deployment $TARGET_SHA completed successfully."
