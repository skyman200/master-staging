// 공개 데이터(data/public.<ts>.json) 읽기와 순서 규칙. 화면은 이 함수들이 돌려준 값만 쓴다.
// - 알려진 칸만 옮겨 담는다(허용 목록). 이메일 칸은 없고, 글 속 이메일 모양도 지운다(f-identity-email, K7).
// - 교수 레벨은 승인된 앱 가운데 가장 높은 레벨로 다시 계산한다(파일에 적힌 값을 믿지 않는다).
import { LEVELS } from './levels.js';

const ID_RE = /^[A-Za-z0-9_-]{4,40}$/;
const PATH_RE = /^(?!.*\.\.)[A-Za-z0-9][A-Za-z0-9/_.-]{0,200}$/;
const EMAIL_RE = /[^\s@<>()]+@[^\s@<>()]+\.[A-Za-z]{2,}/g;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function text(v, max) {
  if (typeof v !== 'string') return '';
  return v.replace(EMAIL_RE, '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function httpUrl(v) {
  if (typeof v !== 'string' || v.length > 2000) return '';
  try {
    const u = new URL(v);
    if ((u.protocol !== 'https:' && u.protocol !== 'http:') || u.username || u.password) return '';
    return u.href;
  } catch (e) {
    return '';
  }
}

function githubUrl(v) {
  const u = httpUrl(v);
  return u && /^https?:\/\/(www\.)?github\.com\/[^/]+/.test(u) ? u : '';
}

function path(v) {
  return typeof v === 'string' && PATH_RE.test(v) ? v : '';
}

function size(v) {
  return Number.isInteger(v) && v > 0 && v <= 20000 ? v : 0;
}

function time(v) {
  const t = typeof v === 'string' ? Date.parse(v) : NaN;
  return Number.isFinite(t) ? new Date(t).toISOString() : '';
}

function shot(s) {
  if (!s || typeof s !== 'object') return null;
  const src = path(s.src);
  const w = size(s.w);
  const h = size(s.h);
  if (!src || !w || !h) return null;
  const thumb = path(s.thumb);
  const tw = size(s.tw);
  const th = size(s.th);
  return thumb && tw && th ? { src, w, h, thumb, tw, th } : { src, w, h, thumb: src, tw: w, th: h };
}

function app(a) {
  if (!a || typeof a !== 'object' || !ID_RE.test(a.id || '')) return null;
  const level = a.level;
  const name = text(a.name, 60);
  const url = httpUrl(a.url);
  const at = time(a.at);
  if (!LEVELS[level - 1] || !name || !url || !at) return null;
  const out = { id: a.id, name, url, level, desc: text(a.desc, 100), at, shots: [] };
  const gh = githubUrl(a.github);
  if (gh) out.github = gh;
  if (Array.isArray(a.shots)) out.shots = a.shots.map(shot).filter(Boolean).slice(0, 12);
  return out;
}

function prof(p) {
  if (!p || typeof p !== 'object' || !ID_RE.test(p.id || '')) return null;
  const name = text(p.name, 40);
  const apps = Array.isArray(p.apps) ? orderApps(p.apps.map(app).filter(Boolean)) : [];
  if (!name || !apps.length) return null;
  const level = Math.max(...apps.map((a) => a.level));
  const reached = apps.filter((a) => a.level === level).map((a) => a.at).sort()[0];
  const b = p.badge && typeof p.badge === 'object' ? p.badge : {};
  return {
    id: p.id,
    name,
    dept: text(p.dept, 40),
    level,
    apps,
    badge: { img: path(b.img), date: DATE_RE.test(b.date || '') ? b.date : kstDate(reached) },
  };
}

/** 받은 JSON → 화면용 데이터. 모양이 틀린 교수·앱은 빼고, 같은 id가 두 번 나오면 앞의 것만 쓴다. */
export function normalizePublic(json) {
  const list = json && typeof json === 'object' && Array.isArray(json.profs) ? json.profs : [];
  const seen = new Set();
  const profs = [];
  for (const raw of list) {
    const p = prof(raw);
    if (p && !seen.has(p.id)) {
      seen.add(p.id);
      profs.push(p);
    }
  }
  return { at: time(json && json.at), profs };
}

/** '2026-10-26' (한국 시각 기준 날짜) */
export function kstDate(iso) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  return new Date(t + 9 * 3600e3).toISOString().slice(0, 10);
}

/** '2026년 10월 26일' */
export function kstDateLong(day) {
  const m = DATE_RE.test(day || '') ? day.split('-') : null;
  return m ? `${Number(m[0])}년 ${Number(m[1])}월 ${Number(m[2])}일` : '';
}

function latest(p) {
  return p.apps.reduce((m, a) => (a.at > m ? a.at : m), '');
}

function byName(a, b) {
  return a.name.localeCompare(b.name, 'ko') || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

/** 앱 순서: 레벨 높은 순, 같은 레벨이면 최근 승인 순(S3). */
export function orderApps(apps) {
  return [...apps].sort((a, b) => b.level - a.level || (a.at < b.at ? 1 : a.at > b.at ? -1 : 0) || byName(a, b));
}

/** 세 열 [Lv.1, Lv.2, Lv.3]. 열 안에서는 앱이 많은 교수가 앞, 같으면 최근 승인 순(K3). */
export function columns(profs) {
  const cols = LEVELS.map(() => []);
  for (const p of profs) cols[p.level - 1].push(p);
  return cols.map((c) => c.sort((a, b) => b.apps.length - a.apps.length
    || (latest(a) < latest(b) ? 1 : latest(a) > latest(b) ? -1 : 0) || byName(a, b)));
}

/** 맨 위 숫자: 레벨별 인원, 전체 교수 수, 전체 앱 수(K2). */
export function totals(profs) {
  const byLevel = LEVELS.map((lv) => profs.filter((p) => p.level === lv.n).length);
  return { byLevel, profs: profs.length, apps: profs.reduce((n, p) => n + p.apps.length, 0) };
}

/** 쇼케이스 장면: 앱 순서대로 그 앱의 화면 한 장씩. 화면이 없는 앱은 글자만 있는 장면 하나. */
export function slides(p) {
  const out = [];
  p.apps.forEach((a, ai) => {
    if (!a.shots.length) out.push({ app: a, appIndex: ai, shot: null });
    a.shots.forEach((s) => out.push({ app: a, appIndex: ai, shot: s }));
  });
  return out;
}

/** 카드 대표 화면: 맨 앞 앱의 첫 화면. */
export function coverShot(p) {
  const a = p.apps.find((x) => x.shots.length);
  return a ? a.shots[0] : null;
}

export function findProf(data, id) {
  return data.profs.find((p) => p.id === id) || null;
}
