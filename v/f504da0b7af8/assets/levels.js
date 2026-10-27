// 레벨 이름과 발급 기관 — 칸반 열·쇼케이스·배지가 모두 이 이름을 쓴다(f-level-naming).
export const LEVELS = Object.freeze([
  Object.freeze({ n: 1, title: 'AI 활용전문가', what: '화면만 있는 앱' }),
  Object.freeze({ n: 2, title: 'AI 설계전문가', what: '데이터 저장·로그인이 있는 앱' }),
  Object.freeze({ n: 3, title: 'AI 혁신리더', what: 'AI 모델·API를 직접 연동한 앱' }),
]);

export const TRACK = '앱 제작';
export const ISSUER = '동의과학대 AI허브센터';

/** 'AI 혁신리더 · 앱 제작' */
export function levelTitle(n) {
  const lv = LEVELS[n - 1];
  if (!lv) throw new RangeError(`레벨은 1~3입니다: ${n}`);
  return `${lv.title} · ${TRACK}`;
}

/** 'Lv.3 AI 혁신리더 · 앱 제작' */
export function levelName(n) {
  return `Lv.${n} ${levelTitle(n)}`;
}
