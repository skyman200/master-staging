// 등록 화면 임시 저장(IndexedDB). 쓰던 내용과 고른 캡처를 저장해 두었다가 새로 고친 뒤 다시 채운다(B5, f-force-update).
// 저장소를 쓸 수 없는 브라우저(일부 사생활 보호 모드)에서는 조용히 아무것도 하지 않는다.
const DB = 'dit-app-cert';
const STORE = 'draft';
const KEY = 'register';

function open() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('no indexedDB'));
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run(mode, fn) {
  let db;
  try {
    db = await open();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req ? req.result : undefined);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch (e) {
    return undefined;
  } finally {
    if (db) db.close();
  }
}

/** draft: { fields: {이름: 값…}, shots: [{ name, type, blob }] } */
export function saveDraft(draft) {
  return run('readwrite', (s) => s.put({ ...draft, savedAt: Date.now() }, KEY));
}

export async function loadDraft() {
  const d = await run('readonly', (s) => s.get(KEY));
  return d && typeof d === 'object' && d.fields ? d : null;
}

export function clearDraft() {
  return run('readwrite', (s) => s.delete(KEY));
}
