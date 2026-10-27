// 배지 카드: 글자와 레벨 숫자만 쓴 단순한 카드(f-badge). 확인 페이지와 배지 이미지(PNG)가 이 한 함수로 같은 내용을 그린다.
// 이미지는 판정 프로그램(L3)과 예시 만들기(tools/make-sample.mjs)가 크롬으로 이 카드를 찍어 만든다.
import { esc } from './dom.js';
import { levelTitle, ISSUER } from './levels.js';
import { kstDateLong } from './model.js';

export const SITE_URL = 'https://skyman200.github.io/master/';

/** 확인 주소. base: 사이트 주소(끝에 /), sample: 예시 화면이면 true */
export function badgeUrl(id, base = SITE_URL, sample = false) {
  return `${base}#/${sample ? 'sample/' : ''}badge/${id}`;
}

/** p: model.normalizePublic 이 돌려준 교수. verify: 확인 주소 */
export function badgeHtml(p, verify) {
  const shown = verify.replace(/^https?:\/\//, '');
  return `<div class="badge-card" data-id="${esc(p.id)}">`
    + `<p class="bc-lv"><span>Lv.</span><b>${esc(p.level)}</b></p>`
    + `<p class="bc-title">${esc(levelTitle(p.level))}</p>`
    + `<p class="bc-name">${esc(p.name)}</p>`
    + `<p class="bc-dept">${esc(p.dept)}</p>`
    + '<dl class="bc-meta">'
    + `<div><dt>발급 기관</dt><dd>${esc(ISSUER)}</dd></div>`
    + `<div><dt>발급일</dt><dd>${esc(kstDateLong(p.badge.date))}</dd></div>`
    + `<div><dt>앱</dt><dd>${esc(p.apps.length)}개 인증</dd></div>`
    + '</dl>'
    + '<p class="bc-foot">DIT AI 3-LEVEL 인증 · 앱 제작 실적</p>'
    + `<p class="bc-url">${esc(shown)}</p>`
    + '</div>';
}
