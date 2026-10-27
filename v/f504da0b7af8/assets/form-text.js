// 등록 화면 글(안내·확인 문구). 짧고 쉬운 문장으로 쓴다.
import { h } from './dom.js';

export const HINTS = {
  email: '공개하지 않습니다. 이 주소로 확인 메일을 보냅니다.',
  url: '학교 밖에서도 열리는 주소여야 검사할 수 있습니다. 첫 화면과 로그인 없이 열리는 화면만 찍습니다.',
  desc: '쇼케이스에 큰 글씨로 나옵니다.',
  github: '적으면 코드도 판정 근거로 쓰고, 쇼케이스에 주소를 보여 줍니다.',
  coauthors: '승인자에게만 보이고 공개하지 않습니다.',
  shots: '로그인 뒤 화면은 시험 계정으로 찍어 주세요. 학생 이름·학번·성적이 보이는 화면은 올리지 마세요. 이름·학번·전화·이메일·성적은 회색 상자로 가린 뒤 공개합니다.',
};

export const CHECKS = {
  consent: '승인되면 이름·학과·앱 이름·앱 주소·레벨·한 줄 설명·가린 화면을 이 사이트에 공개합니다. GitHub 주소를 적었다면 그것도 공개합니다.',
  noPii: '앱 첫 화면과 올린 캡처에 학생 개인정보(이름·학번·성적·연락처)가 없습니다.',
  ownWork: '이 앱은 제가 직접 만들었습니다. 학생이 주로 만든 앱(캡스톤·졸업작품)은 받지 않습니다.',
};

const NOTICE_ROWS = [
  ['모으는 것', '이름, 학과, 학교 이메일, 앱 이름·주소·설명, GitHub 주소, 함께 만든 사람, 캡처'],
  ['쓰는 곳', '앱 제작 실적 판정과 결과 안내 메일'],
  ['보관 기간', '가리기 전 원본 캡처는 승인·반려가 정해지면 지웁니다. 공개하지 않는 제출(반려·비공개·판정 실패·확인하지 않은 제출)은 마지막 안내 메일 30일 뒤 이메일·함께 만든 사람·원본 캡처를 지웁니다. 공개 중인 앱의 이메일은 결과 안내를 위해 둡니다.'],
];

export function NOTICE() {
  return h('dl.facts.notice', null, NOTICE_ROWS.map(([k, v]) => h('div', null, h('dt', null, k), h('dd', null, v))));
}

export function closedView(ctx) {
  return h('section.page.reg-closed', { dataset: { view: 'register-closed' } },
    h('h1.page-title', null, '접수 준비 중입니다'),
    h('p.page-lead', null, '문을 열면 이 화면에서 앱을 하나씩 등록할 수 있습니다.'),
    h('dl.facts', null,
      h('div', null, h('dt', null, '필요한 것'), h('dd', null, '앱 주소, 한 줄 설명(50자 이내), 학교 이메일(@dit.ac.kr)')),
      h('div', null, h('dt', null, '있으면 좋은 것'), h('dd', null, 'GitHub 주소, 로그인 뒤 화면 캡처 5장까지(시험 계정으로 찍기)')),
      h('div', null, h('dt', null, '판정'), h('dd', null, '검사 프로그램이 앱을 직접 열어 보고 AI가 레벨을 제안하면, AI허브센터가 확인하고 승인합니다.'))),
    h('p', null, h('a', { href: `${ctx.prefix}/` }, '칸반보드 보기')));
}

export function doneView(ctx) {
  return h('section.page.reg-done', { dataset: { view: 'register-done' } },
    h('h1.page-title', null, '확인 메일을 보냈습니다'),
    h('p.page-lead', null, '학교 메일함에서 [판정 시작하기] 버튼을 눌러야 판정이 시작됩니다.'),
    h('p', null, '보통 평일 3일 안에 결과를 알려 드립니다.'),
    h('p.links', null,
      h('a', { href: `${ctx.prefix}/register`, onclick: (e) => { e.preventDefault(); ctx.route(); } }, '다른 앱 등록하기'),
      h('a', { href: `${ctx.prefix}/` }, '칸반보드 보기')));
}
