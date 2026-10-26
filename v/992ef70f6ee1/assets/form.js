// 앱 등록 화면(#/register). 한 번에 앱 하나. 필수 칸이 비거나 틀리면 제출 버튼이 눌리지 않는다(R1, f-submit-form).
// 쓰던 내용과 고른 캡처는 바로바로 저장해 두었다가 새로 고친 뒤 다시 채운다(B5).
import { h, clear } from './dom.js';
import { DEPARTMENTS, OTHER } from './departments.js';
import { LABELS, LIMITS, validate, chars } from './validate.js';
import { saveDraft, loadDraft, clearDraft } from './draft.js';
import { shrink } from './images.js';
import { call, backendReady } from './api.js';
import { OPEN } from './config.js';
import { closedView, doneView, NOTICE, CHECKS, HINTS } from './form-text.js';

const DEPT_NAMES = DEPARTMENTS.flatMap((g) => g.names);
const TEXT_KEYS = ['name', 'dept', 'deptOther', 'email', 'appName', 'url', 'desc', 'github', 'coauthors'];
let busy = false;

/** 보내는 중이면 새 버전 적용(새로 고침)을 미룬다 */
export function formBusy() {
  return busy;
}

function b64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

function input(key, attrs) {
  return h(attrs.rows ? 'textarea' : 'input', { id: `f-${key}`, name: key, ...attrs });
}

export function renderRegister(root, ctx) {
  clear(root);
  const sample = ctx.mode === 'sample';
  if (!sample && !(OPEN && backendReady())) {
    root.append(closedView(ctx));
    return;
  }
  const shots = [];
  // 이 화면에서 보내는 한 건의 이름표: 답을 놓쳐 다시 보내도 수신함은 한 줄만 만든다(같은 key)
  const submitKey = crypto.randomUUID();
  const touched = new Set();
  let tried = false;
  let saveTimer = 0;

  const el = {
    name: input('name', { autocomplete: 'name', maxlength: LIMITS.name }),
    dept: h('select', { id: 'f-dept', name: 'dept' },
      h('option', { value: '' }, '학과를 고르세요'),
      DEPARTMENTS.map((g) => h('optgroup', { label: g.series }, g.names.map((n) => h('option', { value: n }, n)))),
      h('option', { value: OTHER }, '기타(직접 적기)')),
    deptOther: input('deptOther', { maxlength: LIMITS.deptOther, placeholder: '학과 이름' }),
    email: input('email', { type: 'email', inputmode: 'email', autocomplete: 'email', placeholder: '아이디@dit.ac.kr' }),
    appName: input('appName', { maxlength: LIMITS.appName }),
    url: input('url', { type: 'url', inputmode: 'url', placeholder: 'https://' }),
    desc: input('desc', { rows: 2, maxlength: LIMITS.desc }),
    github: input('github', { type: 'url', inputmode: 'url', placeholder: 'https://github.com/아이디/저장소' }),
    coauthors: input('coauthors', { maxlength: LIMITS.coauthors }),
    file: h('input', { id: 'f-shots', type: 'file', accept: 'image/*', multiple: true }),
    consent: h('input', { id: 'f-consent', type: 'checkbox' }),
    noPii: h('input', { id: 'f-noPii', type: 'checkbox' }),
    ownWork: h('input', { id: 'f-ownWork', type: 'checkbox' }),
  };
  const counters = {
    appName: h('span.counter', { 'aria-live': 'off' }),
    desc: h('span.counter', { 'aria-live': 'off' }),
  };
  const shotList = h('ul.shots');
  const submit = h('button.btn.btn-wide', { type: 'submit', disabled: true }, '등록하고 확인 메일 받기');
  const status = h('p.form-status', { 'aria-live': 'polite' });

  function field(key, control, req) {
    return h('div.field', { dataset: { key } },
      h('label', { for: `f-${key}` }, LABELS[key], ' ', req ? h('span.req', null, '필수') : h('span.opt', null, '선택')),
      control, counters[key] || null,
      HINTS[key] ? h('p.hint', null, HINTS[key]) : null,
      h('p.err', { id: `e-${key}` }));
  }

  function check(key, label) {
    return h('label.check', { for: `f-${key}` }, el[key], h('span', null, h('b', null, label), ' ', CHECKS[key]));
  }

  function read() {
    const v = {};
    for (const k of TEXT_KEYS) v[k] = el[k].value;
    v.consent = el.consent.checked;
    v.noPii = el.noPii.checked;
    v.ownWork = el.ownWork.checked;
    v.shots = shots.map((s) => ({ type: s.blob.type, size: s.blob.size }));
    return v;
  }

  function refresh() {
    const v = read();
    const r = validate(v, DEPT_NAMES);
    el.deptOther.closest('.field').hidden = v.dept !== OTHER;
    counters.appName.textContent = `${chars(v.appName)}/${LIMITS.appName}`;
    counters.desc.textContent = `${chars(v.desc)}/${LIMITS.desc}`;
    for (const k of [...TEXT_KEYS, 'shots']) {
      const msg = (tried || touched.has(k)) ? (r.errors[k] || '') : '';
      const err = form.querySelector(`#e-${k}`);
      if (err) err.textContent = msg;
      const c = k === 'shots' ? el.file : el[k];
      c.toggleAttribute('aria-invalid', !!msg);
    }
    el.file.disabled = shots.length >= LIMITS.shots;
    submit.disabled = sample || busy || !r.ok;
    if (sample) status.textContent = '예시 화면입니다. 여기서는 보내지 않습니다.';
    else if (busy) status.textContent = '보내는 중입니다. 화면을 닫지 마세요.';
    else if (r.missing.length) status.textContent = `남은 항목: ${r.missing.join(', ')}`;
    else if (!r.ok) status.textContent = '빨간 글씨로 적힌 곳을 고쳐 주세요.';
    else status.textContent = '';
    return r;
  }

  function persist() {
    if (sample) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const fields = {};
      for (const k of TEXT_KEYS) fields[k] = el[k].value;
      for (const k of ['consent', 'noPii', 'ownWork']) fields[k] = el[k].checked;
      saveDraft({ fields, shots: shots.map((s) => ({ name: s.name, type: s.blob.type, blob: s.blob })) });
    }, 250);
  }

  function drawShots() {
    clear(shotList);
    shots.forEach((s, i) => shotList.append(h('li', null,
      h('img', { src: s.url, alt: `고른 캡처 ${i + 1}` }),
      h('button.btn-text', { type: 'button', onclick: () => { URL.revokeObjectURL(s.url); shots.splice(i, 1); drawShots(); refresh(); persist(); } }, '빼기'))));
  }

  function addShot(name, blob) {
    shots.push({ name, blob, url: URL.createObjectURL(blob) });
  }

  el.file.addEventListener('change', async () => {
    touched.add('shots');
    const files = [...el.file.files].slice(0, LIMITS.shots - shots.length);
    el.file.value = '';
    for (const f of files) {
      try {
        const { blob } = await shrink(f);
        addShot(f.name, blob);
      } catch (e) {
        form.querySelector('#e-shots').textContent = e.message;
      }
    }
    drawShots();
    refresh();
    persist();
  });

  const form = h('form.page.reg', { novalidate: true, dataset: { view: 'register' } },
    h('h1.page-title', null, '앱 등록하기'),
    h('p.page-lead', null, '한 번에 앱 하나씩 올립니다. 올리면 학교 이메일로 확인 메일이 가고, 메일 속 버튼을 눌러야 판정이 시작됩니다.'),
    field('name', el.name, true),
    field('dept', el.dept, true),
    field('deptOther', el.deptOther, true),
    field('email', el.email, true),
    field('appName', el.appName, true),
    field('url', el.url, true),
    field('desc', el.desc, true),
    field('github', el.github, false),
    field('coauthors', el.coauthors, false),
    h('div.field', { dataset: { key: 'shots' } },
      h('label', { for: 'f-shots' }, LABELS.shots, ' ', h('span.opt', null, `선택 · ${LIMITS.shots}장까지`)),
      el.file, shotList, h('p.hint', null, HINTS.shots), h('p.err', { id: 'e-shots' })),
    h('div.checks', null, check('consent', '공개 동의'), check('noPii', '학생 개인정보 없음'), check('ownWork', '본인 제작')),
    NOTICE(),
    h('div.form-end', null, submit, status));

  form.addEventListener('input', (e) => { if (e.target.name) touched.add(e.target.name); refresh(); persist(); });
  form.addEventListener('change', () => { refresh(); persist(); });
  form.addEventListener('focusout', (e) => { if (e.target.name) { touched.add(e.target.name); refresh(); } });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    tried = true;
    if (!refresh().ok || sample || busy) return;
    busy = true;
    refresh();
    try {
      const v = read();
      const payload = { ...v, key: submitKey, shots: await Promise.all(shots.map(async (s) => ({ name: s.name, type: s.blob.type, data: await b64(s.blob) }))) };
      await call('submit', payload);
      await clearDraft();
      busy = false;
      clear(root).append(doneView(ctx));
    } catch (err) {
      busy = false;
      refresh();
      status.textContent = `보내지 못했습니다: ${err.message} 잠시 뒤 다시 눌러 주세요.`;
    }
  });

  root.append(form);
  refresh();
  if (!sample) {
    loadDraft().then((d) => {
      if (!d || !form.isConnected) return;
      for (const k of TEXT_KEYS) if (typeof d.fields[k] === 'string') el[k].value = d.fields[k];
      for (const k of ['consent', 'noPii', 'ownWork']) el[k].checked = d.fields[k] === true;
      for (const s of Array.isArray(d.shots) ? d.shots.slice(0, LIMITS.shots) : []) if (s && s.blob) addShot(s.name || 'capture.jpg', s.blob);
      drawShots();
      refresh();
    });
  }
}
