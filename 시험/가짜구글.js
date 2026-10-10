// 가짜 구글 — 구글에 로그인하지 않고 앱을 돌려 보는 시험 도구.
// 시트를 메모리 안에 흉내 내고, 드라이브·시트 요청을 가로채 거기서 읽고 쓴다.
// 시험하기.ps1 이 index.html 의 구글 스크립트 자리에 이 파일을 끼워 넣은 시험 페이지를 만든다.
// 브라우저 콘솔에서 쓸 수 있는 손잡이:
//   __탭            지금 시트 내용 (탭 이름 → 줄 배열)
//   __느림 = 700    요청마다 기다리는 시간(ms). 휴대폰 통신을 흉내 낸다 (검수 10번)
//   __실패 = true   쓰기 요청을 전부 실패시킨다
//   __요청수        지금까지 보낸 요청 수 (연타 합치기 확인용)
//   __승인 = '중단'  접수 창구의 답 — '승인'(기본) · '중단' · '없음' · '오류'(창구 고장 흉내)
//   __신분증 = '막힘'  이메일 출입증을 조용히 못 받는 경우 흉내('확인필요' 화면)
//   __창구에간것     창구로 보낸 본문들 — 기록용 출입증(FAKE)이 섞이지 않는지 본다
//   새 사람 시험: 주소 끝에 ?새사람 — 기록 시트가 없는 사람으로 시작한다 (?새사람&승인=없음 처럼 함께 쓴다)
(function () {
  const 오늘 = 자정(new Date());
  const 날 = n => 날짜글(하루뒤(오늘, n));
  const 이번주 = 주정보(오늘).기간, 지난주 = 주정보(하루뒤(오늘, -7)).기간;
  const 탭 = {
    '영역설정': [['영역ID','이름','기본/커스텀','일','주','분기','연','순서','수정시각','삭제됨'],
      ['base_action','실행 초점','기본','O','O','O','O','1','',''],
      ['base_constitution','체질 초점','기본','O','O','O','O','2','',''],
      ['base_goal','핵심 목표','기본','','','O','O','3','',''],
      ['ct_health','건강','커스텀','O','O','','','4','','']],
    // 옛 칸으로 만들어진 빈 주제설정 — 앱이 켜질 때 새 칸으로 바꿔 쓰는지 본다 (설계 5-7-1)
    '주제설정': [['주제ID','영역ID','영역','이름','상태','순서','수정시각','삭제됨']],
    '계획항목': [['항목ID','기간 단위','기간','영역ID','영역','주제ID','주제','계획','평가','평가메모','이월횟수','순서','수정시각','삭제됨'],
      ['it_w1','주',이번주,'base_action','실행 초점','','','이번 주 계획 가','','','0','1','',''],
      ['it_w2','주',이번주,'base_action','실행 초점','','','이번 주 계획 나','','','0','2','',''],
      ['it_w3','주',지난주,'base_action','실행 초점','','','지난주 계획','했다','','0','1','',''],
      ['it_y1','일',날(-1),'base_action','실행 초점','','','어제 계획 가','했다','','0','1','',''],
      ['it_y2','일',날(-1),'base_action','실행 초점','','','어제 계획 나','일부','','0','2','',''],
      ['it_t1','일',날(0),'base_constitution','체질 초점','tp_1','예시 주제','주제 붙은 계획','','','3','1','',''],
      ['it_t2','일',날(0),'base_constitution','체질 초점','','','주제 없는 계획','','','0','2','','']],
    '피드백': [['피드백ID','기간 단위','기간','영역ID','영역','피드백','수정시각','삭제됨'],
      ['fb_y','일',날(-1),'base_action','실행 초점','어제 피드백','','']],
    '일기': [['일기ID','기간 단위','기간','내용','수정시각','삭제됨']]
  };
  // 석 달치 건강 기록 — 영역 이름을 바꿀 때 사본을 한꺼번에 고치는 대기 시간을 본다
  for (let n = -90; n <= 0; n++) 탭['계획항목'].push(['it_h' + (n + 90), '일', 날(n), 'ct_health', '건강', '', '', '산책 ' + (n + 90), n < 0 ? '했다' : '', '', '0', '1', '', '']);
  let 시트있음 = !new URLSearchParams(location.search).has('새사람');
  if (!시트있음) for (const k of Object.keys(탭)) delete 탭[k];
  window.__탭 = 탭;
  window.__요청수 = 0;
  window.__느림 = 700; window.__실패 = false;
  const 주소값 = new URLSearchParams(location.search);   // 예: ?승인=중단 · ?신분증=막힘 — 켜질 때부터 그 상황으로
  window.__승인 = 주소값.get('승인') || '승인'; window.__신분증 = 주소값.get('신분증') || '됨'; window.__창구에간것 = [];
  localStorage.removeItem('pronote_승인');
  const 열번호 = s => { let n = 0; for (const c of s) n = n * 26 + (c.charCodeAt(0) - 64); return n - 1; };
  const 범위 = r => { const m = r.match(/^'(.+)'!([A-Z]+)(\d+)/); return { 탭: m[1], 열: 열번호(m[2]), 행: Number(m[3]) - 1 }; };
  const 응답 = (o, s) => new Response(JSON.stringify(o), { status: s || 200 });
  window.fetch = async (url, opt) => {
    url = decodeURIComponent(url);
    window.__요청수++;
    await new Promise(r => setTimeout(r, window.__느림));
    if (window.__실패 && opt && opt.method === 'POST') return 응답({ error: '가짜 실패' }, 500);
    if (url.startsWith('https://script.google.com/')) {
      window.__창구에간것.push(opt.body);
      const 받은 = JSON.parse(opt.body).출입증;
      if (window.__승인 === '오류' || 받은 !== 'FAKE_EMAIL') return 응답({ 결과: '오류', 까닭: '가짜 창구 오류' });
      return 응답({ 결과: window.__승인, 이메일: 'tester@example.com' });
    }
    if (url.includes('/drive/v3/about')) return 응답({ user: { emailAddress: 'tester@example.com' } });
    if (url.includes('/drive/v3/files?q=')) return 응답({ files: 시트있음 ? [{ id: 'S1', name: '가짜 시트' }] : [] });
    if (url.includes('/drive/v3/files?fields=id')) { 시트있음 = true; return 응답({ id: 'S1' }); }
    if (url.includes('?fields=sheets.properties')) return 응답({ sheets: [{ properties: { sheetId: 0, title: '시트1' } }] });
    if (url.endsWith(':batchUpdate') && !url.includes('values:')) return 응답({});
    if (url.includes('values:batchGet')) {
      const rs = [...url.matchAll(/ranges=([^&]+)/g)].map(m => m[1]);
      for (const r of rs) if (!탭[범위(r).탭]) return 응답({ error: 'Unable to parse range: ' + r }, 400);
      return 응답({ valueRanges: rs.map(r => ({ values: 탭[범위(r).탭].map(x => x.map(v => String(v))) })) });
    }
    if (url.includes('values:batchUpdate')) {
      JSON.parse(opt.body).data.forEach(d => {
        const p = 범위(d.range);
        if (!탭[p.탭]) 탭[p.탭] = [];
        d.values.forEach((줄, i) => { const row = 탭[p.탭][p.행 + i] || (탭[p.탭][p.행 + i] = []); 줄.forEach((v, j) => { row[p.열 + j] = String(v); }); });
      });
      return 응답({});
    }
    if (url.includes(':append')) {
      const t = url.match(/values\/'(.+)'!A1:append/)[1];
      탭[t].push(JSON.parse(opt.body).values[0].map(v => String(v)));
      return 응답({});
    }
    return 응답({ error: '가짜 구글이 모르는 요청: ' + url }, 404);
  };
  localStorage.setItem('pronote_token', JSON.stringify({ t: 'FAKE', 만료: Date.now() + 3600e3 }));
  // 기록용 출입증은 위에서 미리 넣어 둔다. 이메일 출입증(신분증)은 요청하면 잠시 뒤 준다
  window.google = { accounts: { oauth2: {
    initTokenClient: cfg => ({ requestAccessToken(o) {
      setTimeout(() => {
        if (cfg.scope !== 'email') cfg.callback({ access_token: 'FAKE', expires_in: 3600 });
        else if (window.__신분증 === '막힘' && o && o.prompt === '') cfg.error_callback({ type: 'popup_failed_to_open' });
        else cfg.callback({ access_token: 'FAKE_EMAIL' });
      }, window.__느림);
    } }),
    hasGrantedAllScopes: () => true } } };
})();
