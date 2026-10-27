// 배지 확인 페이지(#/badge/<id>). 공개가 내려간 교수는 '확인할 수 없는 배지'로 보인다(R12).
import { h, clear } from './dom.js';
import { badgeHtml, badgeUrl } from './badge-card.js';

function siteBase() {
  const u = new URL(document.baseURI);
  return `${u.origin}${u.pathname}`;
}

export function renderBadge(root, p, ctx) {
  clear(root);
  if (!p) {
    root.append(h('section.page.bp', { dataset: { view: 'badge-missing' } },
      h('h1.page-title', null, '확인할 수 없는 배지입니다'),
      h('p.page-lead', null, '공개가 내려갔거나 주소가 틀렸습니다.'),
      h('p', null, h('a', { href: `${ctx.prefix}/` }, '칸반보드 보기'))));
    return;
  }
  const verify = badgeUrl(p.id, siteBase(), ctx.mode === 'sample');
  const card = h('div.bp-card');
  card.innerHTML = badgeHtml(p, verify);
  const img = p.badge.img ? ctx.asset(p.badge.img) : '';
  root.append(h('section.page.bp', { dataset: { view: 'badge', id: p.id } },
    h('h1.page-title', null, `${p.name} 교수 배지`),
    card,
    h('p.bp-actions', null,
      img ? h('a.btn', { href: img, download: `배지-${p.name}.png` }, '배지 이미지 받기') : null,
      h('a.btn-line', { href: `${ctx.prefix}/p/${p.id}` }, '앱 보기')),
    h('p.bp-note', null, '이 배지는 DIT AI 3-LEVEL 인증 가운데 앱 제작 실적을 확인한 것입니다. 최종 등급은 동의과학대 AI허브센터가 정합니다.')));
}
