#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/github.sh"

TMP=$(mktemp)
trap 'rm -f "$TMP"' EXIT

# GraphQL query to fetch contributions by repository in last year
read -r -d '' QUERY <<'GRAPHQL'
"query($login:String!, $from:DateTime){ user(login:$login){ contributionsCollection(from:$from){ commitContributionsByRepository(maxRepositories:100){ repository{ name owner{ login } url primaryLanguage{ name } stargazerCount } contributions{ totalCount }} pullRequestContributionsByRepository(maxRepositories:100){ repository{ name owner{ login } url primaryLanguage{ name } stargazerCount } contributions{ totalCount }} } }}"
GRAPHQL

oneYearAgo=$(date -u -d "1 year ago" +%Y-%m-%dT%H:%M:%SZ)

resp=$(graphql "$QUERY" "{\"login\":\"$USERNAME\",\"from\":\"$oneYearAgo\"}")

# parse repositories and contributions
jq -r '.data.user.contributionsCollection' <<<"$resp" > "$TMP.coll"

jq -c '.commitContributionsByRepository[]' "$TMP.coll" 2>/dev/null | while read -r item; do
  repo=$(jq -r '.repository' <<<"$item")
  name=$(jq -r '.repository.name' <<<"$item")
  owner=$(jq -r '.repository.owner.login' <<<"$item")
  url=$(jq -r '.repository.url' <<<"$item")
  stars=$(jq -r '.repository.stargazerCount' <<<"$item")
  lang=$(jq -r '.repository.primaryLanguage.name // "-"' <<<"$item")
  count=$(jq -r '.contributions.totalCount' <<<"$item")
  echo -e "${owner}	${name}	${url}	${lang}	${stars}	commit	${count}" >> "$TMP.rows"
done

jq -c '.pullRequestContributionsByRepository[]' "$TMP.coll" 2>/dev/null | while read -r item; do
  owner=$(jq -r '.repository.owner.login' <<<"$item")
  name=$(jq -r '.repository.name' <<<"$item")
  url=$(jq -r '.repository.url' <<<"$item")
  stars=$(jq -r '.repository.stargazerCount' <<<"$item")
  lang=$(jq -r '.repository.primaryLanguage.name // "-"' <<<"$item")
  count=$(jq -r '.contributions.totalCount' <<<"$item")
  echo -e "${owner}	${name}	${url}	${lang}	${stars}	pr	${count}" >> "$TMP.rows"
done

# sort by contribution (here using simple order)
sort -t$'\t' -k7 -nr "$TMP.rows" | head -n 30 > "$TMP.sorted"

# build html
cat > "$TMP.html" <<'HTML'
<div style="display:flex;flex-direction:column;gap:8px">
HTML

while IFS=$'\t' read -r owner name url lang stars type count; do
  cat >> "$TMP.html" <<HTML
  <div style="padding:8px;border-radius:8px;border:1px solid rgba(0,0,0,0.06);display:flex;gap:12px;align-items:center">
    <div style="flex:1">
      <a href="${url}"><b>${owner}/${name}</b></a>
      <div style="font-size:12px;color:var(--color-text-secondary)">${lang} • ★ ${stars} • ${type} (${count})</div>
    </div>
  </div>
HTML

done < "$TMP.sorted"

cat >> "$TMP.html" <<'HTML'
</div>
HTML

replace_section "contributed-repositories" "$TMP.html"
echo "Contributed repositories updated"
