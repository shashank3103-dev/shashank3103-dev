const fs = require('fs');
const path = require('path');
const { escapeHtml, writeSection } = require('./utils');

const README = path.join(process.cwd(), 'README.md');
const USERNAME = process.env.GITHUB_USERNAME;
const TOKEN = process.env.GITHUB_TOKEN;

if (!USERNAME) {
  console.error('GITHUB_USERNAME is required in env');
  process.exit(1);
}

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

async function fetchFollowers(username, token) {
  let results = [];
  let url = `https://api.github.com/users/${username}/followers?per_page=100`;
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': username,
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  while (url) {
    const res = await fetch(url, { headers });
    if (res.status === 403) {
      const reset = res.headers.get('x-ratelimit-reset');
      if (reset) {
        const waitMs = Math.max(1000, Number(reset) * 1000 - Date.now() + 5000);
        console.warn(`Rate limited, sleeping ${Math.round(waitMs / 1000)}s`);
        await sleep(waitMs);
        continue;
      }
    }

    if (res.status >= 500) {
      await sleep(500);
      continue;
    }

    const data = await res.json();
    if (!Array.isArray(data)) return results;
    results = results.concat(data);

    const link = res.headers.get('link');
    if (link) {
      const match = link.match(/<([^>]+)>; rel="next"/);
      if (match && match[1]) url = match[1];
      else url = null;
    } else {
      url = null;
    }
  }
  return results;
}

function renderFollowerCell(user) {
  const login = escapeHtml(user.login);
  const avatar = escapeHtml(user.avatar_url);
  return `
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
  `;
}

function renderGrid(items) {
  let html = '<div style="display:flex;flex-wrap:wrap;gap:12px;justify-content:center;padding:8px;background:transparent">';
  for (const user of items) {
    html += renderFollowerCell(user);
  }
  html += '</div>';
  return html;
}

(async function main() {
  try {
    const followers = await fetchFollowers(USERNAME, TOKEN);
    if (!Array.isArray(followers) || followers.length === 0) {
      console.log('No followers found');
      return;
    }

    // API returns oldest first for this endpoint; reverse to show newest first
    const newestFirst = followers.slice().reverse();
    const limited = newestFirst.slice(0, 120);
    const html = renderGrid(limited);

    const ok = writeSection(README, 'followers', html);
    if (!ok) {
      console.error('README markers for followers not found; ensure <!--START_SECTION:followers--> exists');
      process.exit(1);
    }

    console.log('Followers section updated');
  } catch (e) {
    console.error('Error updating followers:', e);
    process.exit(2);
  }
})();
