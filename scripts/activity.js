const fs = require('fs');
const path = require('path');
const { requestRestPaginated, USERNAME } = require('./github');
const { escapeHtml, writeSection } = require('./utils');

const README = path.join(process.cwd(), 'README.md');

function renderEvent(e) {
  const type = e.type;
  const repo = e.repo ? e.repo.name : '';
  const time = new Date(e.created_at).toLocaleString();
  let action = '';
  switch (type) {
    case 'PushEvent':
      action = `pushed to <b>${escapeHtml(repo)}</b>`;
      break;
    case 'PullRequestEvent':
      action = `${escapeHtml(e.payload.action)} pull request on <b>${escapeHtml(repo)}</b>`;
      break;
    case 'IssueCommentEvent':
      action = `commented on issue in <b>${escapeHtml(repo)}</b>`;
      break;
    case 'ReleaseEvent':
      action = `${escapeHtml(e.payload.action)} release on <b>${escapeHtml(repo)}</b>`;
      break;
    case 'CreateEvent':
      action = `created ${escapeHtml(e.payload.ref_type)} <b>${escapeHtml(repo)}</b>`;
      break;
    default:
      action = `${escapeHtml(type)} on <b>${escapeHtml(repo)}</b>`;
  }
  return `<div style="padding:8px;border-radius:8px;border:1px solid rgba(0,0,0,0.06)"><div style="font-size:13px">${action}</div><div style="font-size:12px;color:var(--color-text-secondary)">${time}</div></div>`;
}

(async function main() {
  try {
    const events = await requestRestPaginated(`/users/${USERNAME}/events`);
    const interesting = events.filter((e) => ['PushEvent','PullRequestEvent','IssueCommentEvent','ReleaseEvent','CreateEvent'].includes(e.type));
    const latest = interesting.slice(0, 10).map(renderEvent);
    const html = `<div style="display:flex;flex-direction:column;gap:8px">${latest.join('\n')}</div>`;
    const ok = writeSection(README, 'recent-activity', html);
    if (!ok) process.exit(0);
    console.log('Updated recent-activity section');
  } catch (e) {
    console.error('Error building activity:', e);
    process.exit(2);
  }
})();
