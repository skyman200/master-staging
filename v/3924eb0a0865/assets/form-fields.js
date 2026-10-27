// 등록 화면 입력 칸 만들기: 입력 요소와 칸(이름표·필수/선택·안내·오류 자리), 캡처 칸, 확인 칸.
import { h } from './dom.js';
import { DEPARTMENTS, OTHER } from './departments.js';
import { LABELS, LIMITS } from './validate.js';
import { CHECKS, HINTS } from './form-text.js';

function input(key, attrs) {
  return h(attrs.rows ? 'textarea' : 'input', { id: `f-${key}`, name: key, ...attrs });
}

/** 칸 이름 → 입력 요소 */
export function controls() {
  return {
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
}

/** counter: 글자 수 자리(없으면 생략) */
export function field(key, control, req, counter) {
  return h('div.field', { dataset: { key } },
    h('label', { for: `f-${key}` }, LABELS[key], ' ', req ? h('span.req', null, '필수') : h('span.opt', null, '선택')),
    control, counter || null,
    HINTS[key] ? h('p.hint', null, HINTS[key]) : null,
    h('p.err', { id: `e-${key}` }));
}

/** 캡처 칸: 파일 고르기와 고른 캡처 목록 */
export function shotsField(file, list) {
  return h('div.field', { dataset: { key: 'shots' } },
    h('label', { for: 'f-shots' }, LABELS.shots, ' ', h('span.opt', null, `선택 · ${LIMITS.shots}장까지`)),
    file, list, h('p.hint', null, HINTS.shots), h('p.err', { id: 'e-shots' }));
}

/** 확인 칸: 상자, 굵은 이름, 설명 */
export function check(key, box, label) {
  return h('label.check', { for: `f-${key}` }, box, h('span', null, h('b', null, label), ' ', CHECKS[key]));
}
