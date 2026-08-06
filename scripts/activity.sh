#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/github.sh"

TMP=$(mktemp)
trap 'rm -f "$TMP"' EXIT

# fetch events
resp=$(rest_get "/users/${USERNAME}/events")
# filter relevant types and take first 10
jq '[.[] | select(.type=="PushEvent" or .type=="PullRequestEvent" or .type=="IssueCommentEvent" or .type=="ReleaseEvent" or .type=="CreateEvent")][0:10]' <<<"$resp" > "$TMP"

# build html
cat > "$TMP.html" <<'HTML'
<div style="display:flex;flex-direction:column;gap:8px">
HTML

jq -c '.[]' "$TMP" | while read -r e; do
  type=$(jq -r '.type' <<<"$e")
  repo=$(jq -r '.repo.name' <<<"$e")
  time=$(jq -r '.created_at' <<<"$e")
  case "$type" in
    PushEvent) action="pushed to <b>${repo}</b>";;
    PullRequestEvent) action="$(jq -r '.payload.action' <<<"$e") pull request on <b>${repo}</b>";;
    IssueCommentEvent) action="commented on issue in <b>${repo}</b>";;
    ReleaseEvent) action="$(jq -r '.payload.action' <<<"$e") release on <b>${repo}</b>";;
    CreateEvent) action="created $(jq -r '.payload.ref_type' <<<"$e") <b>${repo}</b>";;
    *) action="${type} on <b>${repo}</b>";;
  esac

  cat >> "$TMP.html" <<HTML
  <div style="padding:8px;border-radius:8px;border:1px solid rgba(0,0,0,0.06)"><div style="font-size:13px">${action}</div><div style="font-size:12px;color:var(--color-text-secondary)">${time}</div></div>
HTML

done

cat >> "$TMP.html" <<'HTML'
</div>
HTML

replace_section "recent-activity" "$TMP.html"
echo "Recent activity updated"
