const fs = require('fs');
const { URL } = require('url');

const BASE_REST = 'https://api.github.com';
const BASE_GRAPHQL = 'https://api.github.com/graphql';
const TOKEN = process.env.GITHUB_TOKEN || process.env.TOKEN || process.env.GH_TOKEN;
// support both GITHUB_USERNAME and USERNAME for env var naming
const USERNAME = process.env.GITHUB_USERNAME || process.env.USERNAME || process.env.GH_USERNAME;

if (!TOKEN) {
  console.error('GITHUB_TOKEN (or TOKEN/GH_TOKEN) is required in env');
  process.exit(1);
}
if (!USERNAME) {
  console.error('GITHUB_USERNAME or USERNAME (or GH_USERNAME) is required in env');
  process.exit(1);
}

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

async function requestRest(path, opts = {}) {
  const url = new URL(path, BASE_REST).toString();
  const headers = Object.assign(
    {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${TOKEN}`,
      'User-Agent': USERNAME,
    },
    opts.headers || {}
  );

  const method = opts.method || 'GET';
  const body = opts.body ? JSON.stringify(opts.body) : undefined;

  const maxRetries = 4;
  let attempt = 0;
  while (true) {
    attempt++;
    try {
      const res = await fetch(url, { method, headers, body });
      const remaining = res.headers.get('x-ratelimit-remaining');
      const reset = res.headers.get('x-ratelimit-reset');

      if (res.status === 202) {
        // accepted but processing
        await sleep(1000 * attempt);
        continue;
      }

      if (res.status === 403 && remaining === '0' && reset) {
        const waitMs = Math.max(0, (Number(reset) * 1000 - Date.now()) + 5000);
        console.warn(`Rate limited. Waiting ${Math.round(waitMs/1000)}s`);
        await sleep(waitMs);
        continue;
      }

      if (res.status >= 500 && attempt <= maxRetries) {
        await sleep(500 * attempt);
        continue;
      }

      const text = await res.text();
      let json;
      try {
        json = text ? JSON.parse(text) : null;
      } catch (e) {
        throw new Error(`Invalid JSON from ${url}: ${text}`);
      }

      if (!res.ok) {
        const message = (json && json.message) || `HTTP ${res.status}`;
        const err = new Error(message);
        err.status = res.status;
        err.body = json;
        throw err;
      }

      return { data: json, headers: res.headers };
    } catch (err) {
      if (attempt > maxRetries) throw err;
      const backoff = 200 * attempt;
      await sleep(backoff);
    }
  }
}

async function requestRestPaginated(path, per_page = 100) {
  let page = 1;
  let results = [];
  while (true) {
    const url = `${path}${path.includes('?') ? '&' : '?'}per_page=${per_page}&page=${page}`;
    const { data, headers } = await requestRest(url);
    if (!Array.isArray(data)) return data; // not a list
    results = results.concat(data);
    const link = headers.get('link');
    if (!link || !link.includes('rel="next"')) break;
    page++;
  }
  return results;
}

async function requestGraphQL(query, variables = {}) {
  const headers = {
    Authorization: `Bearer ${TOKEN}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': USERNAME,
    'Content-Type': 'application/json',
  };

  const maxRetries = 4;
  let attempt = 0;
  while (true) {
    attempt++;
    const res = await fetch(BASE_GRAPHQL, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, variables }),
    });

    if (res.status === 502 && attempt <= maxRetries) {
      await sleep(200 * attempt);
      continue;
    }

    const json = await res.json();
    if (json.errors) {
      const isRate = json.errors.some((e) => (e.type || '').toLowerCase().includes('rate'));
      if (isRate && attempt <= maxRetries) {
        await sleep(1000 * attempt);
        continue;
      }
      const err = new Error('GraphQL errors: ' + JSON.stringify(json.errors));
      err.errors = json.errors;
      throw err;
    }
    return json.data;
  }
}

module.exports = {
  requestRest,
  requestRestPaginated,
  requestGraphQL,
  USERNAME,
};
