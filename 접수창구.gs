// 프로 노트 접수 창구 — 운영 시트 「프로 노트 운영」에 붙는 앱스 스크립트
// 하는 일: 앱이 보낸 「이메일만 든 출입증」을 구글에 확인하고, 승인 명단에서 그 이메일의 상태를 본다.
//          명단에 있으면 마지막 접속일(날짜만)을 적고, 「활동」이면 승인한다.
//          명단에 없는 사람이 「승인 요청 보내기」를 누르면 「대기」로 한 줄 넣고 관리자에게 메일을 보낸다.
//          그 밖에는 아무것도 적지 않는다.
// 기록 시트를 열 수 있는 출입증은 받지 않는다 — 이메일만 든 출입증이 아니면 거절한다.
// 이 파일은 공개용 사본이다. 실제로 도는 것은 관리자의 운영 시트에 붙인 같은 코드다 — 고치면 둘을 함께 고친다.

const 앱_클라이언트ID = '297972351948-2fq40d61rpp8dngqmg36mn5kqhnp2ebq.apps.googleusercontent.com';
const 명단탭 = '승인 명단';
const 칸이름 = ['이메일', '이름', '소속', '상태', '추가일', '마지막 접속일', '비고'];

// 앱이 부르는 곳.
//  확인: {"출입증": "..."}                          → {"결과": "승인" | "대기" | "중단" | "없음" | "오류"}
//  요청: {"출입증": "...", "요청": true, "이름": "..."} → {"결과": "요청됨" | "이미" | "오류"}
function doPost(e) {
  let 답;
  try {
    const 받은 = JSON.parse(e.postData.contents);
    답 = 받은.요청 ? 요청(받은.출입증, 받은.이름) : 확인(받은.출입증);
  } catch (err) {
    답 = { 결과: '오류', 까닭: String((err && err.message) || err) };
  }
  return ContentService.createTextOutput(JSON.stringify(답)).setMimeType(ContentService.MimeType.JSON);
}

// 출입증을 구글에 내밀어 주인 이메일을 알아낸다. 못 믿을 출입증이면 { 오류 }를 돌려준다
function 이메일알기(출입증) {
  if (!출입증) return { 오류: '출입증 없음' };
  const r = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?access_token=' + encodeURIComponent(출입증),
                              { muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) return { 오류: '출입증 확인 실패' };
  const 정보 = JSON.parse(r.getContentText());
  if (정보.aud !== 앱_클라이언트ID && 정보.azp !== 앱_클라이언트ID) return { 오류: '다른 앱의 출입증' };
  if (/drive/.test(정보.scope || '')) return { 오류: '기록용 출입증은 받지 않습니다' };
  if (!정보.email || String(정보.email_verified) !== 'true') return { 오류: '이메일 확인 안 됨' };
  return { 이메일: 정보.email.trim().toLowerCase() };
}

// 명단을 읽는다. 칸은 이름으로 찾는다 — 없으면 { 오류 }
function 명단() {
  const 탭 = SpreadsheetApp.getActive().getSheetByName(명단탭);
  if (!탭) return { 오류: '「' + 명단탭 + '」 탭 없음' };
  const 값 = 탭.getDataRange().getValues();
  const 머리 = 값[0].map(v => String(v).trim());
  for (const n of 칸이름) if (머리.indexOf(n) < 0) return { 오류: '「' + n + '」 칸 없음' };
  const 칸 = {}; 칸이름.forEach(n => 칸[n] = 머리.indexOf(n));
  return { 탭, 값, 칸 };
}

function 줄찾기(m, 이메일) {
  for (let i = 1; i < m.값.length; i++) if (String(m.값[i][m.칸['이메일']]).trim().toLowerCase() === 이메일) return i;
  return -1;
}

function 확인(출입증) {
  const 나 = 이메일알기(출입증);
  if (나.오류) return { 결과: '오류', 까닭: 나.오류 };
  const 잠금 = LockService.getScriptLock();
  잠금.waitLock(10000);
  try {
    const m = 명단();
    if (m.오류) return { 결과: '오류', 까닭: m.오류 };
    const i = 줄찾기(m, 나.이메일);
    if (i < 0) return { 결과: '없음', 이메일: 나.이메일 };
    m.탭.getRange(i + 1, m.칸['마지막 접속일'] + 1).setValue(오늘());   // 명단에 있는 사람은 날짜를 남긴다
    const 상태 = String(m.값[i][m.칸['상태']]).trim();
    return { 결과: 상태 === '활동' ? '승인' : 상태 === '대기' ? '대기' : '중단', 이메일: 나.이메일 };
  } finally {
    잠금.releaseLock();
  }
}

// 명단에 없는 사람이 앱의 「승인 요청 보내기」를 눌렀을 때만 온다 — 누른 사람만 기록된다
function 요청(출입증, 이름) {
  const 나 = 이메일알기(출입증);
  if (나.오류) return { 결과: '오류', 까닭: 나.오류 };
  이름 = String(이름 || '').trim().slice(0, 30);
  const 잠금 = LockService.getScriptLock();
  잠금.waitLock(10000);
  try {
    const m = 명단();
    if (m.오류) return { 결과: '오류', 까닭: m.오류 };
    if (줄찾기(m, 나.이메일) >= 0) return { 결과: '이미', 이메일: 나.이메일 };
    const 줄 = new Array(m.값[0].length).fill('');
    줄[m.칸['이메일']] = 나.이메일; 줄[m.칸['이름']] = 이름; 줄[m.칸['상태']] = '대기';
    줄[m.칸['추가일']] = 오늘(); 줄[m.칸['마지막 접속일']] = 오늘(); 줄[m.칸['비고']] = '앱에서 요청';
    m.탭.appendRow(줄);
  } finally {
    잠금.releaseLock();
  }
  MailApp.sendEmail(Session.getEffectiveUser().getEmail(),
    '프로 노트 승인 요청 — ' + 나.이메일 + (이름 ? ' (' + 이름 + ')' : ''),
    '운영 시트 「승인 명단」에서 상태를 「활동」으로 바꾸면 승인됩니다.\n' + SpreadsheetApp.getActive().getUrl());
  return { 결과: '요청됨', 이메일: 나.이메일 };
}

function 오늘() {
  return Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');
}

// 처음 한 번만 실행한다: 「승인 명단」 첫 줄에 칸 이름을 넣고, 둘째 줄에 실행한 관리자를 「활동」으로 넣는다.
// 첫 줄이 이미 차 있으면 아무것도 건드리지 않는다.
function 처음준비() {
  const 책 = SpreadsheetApp.getActive();
  const 탭 = 책.getSheetByName(명단탭) || 책.insertSheet(명단탭);
  if (String(탭.getRange(1, 1).getValue()).trim()) throw new Error('첫 줄이 이미 차 있어 건드리지 않았습니다');
  탭.getRange(1, 1, 1, 칸이름.length).setValues([칸이름]);
  탭.setFrozenRows(1);
  탭.getRange(2, 1).setValue(Session.getActiveUser().getEmail());
  탭.getRange(2, 4, 1, 2).setValues([['활동', 오늘()]]);
}

// 메일 보내기 권한을 받고, 알림 메일이 실제로 오는지 본다 (편집기에서 한 번 실행)
function 알림시험() {
  MailApp.sendEmail(Session.getEffectiveUser().getEmail(), '프로 노트 알림 시험',
    '승인 요청이 오면 이런 메일이 옵니다.\n' + SpreadsheetApp.getActive().getUrl());
}
