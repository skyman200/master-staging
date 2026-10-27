// 공개 데이터 받기. 사이트 맨 위 version.json { shell, data } 이 지금 올라간 화면 버전과 데이터 버전이다.
// - version.json 은 브라우저 캐시 없이 받는다(no-store). GitHub Pages 가 파일마다 '10분 캐시'를 붙이기 때문(f-force-update).
//   Pages 앞단(CDN)은 주소 뒤 ?… 를 보지 않아 그것으로는 못 피한다. 대신 배포가 끝날 때 앞단을 비운다.
// - 데이터 파일 이름에 버전이 들어 있어(data/public.<ts>.json) 한 번 받은 것은 바뀌지 않는다.
import { normalizePublic } from './model.js';

const SAMPLE_BASE = new URL('../sample/', import.meta.url);

/** 이 화면 스크립트의 배포 버전(v/<해시>/assets/). 로컬 개발이면 ''. */
export const BUILD = (/\/v\/([0-9a-f]{12})\/assets\//.exec(import.meta.url) || [])[1] || '';

const EMPTY = Object.freeze({ at: '', profs: Object.freeze([]) });

function docUrl(p) {
  return new URL(p, document.baseURI).href;
}

async function get(url, init, ms) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctl.signal });
  } finally {
    clearTimeout(timer);
  }
}

function cleanVersion(v) {
  return {
    shell: v && /^[0-9a-f]{12}$/.test(v.shell) ? v.shell : '',
    data: v && /^\d{13}$/.test(String(v.data)) ? String(v.data) : '',
  };
}

let early = typeof window !== 'undefined' ? window.__v : null;

/**
 * { shell, data } — 아직 아무것도 올라가지 않았으면(404) 둘 다 ''.
 * 망 문제로 못 받으면 null(빈 목록으로 착각하지 않게).
 */
export async function fetchVersion() {
  if (early) {
    const p = early;
    early = null;
    const v = await p;
    if (v && typeof v === 'object') return cleanVersion(v);
  }
  try {
    const res = await get(docUrl('version.json'), { cache: 'no-store' }, 8000);
    if (res.status === 404) return cleanVersion(null);
    if (!res.ok) return null;
    return cleanVersion(await res.json());
  } catch (e) {
    return null;
  }
}

/** 데이터 버전 ts 의 공개 목록. ts 가 비면(아직 공개된 것 없음) 빈 목록. */
export async function fetchPublic(ts) {
  if (!ts) return EMPTY;
  const res = await get(docUrl(`data/public.${ts}.json`), {}, 20000);
  if (!res.ok) throw new Error(`공개 목록을 받지 못했습니다(${res.status}).`);
  return normalizePublic(await res.json());
}

/** '예시 화면'(#/sample)용 가짜 목록 */
export async function fetchSample() {
  const res = await get(new URL('public.json', SAMPLE_BASE).href, {}, 20000);
  if (!res.ok) throw new Error(`예시 목록을 받지 못했습니다(${res.status}).`);
  return normalizePublic(await res.json());
}

/** 캡처·배지 그림 주소 */
export function assetUrl(mode, path) {
  return mode === 'sample' ? new URL(path, SAMPLE_BASE).href : docUrl(`data/${path}`);
}
