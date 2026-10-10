// 프로 노트 접수 창구 — 운영 시트 「프로 노트 운영」에 붙는 앱스 스크립트
// 하는 일: 앱이 보낸 「이메일만 든 출입증」을 구글에 확인하고, 승인 명단에서 그 이메일의 상태를 본다.
//          명단에 있으면 마지막 접속일(날짜만)을 적고, 「활동」이면 승인한다. 그 밖에는 아무것도 적지 않는다.
// 기록 시트를 열 수 있는 출입증은 받지 않는다 — 이메일만 든 출입증이 아니면 거절한다.
// 이 파일은 공개용 사본이다. 실제로 도는 것은 관리자의 운영 시트에 붙인 같은 코드다 — 고치면 둘을 함께 고친다.

const 앱_클라이언트ID = '297972351948-2fq40d61rpp8dngqmg36mn5kqhnp2ebq.apps.googleusercontent.com';
const 명단탭 = '승인 명단';
const 칸이름 = ['이메일', '이름', '소속', '상태', '추가일', '마지막 접속일', '비고'];

// 앱이 부르는 곳. 보내는 것: {"출입증": "..."}  돌려주는 것: {"결과": "승인" | "중단" | "없음" | "오류", ...}
function doPost(e) {
  let 답;
  try {
    답 = 확인(JSON.parse(e.postData.contents).출입증);
  } catch (err) {
    답 = { 결과: '오류', 까닭: String((err && err.message) || err) };
  }
  return ContentService.createTextOutput(JSON.stringify(답)).setMimeType(ContentService.MimeType.JSON);
}

function 확인(출입증) {
  if (!출입증) return { 결과: '오류', 까닭: '출입증 없음' };

  // 구글에 출입증 주인과 범위를 묻는다
  const r = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?access_token=' + encodeURIComponent(출입증),
                              { muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) return { 결과: '오류', 까닭: '출입증 확인 실패' };
  const 정보 = JSON.parse(r.getContentText());
  if (정보.aud !== 앱_클라이언트ID && 정보.azp !== 앱_클라이언트ID) return { 결과: '오류', 까닭: '다른 앱의 출입증' };
  if (/drive/.test(정보.scope || '')) return { 결과: '오류', 까닭: '기록용 출입증은 받지 않습니다' };
  if (!정보.email || String(정보.email_verified) !== 'true') return { 결과: '오류', 까닭: '이메일 확인 안 됨' };
  const 이메일 = 정보.email.trim().toLowerCase();

  const 잠금 = LockService.getScriptLock();
  잠금.waitLock(10000);
  try {
    const 탭 = SpreadsheetApp.getActive().getSheetByName(명단탭);
    if (!탭) return { 결과: '오류', 까닭: '「' + 명단탭 + '」 탭 없음' };
    const 값 = 탭.getDataRange().getValues();
    const 머리 = 값[0].map(v => String(v).trim());
    for (const n of ['이메일', '상태', '마지막 접속일']) {
      if (머리.indexOf(n) < 0) return { 결과: '오류', 까닭: '「' + n + '」 칸 없음' };
    }
    const 이메일칸 = 머리.indexOf('이메일'), 상태칸 = 머리.indexOf('상태'), 접속칸 = 머리.indexOf('마지막 접속일');

    for (let i = 1; i < 값.length; i++) {
      if (String(값[i][이메일칸]).trim().toLowerCase() !== 이메일) continue;
      const 활동 = String(값[i][상태칸]).trim() === '활동';
      탭.getRange(i + 1, 접속칸 + 1).setValue(오늘());   // 명단에 있는 사람은 「중단」이어도 날짜를 남긴다
      return { 결과: 활동 ? '승인' : '중단', 이메일: 이메일 };
    }
    return { 결과: '없음', 이메일: 이메일 };
  } finally {
    잠금.releaseLock();
  }
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
