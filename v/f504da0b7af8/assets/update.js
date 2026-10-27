// 새 버전 자동 적용(f-force-update, B5). version.json { shell, data } 을 뜬 직후, 1분마다(화면이 보일 때),
// 탭으로 돌아올 때·다시 연결될 때 새로 받아 본다.
// - 화면 버전(shell)이 바뀌면 곧바로 캐시를 거치지 않는 주소(?v=<새 버전>)로 다시 연다. 보던 화면(#…)은 그대로.
//   등록 화면에 쓰던 내용과 캡처는 늘 저장되어 있어 다시 채워진다(draft.js). 보내는 중이면 끝날 때까지 미룬다.
// - 데이터 버전(data)만 바뀌면 다시 열지 않고 그 자리에서 칸반·쇼케이스·배지를 바꾼다(승인·비공개 반영, R12).
import { BUILD, fetchVersion } from './data.js';

export const CHECK_MS = 60000;
const GUARD_KEY = 'mc.update';
const GUARD_MS = 3 * 60000;

/** 지금 화면(build, data)과 올라간 것(remote) → 할 일. remote 가 없으면(망 문제) 아무것도 하지 않는다. */
export function decide(build, data, remote) {
  if (!remote) return { reload: false, data: false };
  return { reload: !!(build && remote.shell && remote.shell !== build), data: remote.data !== data };
}

/** 다시 열 주소: 경로 + ?v=<버전> + 보던 화면(#…). 해시는 한 번만 붙는다. */
export function reloadUrl(loc, shell) {
  return `${loc.pathname}?v=${shell}${loc.hash || ''}`;
}

/** 같은 목표로 3분 안에 또 다시 열지 않는다(배포 반영이 늦을 때 되풀이 방지). 허락하면 기록한다. */
export function guardAllows(store, target, from, now) {
  try {
    const t = JSON.parse((store && store.getItem(GUARD_KEY)) || 'null');
    if (t && t.target === target && t.from === from && now - t.at < GUARD_MS) return false;
    if (store) store.setItem(GUARD_KEY, JSON.stringify({ target, from, at: now }));
  } catch (e) { /* 저장소가 없으면 그냥 다시 연다 */ }
  return true;
}

function session() {
  try {
    return window.sessionStorage;
  } catch (e) {
    return null;
  }
}

/**
 * initial: 뜰 때 받은 { shell, data } (없으면 null)
 * getData(): 지금 보이는 데이터 버전, onData(ts): 새 데이터로 바꾸기(Promise), busy(): 지금 다시 열면 안 되나
 */
export function startUpdates({ initial, getData, onData, busy }) {
  const store = session();
  try {
    const t = JSON.parse((store && store.getItem(GUARD_KEY)) || 'null');
    if (t && t.target === BUILD && store) store.removeItem(GUARD_KEY);
  } catch (e) { /* 무시 */ }

  let target = '';
  let checking = false;

  function apply() {
    if (!target) return;
    if (busy()) {
      setTimeout(apply, 1500);
      return;
    }
    if (guardAllows(store, target, BUILD, Date.now())) location.replace(reloadUrl(location, target));
  }

  async function handle(v) {
    const d = decide(BUILD, getData(), v);
    if (d.reload) {
      target = v.shell;
      apply();
      return;
    }
    if (d.data) {
      try {
        await onData(v.data);
      } catch (e) { /* 다음 확인 때 다시 */ }
    }
  }

  async function check() {
    if (checking || document.hidden) return;
    checking = true;
    try {
      await handle(await fetchVersion());
    } finally {
      checking = false;
    }
  }

  if (initial) handle(initial);
  setInterval(check, CHECK_MS);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
  window.addEventListener('pageshow', (e) => { if (e.persisted) check(); });
  window.addEventListener('online', check);
  window.addEventListener('focus', check);
  return { check };
}
