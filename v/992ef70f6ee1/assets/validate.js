// 등록 화면 검사(f-submit-form). 필수 칸이 비거나 틀리면 제출 버튼을 누를 수 없다(R1).
// Apps Script(gas/Submit.js)도 같은 규칙으로 한 번 더 검사한다.
export const LABELS = Object.freeze({
  name: '이름',
  dept: '학과',
  deptOther: '학과 이름',
  email: '학교 이메일',
  appName: '앱 이름',
  url: '앱 주소',
  desc: '한 줄 설명',
  github: 'GitHub 주소',
  coauthors: '함께 만든 사람',
  shots: '로그인 뒤 화면 캡처',
  consent: '공개 동의',
  noPii: '학생 개인정보 없음 확인',
  ownWork: '본인 제작 확인',
});

export const LIMITS = Object.freeze({
  name: 30, deptOther: 30, appName: 30, desc: 50, coauthors: 60,
  shots: 5, shotPx: 1600, shotBytes: 1.5 * 1024 * 1024,
});

const EMAIL_IN_TEXT = /[^\s@]+@[^\s@]+\.[A-Za-z]{2,}/;
const SCHOOL_EMAIL = /^[^\s@]+@dit\.ac\.kr$/i;
const INTERNAL_SUFFIX = /(^|\.)(localhost|local|internal|intranet|lan|home\.arpa|ts\.net)$/i;

/** 글자 수(한글 한 자 = 1) */
export function chars(s) {
  return [...String(s || '')].length;
}

function ipv4(host) {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  return m ? m.slice(1).map(Number) : null;
}

/** 학교 안에서만 열리거나 이 컴퓨터를 가리키는 주소인가(검사 프로그램이 열지 않는 주소, f-inspector-safety). */
export function isInternalHost(hostname) {
  const host = String(hostname || '').toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  if (!host) return true;
  const v4 = ipv4(host);
  if (v4) {
    const [a, b] = v4;
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  if (host.includes(':')) {
    return host === '::1' || host === '::' || /^f[cd]/.test(host) || /^fe[89ab]/.test(host) || host.startsWith('64:ff9b');
  }
  return !host.includes('.') || INTERNAL_SUFFIX.test(host);
}

/** http(s) 주소면 URL, 아니면 null */
export function parseHttpUrl(s) {
  try {
    const u = new URL(String(s || '').trim());
    return u.protocol === 'http:' || u.protocol === 'https:' ? u : null;
  } catch (e) {
    return null;
  }
}

function blank(v) {
  return !String(v == null ? '' : v).trim();
}

/**
 * v: { name, dept, deptOther, email, appName, url, desc, github, coauthors, shots: [{type,size}], consent, noPii, ownWork }
 * deptNames: 고를 수 있는 학과 이름 목록('기타' 제외)
 * → { ok, missing: [빈 필수 칸 이름], errors: { 칸: 고칠 점 } }
 */
export function validate(v, deptNames) {
  const missing = [];
  const errors = {};
  const need = (key, empty) => { if (empty) missing.push(LABELS[key]); return !empty; };
  const noEmail = (key) => { if (EMAIL_IN_TEXT.test(v[key] || '')) errors[key] = '공개되는 칸에는 이메일을 적지 마세요.'; };
  const max = (key, n) => { if (chars(String(v[key] || '').trim()) > n) errors[key] = `${n}자 이내로 적어 주세요.`; };

  if (need('name', blank(v.name))) { max('name', LIMITS.name); noEmail('name'); }

  if (need('dept', blank(v.dept))) {
    if (v.dept === '기타') {
      if (need('deptOther', blank(v.deptOther))) { max('deptOther', LIMITS.deptOther); noEmail('deptOther'); }
    } else if (!deptNames.includes(v.dept)) {
      errors.dept = '목록에서 골라 주세요.';
    }
  }

  if (need('email', blank(v.email)) && !SCHOOL_EMAIL.test(String(v.email).trim())) {
    errors.email = '@dit.ac.kr 로 끝나는 학교 이메일을 적어 주세요.';
  }

  if (need('appName', blank(v.appName))) { max('appName', LIMITS.appName); noEmail('appName'); }

  if (need('url', blank(v.url))) {
    const u = parseHttpUrl(v.url);
    if (!u || !/^https?:\/\//i.test(String(v.url).trim())) errors.url = 'http:// 또는 https:// 로 시작하는 주소를 적어 주세요.';
    else if (u.username || u.password) errors.url = '주소에 아이디·비밀번호를 넣지 마세요.';
    else if (isInternalHost(u.hostname)) errors.url = '학교 밖에서도 열리는 주소만 검사할 수 있습니다.';
  }

  if (need('desc', blank(v.desc))) { max('desc', LIMITS.desc); noEmail('desc'); }

  if (!blank(v.github)) {
    const u = parseHttpUrl(v.github);
    if (!u || !/^(www\.)?github\.com$/i.test(u.hostname) || u.pathname.split('/').filter(Boolean).length < 2) {
      errors.github = 'GitHub 저장소 주소(https://github.com/아이디/저장소)를 적어 주세요.';
    }
  }

  if (!blank(v.coauthors)) max('coauthors', LIMITS.coauthors);

  const shots = Array.isArray(v.shots) ? v.shots : [];
  if (shots.length > LIMITS.shots) errors.shots = `캡처는 ${LIMITS.shots}장까지 올릴 수 있습니다.`;
  else if (shots.some((s) => !/^image\//.test(s.type || ''))) errors.shots = '그림 파일(캡처)만 올려 주세요.';

  need('consent', v.consent !== true);
  need('noPii', v.noPii !== true);
  need('ownWork', v.ownWork !== true);

  return { ok: !missing.length && !Object.keys(errors).length, missing, errors };
}
