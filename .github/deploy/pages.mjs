// 일회용 진단: 어떤 pages_build_version 을 Pages API 가 받는지 본다(받은 것으로 배포까지).
import { appendFileSync } from 'node:fs';
const env = process.env;
const repo = env.GITHUB_REPOSITORY;
const API = 'https://api.github.com';
const H = { authorization: `Bearer ${env.GITHUB_TOKEN}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', 'content-type': 'application/json' };
const api = (p, init = {}) => fetch(p.startsWith('https://') ? p : `${API}${p}`, { ...init, headers: H });
const tokRes = await fetch(env.ACTIONS_ID_TOKEN_REQUEST_URL, { headers: { authorization: `Bearer ${env.ACTIONS_ID_TOKEN_REQUEST_TOKEN}`, accept: 'application/json' } });
console.log('oidc', tokRes.status);
const { value: oidc } = await tokRes.json();
const head = await (await api(`/repos/${repo}/git/commits/${env.GITHUB_SHA}`)).json();
const mk = await api(`/repos/${repo}/git/commits`, { method: 'POST', body: JSON.stringify({ message: `Pages 배포 ${env.GITHUB_RUN_ID}-${env.GITHUB_RUN_ATTEMPT}`, tree: head.tree.sha, parents: [env.GITHUB_SHA] }) });
const fresh = mk.ok ? (await mk.json()).sha : '';
console.log('fresh commit', mk.status, fresh);
const tries = [['suffix', `${env.GITHUB_SHA}-${env.GITHUB_RUN_ID}-${env.GITHUB_RUN_ATTEMPT}`], ['dangling', fresh], ['head', env.GITHUB_SHA]];
let made = null;
for (const [label, v] of tries) {
  if (!v) continue;
  const r = await api(`/repos/${repo}/pages/deployments`, { method: 'POST', body: JSON.stringify({ artifact_id: Number(env.ARTIFACT_ID), pages_build_version: v, oidc_token: oidc }) });
  const body = await r.text();
  console.log('create', label, v, r.status, body.slice(0, 400));
  if (r.ok) { made = JSON.parse(body); break; }
}
if (!made) process.exit(1);
const t0 = Date.now();
for (let i = 0; i < 90; i += 1) {
  await new Promise((r) => setTimeout(r, 3000));
  const s = await api(made.status_url);
  const j = await s.json().catch(() => ({}));
  console.log(`+${((Date.now() - t0) / 1000).toFixed(1)}s`, s.status, j.status);
  if (j.status === 'succeed' || /failed|cancelled|lost/.test(j.status || '')) break;
}
if (env.GITHUB_OUTPUT) appendFileSync(env.GITHUB_OUTPUT, `page_url=${made.page_url || ''}\n`);
