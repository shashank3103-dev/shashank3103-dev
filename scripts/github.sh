#!/usr/bin/env bash
set -euo pipefail

USERNAME=${USERNAME:-${GITHUB_USERNAME:-}}
TOKEN=${GITHUB_TOKEN:-${TOKEN:-}}

if [[ -z "$USERNAME" ]]; then
  echo "USERNAME or GITHUB_USERNAME is required in env" >&2
  exit 1
fi

BASE_REST="https://api.github.com"
BASE_GRAPHQL="https://api.github.com/graphql"

_auth_headers() {
  if [[ -n "$TOKEN" ]]; then
    echo -H "Authorization: Bearer $TOKEN" -H "Accept: application/vnd.github+json" -H "User-Agent: $USERNAME"
  else
    echo -H "Accept: application/vnd.github+json" -H "User-Agent: $USERNAME"
  fi
}

# rest_get <url>
rest_get() {
  local url="$1"
  curl -sS $(_auth_headers) "$url"
}

# rest_get_with_headers <url> -> prints body then returns link header in LINK_HEADER var
rest_get_with_headers() {
  local url="$1"
  # use -i to include headers
  local resp
  resp=$(curl -sS -D - $(_auth_headers) "$url")
  # separate headers and body
  LINK_HEADER=$(printf "%s" "$resp" | sed -n '1,/^\r$/p' | tr -d '\r' | awk '/^Link:/{print substr($0,7)}') || true
  # print body
  printf "%s" "$resp" | sed -n '/^\r$/,$p' | sed '1d'
}

# paginated fetch: collect items across pages (assumes JSON array pages)
rest_get_paginated() {
  local path="$1"
  local per_page=${2:-100}
  local url="$BASE_REST$path?per_page=$per_page"
  local out
  out="[]"
  while [[ -n "$url" ]]; do
    # fetch body and headers
    local resp
    resp=$(curl -sS -D - $(_auth_headers) "$url")
    local link
    link=$(printf "%s" "$resp" | sed -n '1,/^\r$/p' | tr -d '\r' | awk '/^Link:/{print substr($0,7)}' || true)
    local body
    body=$(printf "%s" "$resp" | sed -n '/^\r$/,$p' | sed '1d')
    # merge arrays using jq
    out=$(jq -s '.[0] + .[1]' <(printf '%s' "$out") <(printf '%s' "$body"))
    # find next
    if [[ -n "$link" ]] && printf "%s" "$link" | grep -q 'rel="next"'; then
      url=$(printf "%s" "$link" | sed -n 's/.*<\([^>]*\)>; rel="next".*/\1/p')
    else
      url=""
    fi
  done
  printf '%s' "$out"
}

# graphql query
graphql() {
  local q="$1"
  local vars="$2"
  if [[ -z "$TOKEN" ]]; then
    echo "GraphQL operations require TOKEN set" >&2
    return 1
  fi
  curl -sS -H "Authorization: Bearer $TOKEN" -H "Accept: application/vnd.github+json" -H "Content-Type: application/json" -d "{\"query\":$q,\"variables\":$vars}" "$BASE_GRAPHQL"
}

# helper: replace section in README
# replace_section <marker> <content_file>
replace_section() {
  local marker="$1"
  local content_file="$2"
  local readme="README.md"
  local start="<!--START_SECTION:${marker}-->"
  local end="<!--END_SECTION:${marker}-->"

  if ! grep -qF "$start" "$readme"; then
    echo "Marker $start not found in README.md" >&2
    return 1
  fi

  # build escaped content for sed
  local content
  content=$(sed 's/\/\\/g; s/&/\\&/g; s/\//\\\//g' "$content_file")

  # use awk to replace between markers while preserving newlines
  awk -v start="$start" -v end="$end" -v new="$content" '
    BEGIN{ins=0}
    $0==start{print start; print new; ins=1; next}
    $0==end{ins=0; print end; next}
    {if (!ins) print $0}
  ' "$readme" > "$readme.tmp" && mv "$readme.tmp" "$readme"
}
