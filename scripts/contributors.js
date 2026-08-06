const fs = require('fs');
const path = require('path');
const { requestRestPaginated, USERNAME } = require('./github');
const { avatarImg, renderTable, writeSection, escapeHtml } = require('./utils');

const README = path.join(process.cwd(), 'README.md');

async function gatherOwnerRepos() {
  // repos owned by user
  return await requestRestPaginated(`/users/${USERNAME}/repos`);
}

async function getContributorsForRepo(owner, repo) {
  try {
    return await requestRestPaginated(`/repos/${owner}/${repo}/contributors`);
  } catch (e) {
    console.warn(`Failed contributors for ${owner}/${repo}: ${e.message}`);
    return [];
  }
}

async function buildTopContributors() {
  const repos = await gatherOwnerRepos();
  const map = new Map();
  for (const r of repos) {
    const contributors = await getContributorsForRepo(r.owner.login, r.name);
    for (const c of contributors) {
      if (!c || !c.login) continue;
      const key = c.login;
      const prev = map.get(key) || { login: c.login, avatar_url: c.avatar_url, contributions: 0 };
      prev.contributions += c.contributions || 0;
      map.set(key, prev);
    }
  }
  const arr = Array.from(map.values()).sort((a, b) => b.contributions - a.contributions);
  return arr.slice(0, 40);
}

function cellRendererForContributor(c) {
  return `
    <a href="https://github.com/${escapeHtml(c.login)}" style="text-decoration:none;color:inherit">
      ${avatarImg(c.avatar_url, 88)}<br/>
      <b>${escapeHtml(c.login)}</b><br/>
      <small>${c.contributions} contributions</small>
    </a>
  `;
}

(async function main() {
  try {
    const top = await buildTopContributors();
    const html = renderTable(top, 8, cellRendererForContributor);
    const ok = writeSection(README, 'contributors', html);
    if (!ok) process.exit(0);
    console.log('Updated contributors section');
  } catch (e) {
    console.error('Error building contributors:', e);
    process.exit(2);
  }
})();
