const fs = require('fs');
const path = require('path');
const { requestRestPaginated, USERNAME } = require('./github');
const { escapeHtml, writeSection } = require('./utils');

const README = path.join(process.cwd(), 'README.md');

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

function renderGrid(items, perRow = 8) {
  let html = '<div style="display:flex;flex-wrap:wrap;gap:12px;justify-content:center;padding:8px;background:transparent">';
  for (const user of items) {
    html += renderFollowerCell(user);
  }
  html += '</div>';
  return html;
}

(async function main() {
  try {
    const followers = await requestRestPaginated(`/users/${USERNAME}/followers`);
    if (!Array.isArray(followers) || followers.length === 0) {
      console.log('No followers found');
      return;
    }

    // newest first - API tends to return newest first, but reverse to be safe
    const sorted = followers.slice().reverse();

    const latest = sorted.slice(0, 120); // limit for performance
    const html = renderGrid(latest, 8);

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
