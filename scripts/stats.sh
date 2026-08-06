#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/github.sh"

TMP=$(mktemp)
trap 'rm -f "$TMP"' EXIT

# user info
user=$(rest_get "/users/${USERNAME}")

public_repos=$(jq -r '.public_repos' <<<"$user")
followers=$(jq -r '.followers' <<<"$user")
following=$(jq -r '.following' <<<"$user")

# gather repos
repos=$(rest_get_paginated "/users/${USERNAME}/repos" 100)
stars=$(jq '[.[] | .stargazers_count] | add' <<<"$repos")
forks=$(jq '[.[] | .forks_count] | add' <<<"$repos")

# contributions via GraphQL
read -r -d '' QUERY <<'GRAPHQL'
"query($login:String!){ user(login:$login){ contributionsCollection{ totalCommitContributions pullRequestContributionsByRepository(maxRepositories:100){ contributions{ totalCount } } issueContributionsByRepository(maxRepositories:100){ contributions{ totalCount } } } } }"
GRAPHQL

resp=$(graphql "$QUERY" "{\"login\":\"$USERNAME\"}")

commits=$(jq -r '.data.user.contributionsCollection.totalCommitContributions // 0' <<<"$resp")
mergedPRs=$(jq -r '.data.user.contributionsCollection.pullRequestContributionsByRepository | map(.contributions.totalCount) | add // 0' <<<"$resp")
issues=$(jq -r '.data.user.contributionsCollection.issueContributionsByRepository | map(.contributions.totalCount) | add // 0' <<<"$resp")

# build cards
cat > "$TMP.html" <<HTML
<div style="display:flex;flex-direction:column;gap:12px">
HTML

card() {
  echo "<div style=\"text-align:center\"><div style=\"font-size:18px;font-weight:600\">$2</div><div style=\"font-size:12px;color:var(--color-text-secondary)\">$1</div><div style=\"font-size:12px;margin-top:6px;color:var(--color-text-tertiary)\">$3</div></div>"
}

cat >> "$TMP.html" <<HTML
$(card 'Public repositories' "$public_repos" '')
$(card 'Followers' "$followers" '')
$(card 'Following' "$following" '')
$(card 'Stars (earned)' "$stars" '')
$(card 'Forks' "$forks" '')
$(card 'Commits (est.)' "$commits" '')
$(card 'Merged PRs (est.)' "$mergedPRs" '')
$(card 'Issues' "$issues" '')
HTML

cat >> "$TMP.html" <<'HTML'
</div>
HTML

replace_section "github-stats" "$TMP.html"
echo "Stats updated"
