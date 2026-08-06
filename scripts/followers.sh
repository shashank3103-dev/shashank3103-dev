#!/usr/bin/env bash
set -euo pipefail

source "$(dirname "$0")/github.sh"

TMPFILE=$(mktemp)
trap 'rm -f "$TMPFILE"' EXIT

# fetch followers paginated
json=$(rest_get_paginated "/users/${USERNAME}/followers" 100)

# build HTML content
jq -r '[.[] | {login: .login, avatar: .avatar_url}]' <<<"$json" > "$TMPFILE"

count=$(jq 'length' "$TMPFILE")
if [[ "$count" -eq 0 ]]; then
  echo "No followers found"
  exit 0
fi

# newest first
jq 'reverse' "$TMPFILE" > "$TMPFILE.rev"
mv "$TMPFILE.rev" "$TMPFILE"

# limit
jq '.[0:120]' "$TMPFILE" > "$TMPFILE.lim"

# build HTML
cat > "$TMPFILE.html" <<'HTML'
<div style="display:flex;flex-wrap:wrap;gap:12px;justify-content:center;padding:8px;background:transparent">
HTML

jq -c '.[]' "$TMPFILE.lim" | while read -r item; do
  login=$(jq -r '.login' <<<"$item")
  avatar=$(jq -r '.avatar' <<<"$item")
  cat >> "$TMPFILE.html" <<HTML
  <div style="width:140px;height:180px;background:transparent;border:1px solid rgba(255,255,255,0.06);padding:12px;border-radius:6px;display:flex;flex-direction:column;align-items:center;justify-content:flex-start">
    <a href="https://github.com/${login}" style="text-decoration:none;display:flex;flex-direction:column;align-items:center;color:inherit">
      <div style="width:104px;height:104px;border-radius:50%;overflow:hidden;display:flex;align-items:center;justify-content:center;border:6px solid rgba(255,255,255,0.06);box-shadow:0 6px 18px rgba(2,6,23,0.6);background:#0f1720">
        <img src="${avatar}&s=400" alt="${login}" style="width:100%;height:100%;object-fit:cover;display:block" />
      </div>
      <div style="margin-top:12px;text-align:center;">
        <span style="color:#60a5fa;font-weight:600;text-decoration:underline">${login}</span>
      </div>
    </a>
  </div>
HTML

done

cat >> "$TMPFILE.html" <<'HTML'
</div>
HTML

# replace section
replace_section "followers" "$TMPFILE.html"

echo "Followers updated in README.md"
