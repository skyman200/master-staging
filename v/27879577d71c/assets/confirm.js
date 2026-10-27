// 확인 메일 버튼이 여는 화면(#/confirm/<token>). 눌러야 판정이 시작된다(f-identity-email, R3).
// 같은 버튼을 두 번 눌러도 한 번만 시작한다(Apps Script 쪽에서 '이미 확인됨'으로 답한다).
import { h, clear } from './dom.js';
import { call, backendReady } from './api.js';

const TOKEN_RE = /^[A-Za-z0-9_-]{16,200}$/;

function show(root, title, lead, ctx) {
  clear(root).append(h('section.page.confirm', { dataset: { view: 'confirm' } },
    h('h1.page-title', null, title),
    lead ? h('p.page-lead', null, lead) : null,
    h('p', null, h('a', { href: `${ctx.prefix}/` }, '칸반보드 보기'))));
}

export async function renderConfirm(root, token, ctx) {
  if (!backendReady()) return show(root, '접수 준비 중입니다', '아직 확인을 받지 않습니다.', ctx);
  if (!TOKEN_RE.test(token || '')) return show(root, '확인 주소가 틀렸습니다', '메일 속 버튼을 다시 눌러 주세요.', ctx);
  show(root, '확인하는 중입니다', '잠시만 기다려 주세요.', ctx);
  try {
    const r = await call('confirm', { token });
    if (r.state === 'already') show(root, '이미 확인한 제출입니다', '판정이 진행 중이거나 끝났습니다. 결과는 메일로 알려 드립니다.', ctx);
    else if (r.state === 'hold') show(root, '확인했습니다', '같은 앱 주소로 낸 제출이 이미 있어, AI허브센터가 먼저 살펴본 뒤 판정합니다. 결과는 메일로 알려 드립니다.', ctx);
    else show(root, '확인했습니다', '판정을 시작합니다. 보통 평일 3일 안에 결과를 메일로 알려 드립니다.', ctx);
  } catch (e) {
    show(root, '확인하지 못했습니다', `${e.message} 메일 속 버튼을 다시 눌러 주세요.`, ctx);
  }
}
