#!/usr/bin/env sh
set -eu

# Usage:
#   ./deploy/bootstrap-secrets.sh ./deploy/secrets.env
#
# Expected keys in secrets.env:
# POSTGRES_PASSWORD
# DATABASE_URL
# JWT_SECRET
# OPENAI_API_KEY
# JSEARCH_API_KEY
# ADZUNA_APP_ID
# ADZUNA_APP_KEY
# SENDGRID_API_KEY
# SENDGRID_FROM_EMAIL

SECRETS_FILE="${1:-./deploy/secrets.env}"

if [ ! -f "$SECRETS_FILE" ]; then
  echo "Secrets file not found: $SECRETS_FILE" >&2
  exit 1
fi

# shellcheck source=/dev/null
. "$SECRETS_FILE"

ensure_secret() {
  name="$1"
  value="$2"

  if [ -z "$value" ]; then
    echo "Skipping empty secret: $name"
    return 0
  fi

  if docker secret inspect "$name" >/dev/null 2>&1; then
    echo "Secret exists: $name"
    return 0
  fi

  printf "%s" "$value" | docker secret create "$name" -
  echo "Created secret: $name"
}

ensure_secret "postgres_password" "${POSTGRES_PASSWORD:-}"
ensure_secret "database_url" "${DATABASE_URL:-}"
ensure_secret "jwt_secret" "${JWT_SECRET:-}"
ensure_secret "openai_api_key" "${OPENAI_API_KEY:-}"
ensure_secret "jsearch_api_key" "${JSEARCH_API_KEY:-}"
ensure_secret "adzuna_app_id" "${ADZUNA_APP_ID:-}"
ensure_secret "adzuna_app_key" "${ADZUNA_APP_KEY:-}"
ensure_secret "sendgrid_api_key" "${SENDGRID_API_KEY:-}"
ensure_secret "sendgrid_from_email" "${SENDGRID_FROM_EMAIL:-}"

echo "Secret bootstrap complete."
