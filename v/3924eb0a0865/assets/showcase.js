// 쇼케이스: 카드가 화면 가득 커지며 열리고(모핑), 실제 화면이 4초마다 넘어간다.
// 누르거나 밀거나 화살표 키를 쓰면 자동 넘김을 멈추고 손으로 넘긴다. 동작 줄이기면 움직임·자동 넘김 없이 연다(S1~S4).
import { h, clear } from './dom.js';
import { levelTitle } from './levels.js';
import { slides } from './model.js';
import { morph, ready } from './motion.js';
import { swipe } from './swipe.js';

const AUTO_MS = 4000;

export function createShowcase(host, ctx) {
  let state = null;

  function level(n) {
    return [h('span.accent', null, `Lv.${n}`), ' ', levelTitle(n)];
  }

  function build(p) {
    const list = slides(p);
    const track = h('div.sc-track', null, list.map((s, i) => h('figure.sc-slide', { dataset: { i } },
      s.shot
        ? h('img', { 'data-src': ctx.asset(s.shot.src), width: s.shot.w, height: s.shot.h, alt: `${s.app.name} 화면 ${i + 1}`, decoding: 'async', draggable: 'false' })
        : h('p.sc-noshot', null, s.app.name))));
    const stage = h('div.sc-stage', { 'aria-roledescription': '화면 넘기기' }, track);
    // 무대 높이는 가장 긴 화면에 맞춘다(넘길 때 아래 글이 흔들리지 않게). 화면이 없으면 낮은 무대.
    const ratio = Math.max(0.4, ...list.map((s) => (s.shot ? s.shot.h / s.shot.w : 0.4)));
    stage.style.setProperty('--r', ratio.toFixed(4));
    const count = h('p.sc-count', null, h('b.num', null, '1'), ` / ${list.length}`);
    const info = h('div.sc-info', { 'aria-live': 'polite' });
    const prev = h('button.sc-step', { type: 'button', onclick: () => manual(-1) }, '이전');
    const next = h('button.sc-step', { type: 'button', onclick: () => manual(1) }, '다음');
    const apps = h('nav.sc-apps', { 'aria-label': '앱 목록' }, p.apps.map((a, ai) => h('button', {
      type: 'button',
      dataset: { ai },
      onclick: () => { pause(); go(list.findIndex((s) => s.appIndex === ai)); },
    }, a.name)));
    const close = h('a.sc-close', { href: `${ctx.prefix}/`, onclick: (e) => { e.preventDefault(); ctx.close(); } }, '닫기');
    const root = h('div.sc', { role: 'dialog', 'aria-modal': 'true', 'aria-label': `${p.name} 교수 앱`, tabindex: '-1', dataset: { id: p.id } },
      h('div.sc-top', null, h('a.sc-badgelink', { href: `${ctx.prefix}/badge/${p.id}` }, '배지 확인'), close),
      h('header.sc-head', null,
        h('h1.sc-name', null, p.name),
        h('p.sc-meta', null, p.dept, ' · ', level(p.level), ' · 앱 ', h('b.num', null, String(p.apps.length)), '개')),
      h('div.sc-body', null, stage, h('div.sc-side', null, count, info, h('div.sc-steps', null, prev, next))),
      p.apps.length > 1 ? apps : null);
    return { root, list, track, stage, count, info, apps, prof: p };
  }

  function renderInfo(s) {
    const a = s.app;
    clear(state.info).append(
      h('h2.sc-app', null, a.name),
      h('p.sc-level', null, level(a.level)),
      a.desc ? h('p.sc-desc', null, a.desc) : null,
      h('p.sc-actions', null,
        h('a.btn', { href: a.url, target: '_blank', rel: 'noopener' }, '앱 열기'),
        a.github ? h('a.sc-gh', { href: a.github, target: '_blank', rel: 'noopener' }, 'GitHub 코드') : null));
    state.apps.querySelectorAll('button').forEach((b) => b.toggleAttribute('aria-current', Number(b.dataset.ai) === s.appIndex));
  }

  function load(i) {
    const img = state.track.children[i] && state.track.children[i].querySelector('img[data-src]');
    if (img) {
      img.src = img.dataset.src;
      img.removeAttribute('data-src');
    }
  }

  function go(i, opts = {}) {
    const n = state.list.length;
    const to = ((i % n) + n) % n;
    const appChanged = !opts.first && state.list[to].appIndex !== state.list[state.index].appIndex;
    state.index = to;
    [to - 1, to, to + 1].forEach((k) => load(((k % n) + n) % n));
    state.track.style.transform = `translateX(${-100 * to}%)`;
    state.count.firstChild.textContent = String(to + 1);
    if (opts.first || appChanged) {
      renderInfo(state.list[to]);
      if (appChanged && !ctx.reduced() && state.info.animate) {
        state.info.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: 'ease-out' });
      }
    }
  }

  function pause() {
    if (!state) return;
    state.paused = true;
    clearInterval(state.timer);
    state.timer = 0;
    state.root.classList.add('is-manual');
  }

  function manual(step) {
    pause();
    go(state.index + step);
  }

  function auto() {
    clearInterval(state.timer);
    state.timer = 0;
    if (state.paused || ctx.reduced() || state.list.length < 2) return;
    state.timer = setInterval(() => { if (!document.hidden) go(state.index + 1); }, AUTO_MS);
  }

  /** 새 state 를 화면에 붙인다. 열린 채 다시 붙일 때 hide(true) 가 푼 스크롤 잠금(html.sc-open)도 다시 건다. */
  function mount(at) {
    host.append(state.root);
    go(at, { first: true });
    swipe(state.stage, state.track, { index: () => state.index, go, start: pause });
    document.addEventListener('keydown', onKey);
    document.documentElement.classList.add('sc-open');
  }

  function onKey(e) {
    if (!state) return;
    if (e.key === 'ArrowRight') manual(1);
    else if (e.key === 'ArrowLeft') manual(-1);
    else if (e.key === 'Escape') ctx.close();
  }

  return {
    get open() { return !!state; },
    get id() { return state ? state.prof.id : ''; },

    /** fromCard: 칸반 카드(있으면 그 자리에서 커진다) */
    show(p, fromCard) {
      const next = build(p);
      const img = fromCard && fromCard.querySelector('img');
      const name = fromCard && fromCard.querySelector('.card-name');
      document.documentElement.classList.add('sc-open');
      return morph(() => {
        if (state) this.hide(true);
        state = { ...next, index: 0, paused: false, timer: 0 };
        mount(0);
        state.root.focus({ preventScroll: true });
        return ready(state.track.querySelector('.sc-slide img'));
      }, [
        { name: 'morph-card', from: fromCard, to: () => state && state.root, clip: true },
        { name: 'morph-shot', from: img, to: () => state && state.track.querySelector('.sc-slide img') },
        { name: 'morph-name', from: name, to: () => state && state.root.querySelector('.sc-name') },
      ]).then(() => { if (state && state.root === next.root) auto(); });
    },

    /** 데이터가 바뀌었을 때: 같은 교수면 같은 앱 자리에서 다시 그린다 */
    refresh(p) {
      if (!state) return;
      const appId = state.list[state.index].app.id;
      const paused = state.paused;
      this.hide(true);
      state = { ...build(p), index: 0, paused, timer: 0 };
      mount(Math.max(0, state.list.findIndex((s) => s.app.id === appId)));
      if (paused) state.root.classList.add('is-manual');
      auto();
    },

    /** toCard: 돌아갈 칸반 카드(있으면 그 자리로 줄어든다). quiet: 움직임 없이 */
    hide(quiet, toCard) {
      if (!state) return Promise.resolve();
      const cur = state;
      state = null; // 닫는 움직임 사이에 온 새 데이터(refresh)가 방금 닫은 쇼케이스를 다시 열지 않게
      clearInterval(cur.timer);
      document.removeEventListener('keydown', onKey);
      const remove = () => {
        cur.root.remove();
        // 닫는 사이 다른 쇼케이스가 열렸으면 잠금을 그대로 둔다
        if (!state) document.documentElement.classList.remove('sc-open');
      };
      if (quiet) {
        remove();
        return Promise.resolve();
      }
      return morph(remove, [
        { name: 'morph-card', from: cur.root, to: () => toCard || null },
        { name: 'morph-shot', from: cur.track.children[cur.index].querySelector('img'), to: () => (toCard ? toCard.querySelector('img') : null) },
        { name: 'morph-name', from: cur.root.querySelector('.sc-name'), to: () => (toCard ? toCard.querySelector('.card-name') : null) },
      ]);
    },
  };
}
