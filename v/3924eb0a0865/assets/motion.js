// 모핑: 같은 이름을 가진 앞뒤 요소를 이어서 움직인다(View Transitions). 지원하지 않는 브라우저는 FLIP 으로 흉내 낸다.
// '동작 줄이기'를 켠 기기에서는 움직임 없이 바로 바꾼다(S4).

export function reducedMotion() {
  return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}

const EASE = 'cubic-bezier(.2,.8,.2,1)';
const DURATION = 380;
let running = null;

/**
 * update(): 화면을 바꾸는 함수. Promise 를 돌려주면(그림 준비 등) 끝날 때까지 기다렸다가 새 모습을 잡는다.
 * pairs: [{ name, from: 바뀌기 전 요소|null, to: () => 바뀐 뒤 요소|null, clip: 커지는 판이면 true }]
 * 돌려주는 Promise 는 움직임이 끝나면 풀린다.
 */
export async function morph(update, pairs = []) {
  if (reducedMotion()) {
    await update();
    return;
  }
  if (typeof document.startViewTransition === 'function') {
    await viewTransition(update, pairs);
    return;
  }
  await flip(update, pairs);
}

function viewTransition(update, pairs) {
  if (running) running.skipTransition();
  for (const p of pairs) if (p.from) p.from.style.viewTransitionName = p.name;
  const targets = [];
  const vt = document.startViewTransition(async () => {
    for (const p of pairs) if (p.from) p.from.style.viewTransitionName = '';
    await update();
    for (const p of pairs) {
      const t = p.to ? p.to() : null;
      if (t) {
        t.style.viewTransitionName = p.name;
        targets.push(t);
      }
    }
  });
  running = vt;
  const done = () => {
    if (running === vt) running = null;
    for (const t of targets) t.style.viewTransitionName = '';
  };
  return vt.finished.then(done, done);
}

function rectOf(el) {
  if (!el || !el.isConnected) return null;
  const r = el.getBoundingClientRect();
  return r.width && r.height ? r : null;
}

async function flip(update, pairs) {
  const before = pairs.map((p) => rectOf(p.from));
  await update();
  const anims = [];
  pairs.forEach((p, i) => {
    const to = p.to ? p.to() : null;
    const a = before[i];
    const b = rectOf(to);
    if (!to || !a || !b || typeof to.animate !== 'function') return;
    if (p.clip) {
      const inset = `inset(${a.top - b.top}px ${b.right - a.right}px ${b.bottom - a.bottom}px ${a.left - b.left}px round 12px)`;
      anims.push(to.animate([{ clipPath: inset }, { clipPath: 'inset(0px 0px 0px 0px round 0px)' }], { duration: DURATION, easing: EASE }));
    } else {
      const t = `translate(${a.left - b.left}px, ${a.top - b.top}px) scale(${a.width / b.width}, ${a.height / b.height})`;
      anims.push(to.animate([{ transformOrigin: '0 0', transform: t }, { transformOrigin: '0 0', transform: 'none' }], { duration: DURATION, easing: EASE }));
    }
  });
  await Promise.all(anims.map((x) => x.finished.catch(() => {})));
}

/** 그림이 준비될 때까지(길어도 ms) 기다린다 — 모핑 끝 모습이 빈 화면으로 잡히지 않게 */
export function ready(img, ms = 300) {
  if (!img || typeof img.decode !== 'function') return Promise.resolve();
  return Promise.race([img.decode().catch(() => {}), new Promise((r) => setTimeout(r, ms))]);
}
