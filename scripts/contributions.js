const fs = require('fs');
const path = require('path');
const { requestGraphQL, USERNAME } = require('./github');
const { escapeHtml, writeSection } = require('./utils');

const README = path.join(process.cwd(), 'README.md');

const QUERY = `query($login:String!, $from:DateTime) {
  user(login: $login) {
    contributionsCollection(from: $from) {
      commitContributionsByRepository(maxRepositories: 100) {
        repository {
          name
          owner { login }
          url
          primaryLanguage { name }
          stargazerCount
        }
        contributions(first:1) { totalCount }
      }
      pullRequestContributionsByRepository(maxRepositories: 100) {
        repository { name owner { login } url primaryLanguage { name } stargazerCount }
        contributions(first:1) { totalCount }
      }
    }
  }
}`;

function renderRow(repo, type, count) {
  const lang = repo.primaryLanguage ? escapeHtml(repo.primaryLanguage.name) : '—';
  return `
  <div style="padding:8px;border-radius:8px;border:1px solid rgba(0,0,0,0.06);display:flex;gap:12px;align-items:center">
    <div style="flex:1">
      <a href="${escapeHtml(repo.url)}"><b>${escapeHtml(repo.owner.login)}/${escapeHtml(repo.name)}</b></a>
      <div style="font-size:12px;color:var(--color-text-secondary)">${lang} • ★ ${repo.stargazerCount} • ${type} (${count})</div>
    </div>
  </div>
  `;
}

(async function main() {
  try {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const variables = { login: USERNAME, from: oneYearAgo.toISOString() };
    const data = await requestGraphQL(QUERY, variables);
    const coll = data.user.contributionsCollection;
    const rows = [];
    const repoMap = new Map();

    for (const item of coll.commitContributionsByRepository || []) {
      const repo = item.repository;
      const count = item.contributions.totalCount || 0;
      repoMap.set(`${repo.owner.login}/${repo.name}`, { repo, type: 'commit', count, when: Date.now() });
    }
    for (const item of coll.pullRequestContributionsByRepository || []) {
      const repo = item.repository;
      const count = item.contributions.totalCount || 0;
      const key = `${repo.owner.login}/${repo.name}`;
      const prev = repoMap.get(key);
      if (prev) {
        prev.count += count;
        prev.type = prev.type + ', pr';
      } else {
        repoMap.set(key, { repo, type: 'pr', count, when: Date.now() });
      }
    }

    const sorted = Array.from(repoMap.values()).sort((a, b) => b.when - a.when).slice(0, 30);
    for (const r of sorted) rows.push(renderRow(r.repo, r.type, r.count));

    const html = `<div style="display:flex;flex-direction:column;gap:8px">${rows.join('\n')}</div>`;
    const ok = writeSection(README, 'contributed-repositories', html);
    if (!ok) process.exit(0);
    console.log('Updated contributed-repositories section');
  } catch (e) {
    console.error('Error building contributed repos:', e);
    process.exit(2);
  }
})();
