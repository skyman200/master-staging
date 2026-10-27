// 공개 칸반보드(첫 화면). 레벨별 세 열, 맨 위에 레벨별 인원과 전체 앱 수(K1~K4).
import { h, clear, countTo } from './dom.js';
import { LEVELS, levelTitle } from './levels.js';
import { columns, totals, coverShot } from './model.js';
import { morph } from './motion.js';

function num(k, n) {
  return h('b.num', { dataset: { k } }, String(n));
}

function head(t) {
  return h('div.board-head', null,
    h('h1.board-title', null, '교수 ', h('span.accent', null, num('profs', t.profs), '명'), ' · 앱 ', h('span.accent', null, num('apps', t.apps), '개')),
    h('p.board-lead', null, '승인된 앱만 올라옵니다. 카드를 누르면 실제 화면이 넘어갑니다.'),
    h('dl.board-stats', null, LEVELS.map((lv, i) => h('div', null,
      h('dt', null, `Lv.${lv.n}`),
      h('dd', null, num(`lv${lv.n}`, t.byLevel[i]), '명')))));
}

// 열마다 첫 카드 그림은 바로 받는다(첫 화면에 보이는 그림 — 늦게 받으면 첫 화면이 늦게 뜬다). 나머지는 보일 때 받는다.
function card(p, ctx, first) {
  const shot = coverShot(p);
  const img = shot
    ? h('img', { src: ctx.asset(shot.thumb), width: shot.tw, height: shot.th, alt: `${p.name} 교수 앱 화면`, loading: first ? 'eager' : 'lazy', decoding: 'async' })
    : null;
  return h('li', { dataset: { id: p.id } },
    h('a.card', { href: `${ctx.prefix}/p/${p.id}`, dataset: { id: p.id }, onclick: (e) => ctx.open(e, p) },
      h('span.card-shot', null, img),
      h('span.card-text', null,
        h('span.card-name', null, p.name),
        h('span.card-dept', null, p.dept)),
      h('span.card-apps', null, h('b.num', null, String(p.apps.length)), h('span', null, '개 앱'))));
}

function column(lv, list, count, ctx) {
  return h('section.col', { 'aria-labelledby': `col-${lv.n}`, dataset: { level: lv.n } },
    h('header.col-head', null,
      h('h2', { id: `col-${lv.n}` }, h('span.col-lv', null, `Lv.${lv.n}`), ' ', h('span.col-name', null, levelTitle(lv.n))),
      h('p.col-count', null, num(`col${lv.n}`, count), '명')),
    list.length
      ? h('ol.cards', null, list.map((p, i) => card(p, ctx, i === 0)))
      : h('p.col-empty', null, '아직 없습니다. ', h('a', { href: `${ctx.prefix}/register` }, '앱 등록하기')));
}

function board(data, ctx) {
  const t = totals(data.profs);
  const cols = columns(data.profs);
  return h('section.board', { dataset: { view: 'kanban' } },
    head(t),
    h('div.cols', null, LEVELS.map((lv, i) => column(lv, cols[i], t.byLevel[i], ctx))));
}

/** 처음 그리기 */
export function renderKanban(root, data, ctx) {
  clear(root).append(board(data, ctx));
}

const NUMS = '.board-head [data-k], .col-count [data-k]';

function nameCards(scope, on) {
  scope.querySelectorAll('.cards > li').forEach((li) => { li.style.viewTransitionName = on ? `card-${li.dataset.id}` : ''; });
}

/**
 * 열어 둔 화면에서 데이터가 바뀌었을 때: 카드가 새 자리로 움직이고, 빠진 카드는 사라지고,
 * 숫자는 그 자리에서 세어 바뀐다(R12, 모핑).
 */
export function updateKanban(root, data, ctx) {
  const old = root.querySelector('.board');
  if (!old) {
    renderKanban(root, data, ctx);
    return Promise.resolve();
  }
  const before = new Map([...old.querySelectorAll(NUMS)].map((el) => [el.dataset.k, Number(el.textContent)]));
  const next = board(data, ctx);
  const counts = [];
  next.querySelectorAll(NUMS).forEach((el) => {
    if (!before.has(el.dataset.k)) return;
    counts.push([el, Number(el.textContent)]);
    el.textContent = String(before.get(el.dataset.k));
  });
  nameCards(old, true);
  return morph(() => {
    nameCards(old, false);
    old.replaceWith(next);
    nameCards(next, true);
  }).then(() => {
    nameCards(next, false);
    for (const [el, to] of counts) countTo(el, to, ctx.reduced());
  });
}

/** 카드 요소(모핑 출발점) */
export function cardEl(root, id) {
  return root.querySelector(`.card[data-id="${CSS.escape(id)}"]`);
}
