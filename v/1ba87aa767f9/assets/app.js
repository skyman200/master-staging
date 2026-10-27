// 화면 시작점: 주소(#/…)에 따라 칸반·쇼케이스·배지·등록·확인 화면을 그린다.
// #/sample/… 은 같은 화면을 가짜 데이터로 보여 주는 '예시 화면'이다(정식 오픈 때 지운다).
import { h, clear } from './dom.js';
import { fetchVersion, fetchPublic, fetchSample, assetUrl } from './data.js';
import { findProf } from './model.js';
import { reducedMotion, morph } from './motion.js';
import { renderKanban, updateKanban, cardEl } from './kanban.js';
import { createShowcase } from './showcase.js';
import { renderBadge } from './badge.js';
import { renderRegister, formBusy } from './form.js';
import { renderConfirm } from './confirm.js';
import { startUpdates } from './update.js';

window.__app = true;

const SITE = 'DIT AI 3-LEVEL 인증 · 앱 제작 실적';
const view = document.getElementById('view');
const layer = document.getElementById('layer');
const live = { ts: '', data: null, error: null };
const sample = { data: null };
let shown = { key: '' };
let lastInput = 0;

function parse(hash) {
  let path = (hash || '').replace(/^#\/?/, '');
  let mode = 'live';
  if (path === 'sample' || path.startsWith('sample/')) {
    mode = 'sample';
    path = path.slice('sample'.length).replace(/^\//, '');
  }
  const [a = '', b = ''] = path.split('/');
  const id = decodeURIComponent(b);
  if (a === 'p' && id) return { mode, page: 'kanban', prof: id };
  if (a === 'badge' && id) return { mode, page: 'badge', prof: id };
  if (a === 'register') return { mode, page: 'register' };
  if (a === 'confirm' && mode === 'live') return { mode, page: 'confirm', token: id };
  return { mode, page: 'kanban' };
}

function context(mode) {
  return {
    mode,
    prefix: mode === 'sample' ? '#/sample' : '#',
    asset: (p) => assetUrl(mode, p),
    reduced: reducedMotion,
    open: openCard,
    close: closeShowcase,
    route,
  };
}

// 휴대폰 너비면 쇼케이스가 휴대폰 화면을 넘긴다. 화면을 돌려 너비가 바뀌면 열린 쇼케이스를 그 앱 자리에서 다시 그린다.
const narrow = matchMedia('(max-width: 599px)');
const showcase = createShowcase(layer, {
  get prefix() { return currentMode() === 'sample' ? '#/sample' : '#'; },
  asset: (p) => assetUrl(currentMode(), p),
  narrow: () => narrow.matches,
  reduced: reducedMotion,
  close: closeShowcase,
});
narrow.addEventListener('change', () => {
  if (!showcase.open) return;
  dataFor(currentMode()).then((d) => {
    const p = findProf(d, showcase.id);
    if (p) showcase.refresh(p);
  }, () => {});
});

function currentMode() {
  return parse(location.hash).mode;
}

function chrome(mode) {
  const prefix = mode === 'sample' ? '#/sample' : '#';
  document.querySelector('.top-home').setAttribute('href', `${prefix}/`);
  document.querySelector('.top-reg').setAttribute('href', `${prefix}/register`);
  document.querySelector('.sample-note').hidden = mode !== 'sample';
}

async function dataFor(mode) {
  if (mode === 'sample') {
    if (!sample.data) sample.data = await fetchSample();
    return sample.data;
  }
  if (live.data) return live.data;
  throw live.error || new Error('목록을 아직 받지 못했습니다.');
}

function failed(err, mode) {
  clear(view).append(h('section.page', { dataset: { view: 'error' } },
    h('h1.page-title', null, '목록을 불러오지 못했습니다'),
    h('p.page-lead', null, err.message),
    h('p', null, h('button.btn', { type: 'button', onclick: () => { if (mode === 'live') loadLive().then(route); else route(); } }, '다시 불러오기'))));
  shown = { key: 'error' };
}

function openCard(e, p) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  e.preventDefault();
  const mode = currentMode();
  history.pushState({ sc: true }, '', `${mode === 'sample' ? '#/sample' : '#'}/p/${p.id}`);
  document.title = `${p.name} 교수 앱 · ${SITE}`;
  showcase.show(p, e.currentTarget);
}

function closeShowcase() {
  if (history.state && history.state.sc) {
    history.back();
    return;
  }
  history.replaceState(null, '', `${currentMode() === 'sample' ? '#/sample' : '#'}/`);
  route();
}

async function route() {
  const r = parse(location.hash);
  const ctx = context(r.mode);
  chrome(r.mode);
  if (r.page === 'register' || r.page === 'confirm') {
    await showcase.hide(true);
    await morph(() => {
      if (r.page === 'register') renderRegister(view, ctx);
      else renderConfirm(view, r.token, ctx);
    });
    shown = { key: `${r.mode}:${r.page}` };
    document.title = `${r.page === 'register' ? '앱 등록하기' : '메일 확인'} · ${SITE}`;
    window.scrollTo(0, 0);
    return;
  }
  let data;
  try {
    data = await dataFor(r.mode);
  } catch (err) {
    await showcase.hide(true);
    failed(err, r.mode);
    return;
  }
  if (r.page === 'badge') {
    await showcase.hide(true);
    await morph(() => renderBadge(view, findProf(data, r.prof), ctx));
    shown = { key: `${r.mode}:badge:${r.prof}` };
    document.title = `배지 확인 · ${SITE}`;
    window.scrollTo(0, 0);
    return;
  }
  const kanbanKey = `${r.mode}:kanban`;
  if (shown.key !== kanbanKey) {
    await showcase.hide(true);
    await morph(() => renderKanban(view, data, ctx));
    shown = { key: kanbanKey };
  }
  const p = r.prof ? findProf(data, r.prof) : null;
  if (p) {
    document.title = `${p.name} 교수 앱 · ${SITE}`;
    if (showcase.id !== p.id) await showcase.show(p, showcase.open ? null : cardEl(view, p.id));
    return;
  }
  document.title = SITE;
  if (r.prof) history.replaceState(null, '', `${ctx.prefix}/`);
  if (showcase.open) await showcase.hide(false, cardEl(view, showcase.id));
}

async function loadLive(v) {
  try {
    const version = v === undefined ? await fetchVersion() : v;
    if (!version) throw new Error('인터넷 연결을 확인한 뒤 다시 불러와 주세요.');
    live.data = await fetchPublic(version.data);
    live.ts = version.data;
    live.error = null;
  } catch (err) {
    live.error = err;
  }
}

/** 새 데이터가 올라왔을 때: 열어 둔 화면을 그 자리에서 바꾼다(빠진 교수는 칸반·쇼케이스·배지에서 사라진다) */
async function onData(ts) {
  const data = await fetchPublic(ts);
  live.data = data;
  live.ts = ts;
  live.error = null;
  const r = parse(location.hash);
  if (r.mode !== 'live') return;
  const ctx = context('live');
  if (shown.key === 'live:kanban') {
    await updateKanban(view, data, ctx);
    if (showcase.open) {
      const p = findProf(data, showcase.id);
      if (p) showcase.refresh(p);
      else {
        history.replaceState(null, '', '#/');
        await showcase.hide(false, null);
        document.title = SITE;
      }
    }
  } else if (shown.key.startsWith('live:badge:') || shown.key === 'error') {
    route();
  }
}

async function boot() {
  document.addEventListener('input', () => { lastInput = Date.now(); }, true);
  window.addEventListener('hashchange', route);
  const first = await fetchVersion();
  if (parse(location.hash).mode === 'live' || first) await loadLive(first);
  // 화면을 그리기 전에 확인을 켠다: 캐시된 옛 화면이면 그리기 전에 바로 새 화면으로 간다
  startUpdates({
    initial: first,
    getData: () => live.ts,
    onData,
    busy: () => formBusy() || Date.now() - lastInput < 1500,
  });
  await route();
}

boot();
