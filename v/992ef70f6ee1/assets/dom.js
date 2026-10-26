// 작은 DOM 도우미. 교수가 적은 글은 언제나 textContent 로만 넣는다(HTML로 해석하지 않는다).

/**
 * h('a.btn', { href, onclick }, '글자', child)
 * - 'tag.class1.class2' 모양으로 클래스를 붙인다.
 * - on* 은 이벤트, dataset/attrs 는 그대로, 나머지는 속성으로 넣는다. false/null/undefined 는 건너뛴다.
 */
export function h(spec, props, ...children) {
  const [tag, ...classes] = spec.split('.');
  const el = document.createElement(tag || 'div');
  if (classes.length) el.className = classes.join(' ');
  for (const [k, v] of Object.entries(props || {})) {
    if (v === false || v == null) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k === 'class') el.className = [el.className, v].filter(Boolean).join(' ');
    else if (k === 'text') el.textContent = v;
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, String(v));
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children) {
    if (c == null || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export function clear(el) {
  while (el.firstChild) el.firstChild.remove();
  return el;
}

/** HTML 문자열에 넣을 글자(배지 카드처럼 문자열로 만드는 곳에서만 쓴다) */
export function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** 숫자를 그 자리에서 세어 올리거나 내린다(모핑). 동작 줄이기면 바로 바꾼다. */
export function countTo(el, to, reduced) {
  const from = Number(el.textContent) || 0;
  if (reduced || from === to || typeof requestAnimationFrame !== 'function') {
    el.textContent = String(to);
    return;
  }
  const start = performance.now();
  const dur = 450;
  const step = (now) => {
    const k = Math.min(1, (now - start) / dur);
    const e = 1 - (1 - k) ** 3;
    el.textContent = String(Math.round(from + (to - from) * e));
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
