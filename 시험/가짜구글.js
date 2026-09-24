// 가짜 구글 — 구글에 로그인하지 않고 앱을 돌려 보는 시험 도구.
// 시트를 메모리 안에 흉내 내고, 드라이브·시트 요청을 가로채 거기서 읽고 쓴다.
// 시험하기.ps1 이 index.html 의 구글 스크립트 자리에 이 파일을 끼워 넣은 시험 페이지를 만든다.
// 브라우저 콘솔에서 쓸 수 있는 손잡이:
//   __탭            지금 시트 내용 (탭 이름 → 줄 배열)
//   __느림 = 700    요청마다 기다리는 시간(ms). 휴대폰 통신을 흉내 낸다 (검수 10번)
//   __실패 = true   쓰기 요청을 전부 실패시킨다
(function () {
  const 오늘 = 자정(new Date());
  const 날 = n => 날짜글(하루뒤(오늘, n));
  const 이번주 = 주정보(오늘).기간, 지난주 = 주정보(하루뒤(오늘, -7)).기간;
  const 탭 = {
    '영역설정': [['영역ID','이름','기본/커스텀','일','주','분기','연','순서','수정시각','삭제됨'],
      ['base_action','실행 초점','기본','O','O','O','O','1','',''],
      ['base_constitution','체질 초점','기본','O','O','O','O','2','',''],
      ['base_goal','핵심 목표','기본','','','O','O','3','','']],
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
  window.__탭 = 탭;
  window.__느림 = 700; window.__실패 = false;
  const 열번호 = s => { let n = 0; for (const c of s) n = n * 26 + (c.charCodeAt(0) - 64); return n - 1; };
  const 범위 = r => { const m = r.match(/^'(.+)'!([A-Z]+)(\d+)/); return { 탭: m[1], 열: 열번호(m[2]), 행: Number(m[3]) - 1 }; };
  const 응답 = (o, s) => new Response(JSON.stringify(o), { status: s || 200 });
  window.fetch = async (url, opt) => {
    url = decodeURIComponent(url);
    await new Promise(r => setTimeout(r, window.__느림));
    if (window.__실패 && opt && opt.method === 'POST') return 응답({ error: '가짜 실패' }, 500);
    if (url.includes('/drive/v3/files?q=')) return 응답({ files: [{ id: 'S1', name: '가짜 시트' }] });
    if (url.includes('values:batchGet')) {
      const rs = [...url.matchAll(/ranges=([^&]+)/g)].map(m => m[1]);
      for (const r of rs) if (!탭[범위(r).탭]) return 응답({ error: 'Unable to parse range: ' + r }, 400);
      return 응답({ valueRanges: rs.map(r => ({ values: 탭[범위(r).탭].map(x => x.map(v => String(v))) })) });
    }
    if (url.includes('values:batchUpdate')) {
      JSON.parse(opt.body).data.forEach(d => { const p = 범위(d.range); const row = 탭[p.탭][p.행] || (탭[p.탭][p.행] = []); row[p.열] = d.values[0][0]; });
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
  window.google = { accounts: { oauth2: { initTokenClient: () => ({ requestAccessToken() {} }), hasGrantedAllScopes: () => true } } };
})();
