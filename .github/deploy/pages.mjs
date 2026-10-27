#!/usr/bin/env node
// 공개 저장소 deploy.yml 의 Pages 배포 단계(공개 저장소 .github/deploy/pages.mjs 로 복사된다).
// actions/deploy-pages 는 배포 이름(pages_build_version)에 늘 커밋 해시를 쓴다. 2호기는 같은 커밋에서 배포를 거듭 부르므로
// (workflow_dispatch) 이름이 겹친다. 그러면 상태 확인이 예전 배포의 '성공'을 몇 초 만에 돌려주고, 새 배포는 반영되지 않았다
// (2026-10-27 스테이징: 성공 보고 4~5초, 화면은 7분 넘게 그대로). 그래서 같은 Pages API 를 실행(재시도)마다 다른 이름으로 부른다.
// 바깥 패키지 없이 Node 만으로 돈다(Actions 기본 Node).
import { appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const API = 'https://api.github.com';
const FINAL = {
  deployment_failed: '배포에 실패했습니다.',
  deployment_content_failed: '산출물을 배포하지 못했습니다(링크 파일·크기 확인).',
  deployment_cancelled: '배포가 취소됐습니다.',
  deployment_lost: '배포가 마지막 상태를 알리지 않았습니다.',
};

/** 실행·재시도마다 다른 배포 이름 */
export function buildVersion({ GITHUB_SHA: sha = '', GITHUB_RUN_ID: run = '', GITHUB_RUN_ATTEMPT: attempt = '' }) {
  if (!/^[0-9a-f]{40}$/.test(sha) || !/^\d+$/.test(run) || !/^\d+$/.test(attempt)) {
    throw new Error(`배포 이름을 만들 수 없습니다(GITHUB_SHA ${sha} · GITHUB_RUN_ID ${run} · GITHUB_RUN_ATTEMPT ${attempt}).`);
  }
  return `${sha}-${run}-${attempt}`;
}

/** Pages 배포 상태 → 'done' | 'fail' | 'wait'(진행 중·잠깐 오류·모르는 상태) */
export const verdict = (status) => (status === 'succeed' ? 'done' : FINAL[status] ? 'fail' : 'wait');

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function oidcToken(env, fetchFn, sleep) {
  const { ACTIONS_ID_TOKEN_REQUEST_URL: url, ACTIONS_ID_TOKEN_REQUEST_TOKEN: token } = env;
  if (!url || !token) throw new Error('OIDC 토큰을 받을 수 없습니다(deploy.yml permissions 에 id-token: write).');
  let why = '';
  for (let i = 0; i < 3; i += 1) {
    if (i) await sleep(2000);
    try {
      const res = await fetchFn(url, { headers: { authorization: `Bearer ${token}`, accept: 'application/json' } });
      if (res.ok) {
        const { value } = await res.json();
        if (value) return value;
        why = '빈 토큰';
      } else {
        why = `HTTP ${res.status}`;
      }
    } catch (e) {
      why = e.message;
    }
  }
  throw new Error(`OIDC 토큰을 받지 못했습니다(${why}).`);
}

/** 배포를 만들고 끝날 때까지 기다린다 → { pageUrl, version }. 실패·시간 초과면 던진다(시간 초과는 배포도 취소). */
export async function deployPages({ env, fetchFn = fetch, sleep = wait, now = Date.now, log = console.log, intervalMs = 5000, timeoutMs = 8 * 60e3, maxErrors = 10 }) {
  const artifactId = Number(env.ARTIFACT_ID);
  if (!Number.isSafeInteger(artifactId) || artifactId <= 0) throw new Error(`산출물 번호가 없습니다: ${env.ARTIFACT_ID}`);
  if (!/^[\w.-]+\/[\w.-]+$/.test(env.GITHUB_REPOSITORY || '')) throw new Error(`저장소 이름이 틀립니다: ${env.GITHUB_REPOSITORY}`);
  const version = buildVersion(env);
  const base = `${API}/repos/${env.GITHUB_REPOSITORY}/pages/deployments`;
  const api = (url, init = {}) => fetchFn(url, {
    ...init,
    headers: { authorization: `Bearer ${env.GITHUB_TOKEN}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', 'content-type': 'application/json' },
  });

  const idToken = await oidcToken(env, fetchFn, sleep);
  const res = await api(base, { method: 'POST', body: JSON.stringify({ artifact_id: artifactId, pages_build_version: version, oidc_token: idToken }) });
  if (!res.ok) throw new Error(`배포를 만들지 못했습니다(HTTP ${res.status}): ${(await res.text()).slice(0, 300)}`);
  const made = await res.json();
  const statusUrl = String(made.status_url || '').startsWith(`${base}/`) ? made.status_url : `${base}/${encodeURIComponent(made.id || version)}`;
  log(`배포를 만들었습니다: ${version} (id ${made.id})`);

  const cancel = async () => {
    const r = await api(`${statusUrl}/cancel`, { method: 'POST' }).catch(() => null);
    log(r && r.ok ? '배포를 취소했습니다.' : '배포를 취소하지 못했습니다.');
  };
  const start = now();
  let errors = 0;
  let last = '';
  while (now() - start < timeoutMs) {
    await sleep(intervalMs);
    let status = '';
    try {
      const r = await api(statusUrl);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      status = String((await r.json()).status || '');
      errors = 0;
    } catch (e) {
      errors += 1;
      log(`상태를 읽지 못했습니다(${errors}/${maxErrors}): ${e.message}`);
      if (errors >= maxErrors) {
        await cancel();
        throw new Error('배포 상태를 계속 읽지 못해 멈춥니다.');
      }
      continue;
    }
    if (status !== last) log(`상태: ${status}`);
    last = status;
    const v = verdict(status);
    if (v === 'done') return { pageUrl: String(made.page_url || '').replace(/[\r\n]/g, ''), version };
    if (v === 'fail') throw new Error(`${FINAL[status]} (${status})`);
  }
  await cancel();
  throw new Error(`배포가 ${Math.round(timeoutMs / 60e3)}분 안에 끝나지 않았습니다(마지막 상태 ${last || '없음'}).`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { pageUrl } = await deployPages({ env: process.env });
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `page_url=${pageUrl}\n`);
    console.log(`배포했습니다: ${pageUrl}`);
  } catch (e) {
    console.log(`::error::${e.message}`);
    process.exit(1);
  }
}
