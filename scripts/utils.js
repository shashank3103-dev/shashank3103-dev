const fs = require('fs');

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function avatarImg(url, size = 100) {
  return `<img src="${url}&s=${size}" width="${size}px" style="border-radius:12px;"/>`;
}

function escapeHtml(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function writeSection(readmePath, marker, content) {
  const readme = fs.readFileSync(readmePath, 'utf8');
  const start = `<!--START_SECTION:${marker}-->`;
  const end = `<!--END_SECTION:${marker}-->`;
  const re = new RegExp(`${start}[\s\S]*${end}`);
  if (!re.test(readme)) {
    console.warn(`${marker} markers not found in README`);
    return false;
  }
  const updated = readme.replace(re, `${start}\n${content}\n${end}`);
  fs.writeFileSync(readmePath, updated, 'utf8');
  return true;
}

function renderTable(items, columns = 8, cellRenderer) {
  const rows = chunk(items, columns);
  let html = '<table style="margin:auto"><tbody>';
  rows.forEach((row) => {
    html += '<tr>';
    row.forEach((it) => {
      html += `<td align="center" style="padding:8px">${cellRenderer(it)}</td>`;
    });
    html += '</tr>';
  });
  html += '</tbody></table>';
  return html;
}

function renderCardGrid(cards, columns = 3) {
  const rows = chunk(cards, columns);
  let html = '<div style="display:flex;flex-direction:column;gap:12px">';
  rows.forEach((row) => {
    html += '<div style="display:flex;justify-content:center;gap:12px">';
    row.forEach((card) => {
      html += `<div style="background:var(--color-canvas-default);border-radius:12px;padding:12px;min-width:180px;max-width:320px;box-shadow:0 6px 18px rgba(0,0,0,0.08)">${card}</div>`;
    });
    html += '</div>';
  });
  html += '</div>';
  return html;
}

module.exports = {
  chunk,
  avatarImg,
  escapeHtml,
  writeSection,
  renderTable,
  renderCardGrid,
};
