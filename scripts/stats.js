const fs = require('fs');
const path = require('path');
const { requestRestPaginated, requestRest, requestGraphQL, USERNAME } = require('./github');
const { renderCardGrid, escapeHtml, writeSection } = require('./utils');

const README = path.join(process.cwd(), 'README.md');

async function gatherUser() {
  const { data } = await requestRest(`/users/${USERNAME}`);
  return data;
}

async function gatherRepos() {
  return await requestRestPaginated(`/users/${USERNAME}/repos`);
}

async function calculateStats() {
  const user = await gatherUser();
  const repos = await gatherRepos();
  const totalRepos = user.public_repos || 0;
  const followers = user.followers || 0;
  const following = user.following || 0;
  let stars = 0;
  let forks = 0;
  for (const r of repos) {
    stars += r.stargazers_count || 0;
    forks += r.forks_count || 0;
  }

  // contributions via GraphQL: merged PRs, commits, issues
  const QUERY = `query($login:String!) { user(login:$login) { contributionsCollection { totalCommitContributions, pullRequestContributionsByRepository(maxRepositories:1) { contributions { totalCount } }, issueContributionsByRepository(maxRepositories:1) { contributions { totalCount } }, pullRequestContributions(first: 1) { totalCount } } } }`;
  let mergedPRs = 0;
  let commits = 0;
  let issues = 0;
  try {
    const data = await requestGraphQL(QUERY, { login: USERNAME });
    const coll = data.user.contributionsCollection || {};
    commits = coll.totalCommitContributions || 0;
    mergedPRs = (coll.pullRequestContributionsByRepository && coll.pullRequestContributionsByRepository.reduce((s,it)=>s+(it.contributions.totalCount||0),0)) || 0;
    issues = (coll.issueContributionsByRepository && coll.issueContributionsByRepository.reduce((s,it)=>s+(it.contributions.totalCount||0),0)) || 0;
  } catch (e) {
    console.warn('GraphQL stats partial failure:', e.message);
  }

  return { totalRepos, followers, following, stars, forks, commits, mergedPRs, issues };
}

function makeCard(title, value, sub) {
  return `<div style="text-align:center"><div style="font-size:18px;font-weight:600">${escapeHtml(String(value))}</div><div style="font-size:12px;color:var(--color-text-secondary)">${escapeHtml(title)}</div><div style="font-size:12px;margin-top:6px;color:var(--color-text-tertiary)">${escapeHtml(sub||'')}</div></div>`;
}

(async function main() {
  try {
    const s = await calculateStats();
    const cards = [];
    cards.push(makeCard('Public repositories', s.totalRepos));
    cards.push(makeCard('Followers', s.followers));
    cards.push(makeCard('Following', s.following));
    cards.push(makeCard('Stars (earned)', s.stars));
    cards.push(makeCard('Forks', s.forks));
    cards.push(makeCard('Commits (est.)', s.commits));
    cards.push(makeCard('Merged PRs (est.)', s.mergedPRs));
    cards.push(makeCard('Issues', s.issues));

    const html = renderCardGrid(cards, 3);
    const ok = writeSection(README, 'github-stats', html);
    if (!ok) process.exit(0);
    console.log('Updated github-stats section');
  } catch (e) {
    console.error('Error building stats:', e);
    process.exit(2);
  }
})();
