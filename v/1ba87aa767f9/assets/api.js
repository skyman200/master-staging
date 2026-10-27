// Apps Script 수신함으로 보내기(L2). 글자(text/plain) JSON 으로 보낸다 — 미리 묻기(CORS preflight)를 피한다.
// Apps Script 앞문이 가끔 POST 를 GET 으로 바꿔 받는다(바이브 2026-10-08). 답의 action 이 보낸 것과 다르면 다시 보낸다.
import { EXEC_URL } from './config.js';

const TRIES = 3;

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export function backendReady() {
  return /^https:\/\//.test(EXEC_URL);
}

/** → 성공하면 Apps Script 의 답(JSON). 실패하면 사람이 읽을 이유를 담은 Error. */
export async function call(action, payload, { timeoutMs = 90000 } = {}) {
  if (!backendReady()) throw new Error('아직 접수를 받지 않습니다.');
  let last = null;
  for (let i = 0; i < TRIES; i += 1) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const res = await fetch(EXEC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ ...payload, action }),
        redirect: 'follow',
        signal: ctl.signal,
      });
      const body = await res.json().catch(() => null);
      if (body && body.action === action) {
        if (body.ok) return body;
        const err = new Error(body.message || '처리하지 못했습니다.');
        err.server = true;
        err.code = String(body.code || '');
        throw err;
      }
      last = new Error('수신함이 잠시 바쁩니다.');
    } catch (e) {
      if (e && e.server) throw e;
      last = e && e.name === 'AbortError' ? new Error('응답이 너무 늦습니다.') : new Error('인터넷 연결을 확인해 주세요.');
    } finally {
      clearTimeout(timer);
    }
    await wait(1500 * (i + 1));
  }
  throw last;
}
