#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/github.sh"

TMP=$(mktemp)
trap 'rm -f "$TMP"' EXIT

# fetch user repos
repos=$(rest_get_paginated "/users/${USERNAME}/repos" 100)

# for each repo, get contributors and aggregate
jq -r '.[] | .full_name' <<<"$repos" > "$TMP.repolist"

declare -A contribs

while read -r full; do
  owner=$(cut -d/ -f1 <<<"$full")
  repo=$(cut -d/ -f2 <<<"$full")
  cjson=$(rest_get_paginated "/repos/${owner}/${repo}/contributors" 100)
  jq -c '.[]' <<<"$cjson" | while read -r c; do
    login=$(jq -r '.login' <<<"$c")
    avatar=$(jq -r '.avatar_url' <<<"$c")
    count=$(jq -r '.contributions' <<<"$c")
    # append to a temp file per user
    echo "${login}	${avatar}	${count}" >> "$TMP.contrib"
  done
done < "$TMP.repolist"

# aggregate top contributors
cat "$TMP.contrib" | awk -F"\t" '{a[$1]+=$3; avatar[$1]=$2} END{for(i in a) print i"\t"avatar[i]"\t"a[i]}' | sort -t$'\t' -k3 -nr | head -n 40 > "$TMP.top"

# build html
cat > "$TMP.html" <<'HTML'
<div style="display:flex;flex-wrap:wrap;gap:12px;justify-content:center;padding:8px;background:transparent">
HTML

while IFS=$'\t' read -r login avatar count; do
  cat >> "$TMP.html" <<HTML
  <div style="width:140px;height:180px;background:transparent;border:1px solid rgba(255,255,255,0.06);padding:12px;border-radius:6px;display:flex;flex-direction:column;align-items:center;justify-content:flex-start">
    <a href="https://github.com/${login}" style="text-decoration:none;display:flex;flex-direction:column;align-items:center;color:inherit">
      <div style="width:88px;height:88px;border-radius:50%;overflow:hidden;display:flex;align-items:center;justify-content:center;border:4px solid rgba(255,255,255,0.06);background:#0f1720">
        <img src="${avatar}&s=400" alt="${login}" style="width:100%;height:100%;object-fit:cover;display:block" />
      </div>
      <div style="margin-top:12px;text-align:center;">
        <b>${login}</b><br/>
        <small>${count} contributions</small>
      </div>
    </a>
  </div>
HTML

done < "$TMP.top"

cat >> "$TMP.html" <<'HTML'
</div>
HTML

replace_section "contributors" "$TMP.html"
echo "Contributors updated"
