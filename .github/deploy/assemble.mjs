#!/usr/bin/env node
// 공개 저장소 skyman200/master 의 deploy.yml 이 실행한다(공개 저장소 .github/deploy/assemble.mjs 로 복사된다).
//   prepare : 화면(index.html·fonts·v/) + 가장 최근 공개 데이터(초안 릴리스 data-<ts> 의 data.tar)를 _site/ 에 모은다.
//   cleanup <ts> : 배포한 것보다 오래된 초안 릴리스만 지운다(지금 것은 남겨 다음 화면 배포가 다시 쓴다).
// 규칙(B1, A-17): data.tar 가 붙은 초안 가운데 가장 새것을 쓴다. 지금 사이트의 데이터보다 오래된 것은 절대 올리지 않는다.
// 바깥 패키지 없이 Node 만으로 돈다(Actions 기본 Node).
import { execFileSync } from 'node:child_process';
import { appendFileSync, cpSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const TAG_RE = /^data-(\d{13})$/;
export const ENTRY_RE = /^(public\.\d{13}\.json|shots\/[A-Za-z0-9][A-Za-z0-9._-]{0,120}\.webp|badges\/[A-Za-z0-9][A-Za-z0-9._-]{0,120}\.png|shots\/|badges\/)$/;

/** 초안 릴리스의 데이터 버전(13자리) — 초안이 아니거나 이름이 틀리면 '' */
export function draftTs(rel) {
  if (!rel || rel.draft !== true) return '';
  const m = TAG_RE.exec(rel.tag_name || '');
  return m ? m[1] : '';
}

function dataAsset(rel) {
  return (rel.assets || []).find((a) => a.name === 'data.tar' && a.state !== 'starter') || null;
}

/**
 * releases: GitHub 릴리스 목록, liveTs: 지금 사이트의 데이터 버전('' = 아직 없음, null = 모름)
 * → { ts, release, asset } | { ts: '' } (빈 데이터로 배포) | { error }
 */
export function pickDraft(releases, liveTs) {
  const cands = releases
    .map((r) => ({ release: r, ts: draftTs(r), asset: dataAsset(r) }))
    .filter((c) => c.ts && c.asset)
    .sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0));
  const best = cands[0];
  if (!best) {
    if (liveTs) return { error: `공개 데이터 초안이 없습니다(지금 사이트 데이터 ${liveTs}). 빈 화면으로 덮지 않습니다.` };
    return { ts: '' };
  }
  if (liveTs && best.ts < liveTs) return { error: `가장 새 초안(${best.ts})이 지금 사이트 데이터(${liveTs})보다 오래됐습니다.` };
  return best;
}

/** 배포한 데이터보다 오래된 초안만(지울 것) */
export function staleDrafts(releases, ts) {
  if (!TAG_RE.test(`data-${ts}`)) return [];
  return releases.filter((r) => {
    const t = draftTs(r);
    return t && t < ts;
  });
}

/** tar -tvf 출력 → 문제 있으면 이유, 없으면 '' (보통 파일·폴더만, 정해진 이름만) */
export function checkListing(listing) {
  for (const line of listing.split('\n').filter(Boolean)) {
    const type = line[0];
    const name = line.trim().split(/\s+/).slice(5).join(' ').replace(/^\.\//, '');
    if (type !== '-' && type !== 'd') return `파일이 아닌 것이 들어 있습니다: ${line}`;
    if (!name) continue;
    if (!ENTRY_RE.test(name)) return `정해지지 않은 이름입니다: ${name}`;
  }
  return '';
}

const API = 'https://api.github.com';

async function gh(path, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${process.env.GITHUB_TOKEN}`, 'x-github-api-version': '2022-11-28', accept: 'application/vnd.github+json', ...(init.headers || {}) },
  });
  if (!res.ok && res.status !== 404) throw new Error(`GitHub ${init.method || 'GET'} ${path} → ${res.status}`);
  return res;
}

async function listReleases(repo, wantId) {
  for (let i = 0; i < 3; i += 1) {
    const list = await (await gh(`/repos/${repo}/releases?per_page=100`)).json();
    if (!wantId || list.some((r) => String(r.id) === String(wantId))) return list;
    const one = await gh(`/repos/${repo}/releases/${wantId}`);
    if (one.ok) return [...list, await one.json()];
    await new Promise((r) => setTimeout(r, 5000));
  }
  return (await gh(`/repos/${repo}/releases?per_page=100`)).json();
}

async function liveDataTs(repo) {
  const [owner, name] = repo.split('/');
  try {
    const res = await fetch(`https://${owner}.github.io/${name}/version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (res.status === 404) return '';
    if (!res.ok) return null;
    const v = await res.json();
    return /^\d{13}$/.test(String(v.data)) ? String(v.data) : '';
  } catch (e) {
    return null;
  }
}

function walkFiles(dir, base = '') {
  return readdirSync(join(dir, base)).flatMap((n) => {
    const rel = base ? `${base}/${n}` : n;
    const st = lstatSync(join(dir, rel));
    if (st.isSymbolicLink()) throw new Error(`링크 파일은 받지 않습니다: ${rel}`);
    return st.isDirectory() ? walkFiles(dir, rel) : [rel];
  });
}

async function prepare() {
  const repo = process.env.GITHUB_REPOSITORY;
  const builds = JSON.parse(readFileSync('v/builds.json', 'utf8'));
  const shell = builds[0] && builds[0].id;
  if (!/^[0-9a-f]{12}$/.test(shell || '') || !existsSync(`v/${shell}/assets/app.js`)) throw new Error('v/builds.json 의 최신 화면을 찾지 못했습니다.');
  if (!readFileSync('index.html', 'utf8').includes(`v/${shell}/assets/app.js`)) throw new Error('index.html 이 최신 화면을 부르지 않습니다.');

  const picked = pickDraft(await listReleases(repo, process.env.RELEASE_ID || ''), await liveDataTs(repo));
  if (picked.error) throw new Error(picked.error);

  rmSync('_site', { recursive: true, force: true });
  mkdirSync('_site/v', { recursive: true });
  for (const f of ['index.html', '.nojekyll']) cpSync(f, `_site/${f}`);
  cpSync('fonts', '_site/fonts', { recursive: true });
  cpSync('v/builds.json', '_site/v/builds.json');
  for (const b of builds) if (existsSync(`v/${b.id}`)) cpSync(`v/${b.id}`, `_site/v/${b.id}`, { recursive: true });

  if (picked.ts) {
    const res = await gh(`/repos/${repo}/releases/assets/${picked.asset.id}`, { headers: { accept: 'application/octet-stream' } });
    if (!res.ok) throw new Error(`data.tar 를 받지 못했습니다(${res.status}).`);
    writeFileSync('data.tar', Buffer.from(await res.arrayBuffer()));
    const bad = checkListing(execFileSync('tar', ['-tvf', 'data.tar'], { encoding: 'utf8' }));
    if (bad) throw new Error(bad);
    mkdirSync('_site/data', { recursive: true });
    execFileSync('tar', ['-xf', 'data.tar', '-C', '_site/data', '--no-same-owner', '--no-same-permissions']);
    rmSync('data.tar');
    walkFiles('_site/data');
    if (!existsSync(`_site/data/public.${picked.ts}.json`)) throw new Error(`data.tar 에 public.${picked.ts}.json 이 없습니다.`);
  }
  writeFileSync('_site/version.json', JSON.stringify({ shell, data: picked.ts }));
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `ts=${picked.ts}\nshell=${shell}\n`);
  console.log(`모았습니다: 화면 ${shell}, 데이터 ${picked.ts || '(없음)'}`);
}

async function cleanup(ts) {
  const repo = process.env.GITHUB_REPOSITORY;
  if (!ts) return console.log('데이터가 없어 지울 초안이 없습니다.');
  const old = staleDrafts(await (await gh(`/repos/${repo}/releases?per_page=100`)).json(), ts);
  for (const r of old) await gh(`/repos/${repo}/releases/${r.id}`, { method: 'DELETE' });
  console.log(`오래된 초안 ${old.length}개를 지웠습니다.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, arg] = process.argv.slice(2);
  if (cmd === 'prepare') await prepare();
  else if (cmd === 'cleanup') await cleanup(arg || '');
  else throw new Error(`사용: node assemble.mjs prepare | cleanup <ts> (받은 것: ${cmd})`);
}
