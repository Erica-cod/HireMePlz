#!/usr/bin/env sh
set -eu

# Usage:
#   ./deploy/deploy-stack.sh ./deploy/swarm.env

ENV_FILE="${1:-./deploy/swarm.env}"
STACK_NAME="${STACK_NAME:-hiremeplz}"

if [ ! -f "$ENV_FILE" ]; then
  echo "Env file not found: $ENV_FILE" >&2
  exit 1
fi

# shellcheck source=/dev/null
. "$ENV_FILE"

if [ -z "${IMAGE_REGISTRY:-}" ] || [ -z "${IMAGE_TAG:-}" ] || [ -z "${DOMAIN:-}" ] || [ -z "${LETSENCRYPT_EMAIL:-}" ]; then
  echo "Missing required variables in $ENV_FILE" >&2
  echo "Required: IMAGE_REGISTRY, IMAGE_TAG, DOMAIN, LETSENCRYPT_EMAIL" >&2
  exit 1
fi

export IMAGE_REGISTRY IMAGE_TAG DOMAIN LETSENCRYPT_EMAIL
export OPENAI_MODEL="${OPENAI_MODEL:-gpt-4o-mini}"
export JOB_ALERT_MIN_SCORE="${JOB_ALERT_MIN_SCORE:-0.75}"

docker stack deploy \
  -c deploy/swarm-stack.yml \
  --with-registry-auth \
  --prune \
  "$STACK_NAME"

echo "Deployed stack: $STACK_NAME"
