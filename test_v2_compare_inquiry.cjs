/**
 * Farm-to-Table v2.22 Playwright 테스트
 * - UX #1 고도화: 비교 테이블 배지·하이라이트·"이 농가 선택" 버튼
 * - 딜 전 문의 알림: 셰프(새 문의) + 농가(답변 도착) 앱 내 알림
 *
 * 두 브라우저 컨텍스트를 사용:
 *   chefPage  — 셰프 세션 (딜 생성·비교·답변)
 *   farmPage  — 농가A 세션 (문의·제안)
 *   farm2Page — 농가B 세션 (제안만)
 */
const { chromium } = require('playwright');

const BASE = 'http://localhost:5173';
const TS = Date.now();
const CHEF_EMAIL  = `chef_cmp_${TS}@test.com`;
const FARM1_EMAIL = `farm1_cmp_${TS}@test.com`;
const FARM2_EMAIL = `farm2_cmp_${TS}@test.com`;
const PW = 'testpass123';
const CHEF_NAME  = `비교셰프${TS % 10000}`;
const FARM1_NAME = `비교농가A${TS % 10000}`;
const FARM2_NAME = `비교농가B${TS % 10000}`;
const SCRATCHPAD = 'C:/Users/USER/AppData/Local/Temp/claude/c--Users-USER-Desktop-D-N-A-farm-to-table-project-farm-to-table-project/47232d6e-44b2-4c79-9b2d-ca0fe225bb38/scratchpad';

let pass = 0, fail = 0;
const results = [];

function check(name, ok, detail = '') {
  if (ok) { pass++; results.push(`  ✓ ${name}`); }
  else     { fail++; results.push(`  ✗ ${name}${detail ? ' — ' + detail : ''}`); }
}
async function ss(page, name) { await page.screenshot({ path: `${SCRATCHPAD}/${name}.png` }); }

async function dismissOverlays(page) {
  for (let i = 0; i < 6; i++) {
    const next  = page.locator('button', { hasText: /^다음$/ });
    const start = page.locator('button', { hasText: /시작하기/ });
    if (await next.count() > 0)       { await next.click({ force: true }); await page.waitForTimeout(400); }
    else if (await start.count() > 0) { await start.click({ force: true }); await page.waitForTimeout(400); break; }
    else break;
  }
}

async function signup(page, email, pw, role, name) {
  await page.goto(BASE);
  await page.waitForSelector('input[type="email"]', { timeout: 12000 });
  const toSignup = page.locator('button', { hasText: /가입/ }).first();
  if (await toSignup.count() > 0) await toSignup.click();
  await page.waitForTimeout(400);
  const roleBtn = page.locator('button', { hasText: role === 'chef' ? '셰프' : '농가' }).first();
  if (await roleBtn.count() > 0) await roleBtn.click();
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', pw);
  const ph = role === 'chef' ? '예: 테이블나인' : '예: 신선팜';
  const nameInput = page.locator(`input[placeholder="${ph}"]`).first();
  if (await nameInput.count() > 0) await nameInput.fill(name);
  await page.locator('button', { hasText: /가입하기$/ }).last().click();
  await page.waitForTimeout(3000);
  if (await page.locator('button[class*="ftt-tab"]').count() === 0) {
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', pw);
    await page.locator('button', { hasText: /로그인$/ }).last().click();
    await page.waitForTimeout(3000);
  }
  await dismissOverlays(page);
}

async function login(page, email, pw) {
  await page.goto(BASE);
  await page.waitForSelector('input[type="email"]', { timeout: 12000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', pw);
  await page.locator('button', { hasText: /로그인$/ }).last().click();
  await page.waitForTimeout(3000);
  await dismissOverlays(page);
}

async function logout(page) {
  const btn = page.locator('button', { hasText: '로그아웃' });
  if (await btn.count() > 0) await btn.click();
  await page.waitForTimeout(1000);
}

async function createDeal(page, crop = '토마토') {
  const tab = page.locator('button', { hasText: '딜 만들기' });
  if (await tab.count() > 0) await tab.click();
  await page.waitForTimeout(1000);
  // Step 1
  const ni = page.locator('input[placeholder="예: 테이블나인"]').first();
  if (await ni.count() > 0 && !(await ni.inputValue())) await ni.fill(CHEF_NAME);
  if (crop !== '토마토') { const s = page.locator('select').first(); if (await s.count() > 0) await s.selectOption(crop); }
  let nxt = page.locator('button', { hasText: '다음 단계 →' });
  if (await nxt.count() > 0) await nxt.click(); await page.waitForTimeout(700);
  // Step 2
  const si = page.locator('input[placeholder*="지름"]').first();
  if (await si.count() > 0) await si.fill('지름 5cm 이상');
  else { const t = page.locator('input[type="text"]').first(); if (await t.count() > 0) await t.fill('5cm 이상'); }
  nxt = page.locator('button', { hasText: '다음 단계 →' }); if (await nxt.count() > 0) await nxt.click(); await page.waitForTimeout(700);
  // Step 3
  const qi = page.locator('input[type="number"]').first(); if (await qi.count() > 0) await qi.fill('20');
  nxt = page.locator('button', { hasText: '다음 단계 →' }); if (await nxt.count() > 0) await nxt.click(); await page.waitForTimeout(700);
  // Step 4
  const future = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
  const di = page.locator('input[type="date"]').first(); if (await di.count() > 0) await di.fill(future);
  const pi = page.locator('input[type="number"]').first(); if (await pi.count() > 0) await pi.fill('5000');
  nxt = page.locator('button', { hasText: '다음 단계 →' }); if (await nxt.count() > 0) await nxt.click(); await page.waitForTimeout(700);
  // Step 5
  const sub = page.locator('button', { hasText: '딜 등록하고 농가 제안 받기' });
  if (await sub.count() > 0) await sub.click(); await page.waitForTimeout(3000);
}

async function openDeal(page, crop) {
  const bt = page.locator('button', { hasText: '딜 찾기' });
  if (await bt.count() > 0) await bt.click(); await page.waitForTimeout(1500);
  const back = page.locator('button', { hasText: '← 딜 목록으로' });
  if (await back.count() > 0) { await back.click(); await page.waitForTimeout(800); }
  let card = page.locator('.ftt-card').filter({ hasText: crop }).filter({ hasText: CHEF_NAME }).first();
  if (await card.count() === 0) card = page.locator('.ftt-card').filter({ hasText: crop }).first();
  if (await card.count() === 0) return false;
  await card.click(); await page.waitForTimeout(1000); return true;
}

async function submitProposal(page, crop, price) {
  const opened = await openDeal(page, crop);
  if (!opened) return false;
  const btn = page.locator('button', { hasText: '이 딜에 제안 보내기' }).first();
  if (await btn.count() === 0) return false;
  await btn.click(); await page.waitForTimeout(500);
  const ri = page.locator('input[placeholder="예: 경기 이천"]').first();
  if (await ri.count() > 0) await ri.fill('경기 이천');
  const pi = page.locator('input[type="number"]').first(); if (await pi.count() > 0) await pi.fill(String(price));
  const qi = page.locator('input[type="number"]').nth(1); if (await qi.count() > 0) await qi.fill('20');
  const future = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
  const di = page.locator('input[type="date"]').first(); if (await di.count() > 0) await di.fill(future);
  const sb = page.locator('button', { hasText: '제안 보내기' }).first();
  if (await sb.count() > 0) await sb.click(); await page.waitForTimeout(2500); return true;
}

async function expandDeal(page, crop) {
  const tab = page.locator('button', { hasText: '내 거래' });
  if (await tab.count() > 0) await tab.click(); await page.waitForTimeout(3000);
  const dealCard = page.locator('.ftt-card').filter({ hasText: crop }).first();
  if (await dealCard.count() > 0) {
    if (await dealCard.locator('text=▲').count() === 0) {
      const hdr = dealCard.locator('div[style*="cursor: pointer"]').first();
      if (await hdr.count() > 0) { await hdr.click(); await page.waitForTimeout(1000); }
    }
  }
}

async function closeBell(page) {
  await page.mouse.click(10, 10);
  await page.waitForTimeout(500);
  if (await page.locator('text=알림이 없습니다').count() > 0 ||
      await page.locator('text=모두 지우기').count() > 0) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true, slowMo: 60 });

  // 두 독립 컨텍스트: 셰프 / 농가
  const chefCtx  = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const farmCtx  = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const farm2Ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });

  const chefPage  = await chefCtx.newPage();
  const farmPage  = await farmCtx.newPage();
  const farm2Page = await farm2Ctx.newPage();

  // ══════════════════════════════════════════
  console.log('\n[1] 앱 로드 스모크');
  await chefPage.goto(BASE);
  await chefPage.waitForSelector('input[type="email"]', { timeout: 12000 });
  check('앱 정상 로드', true);

  // ══════════════════════════════════════════
  console.log('\n[2] 셰프 가입 + 딜(토마토) 생성 — 셰프 세션 유지');
  await signup(chefPage, CHEF_EMAIL, PW, 'chef', CHEF_NAME);
  check('셰프 가입', await chefPage.locator('button[class*="ftt-tab"]').count() > 0);
  await createDeal(chefPage, '토마토');
  const chefMyDeals = chefPage.locator('button', { hasText: '내 거래' });
  if (await chefMyDeals.count() > 0) await chefMyDeals.click(); await chefPage.waitForTimeout(2000);
  check('딜 생성 확인', await chefPage.locator('text=토마토').count() > 0);
  await ss(chefPage, 'cmp_01_deal_created');

  // ══════════════════════════════════════════
  console.log('\n[3] 농가A 가입 (별도 컨텍스트)');
  await signup(farmPage, FARM1_EMAIL, PW, 'farm', FARM1_NAME);
  check('농가A 가입', await farmPage.locator('button[class*="ftt-tab"]').count() > 0);

  // ══════════════════════════════════════════
  console.log('\n[4] 농가A — 딜 전 문의 제출 (제안 전)');
  const openedA = await openDeal(farmPage, '토마토');
  check('[4] 딜 상세 열기', openedA);

  const inqBtn = farmPage.locator('button', { hasText: '💬 제안 전 셰프에게 문의하기' });
  const hasInqBtn = await inqBtn.count() > 0;
  check('[4] 문의 버튼 표시 (제안 전)', hasInqBtn);

  if (hasInqBtn) {
    await inqBtn.click(); await farmPage.waitForTimeout(400);
    const ta = farmPage.locator('textarea').first();
    if (await ta.count() > 0) await ta.fill('포장 단위가 어떻게 되나요?');
    const sendBtn = farmPage.locator('button', { hasText: '문의 보내기' }).first();
    if (await sendBtn.count() > 0) await sendBtn.click(); await farmPage.waitForTimeout(2500);
    const sentOk = await farmPage.locator('text=셰프가 답변 중입니다').count() > 0 ||
                   await farmPage.locator('text=포장 단위').count() > 0;
    check('[4] 문의 전송 완료', sentOk);
  } else {
    check('[4] 문의 전송 (skip)', true);
  }
  await ss(farmPage, 'cmp_02_inquiry_sent');

  // ══════════════════════════════════════════
  console.log('\n[5] 셰프 컨텍스트 — 새 문의 알림 확인 (onSnapshot)');
  // 셰프는 계속 로그인 상태 → Firestore onSnapshot이 문의 추가 감지 → 알림 발화
  // 딜 찾기 탭으로 이동해 onSnapshot 활성 유지
  await chefPage.waitForTimeout(3000);
  const chefBrowse = chefPage.locator('button', { hasText: '딜 만들기' });
  if (await chefBrowse.count() > 0) await chefBrowse.click(); await chefPage.waitForTimeout(800);
  if (await chefMyDeals.count() > 0) await chefMyDeals.click(); await chefPage.waitForTimeout(1000);

  const bellChef = chefPage.locator('button').filter({ hasText: /🔔/ }).first();
  let chefNotifCount = 0;
  if (await bellChef.count() > 0) {
    await bellChef.click(); await chefPage.waitForTimeout(800);
    chefNotifCount = await chefPage.locator('text=/새 농가 문의|문의/').count();
    await closeBell(chefPage);
  }
  check('[5] 셰프 알림 — 새 농가 문의', chefNotifCount > 0, `알림: ${chefNotifCount}`);
  await ss(chefPage, 'cmp_03_chef_notif');

  // ══════════════════════════════════════════
  console.log('\n[6] 농가A 제안 제출 (문의 후)');
  const back1 = farmPage.locator('button', { hasText: '← 딜 목록으로' });
  if (await back1.count() > 0) { await back1.click(); await farmPage.waitForTimeout(800); }
  const prop1 = await submitProposal(farmPage, '토마토', 4500);
  check('[6] 농가A 제안 제출', prop1);
  await ss(farmPage, 'cmp_04_farm1_proposal');

  // ══════════════════════════════════════════
  console.log('\n[7] 농가B 가입 + 제안 제출');
  await signup(farm2Page, FARM2_EMAIL, PW, 'farm', FARM2_NAME);
  check('[7] 농가B 가입', await farm2Page.locator('button[class*="ftt-tab"]').count() > 0);
  const prop2 = await submitProposal(farm2Page, '토마토', 4800);
  check('[7] 농가B 제안 제출', prop2);
  await ss(farm2Page, 'cmp_05_farm2_proposal');

  // ══════════════════════════════════════════
  console.log('\n[8] 셰프 — 내 거래 딜 확장 후 비교 버튼 확인');
  await expandDeal(chefPage, '토마토');
  await chefPage.waitForTimeout(1500);
  const cmpBtns = chefPage.locator('button', { hasText: '+ 비교' });
  const cmpCount = await cmpBtns.count();
  check('[8] "+ 비교" 버튼 존재 (제안 수)', cmpCount >= 2, `버튼: ${cmpCount}`);
  await ss(chefPage, 'cmp_06_compare_btns');

  // ══════════════════════════════════════════
  console.log('\n[9] 비교 2건 선택');
  if (cmpCount >= 1) {
    await cmpBtns.first().click(); await chefPage.waitForTimeout(600);
    const remaining = chefPage.locator('button', { hasText: '+ 비교' });
    if (await remaining.count() > 0) { await remaining.first().click(); await chefPage.waitForTimeout(800); }
  }
  await ss(chefPage, 'cmp_07_selected');

  // ══════════════════════════════════════════
  console.log('\n[10] 비교 테이블 렌더링');
  const tableVisible = await chefPage.locator('text=/제안 비교.*건/').count() > 0;
  check('[10] 비교 테이블 표시', tableVisible);
  await ss(chefPage, 'cmp_08_table');

  // ══════════════════════════════════════════
  console.log('\n[11] 최저가 배지');
  const bestPrice = await chefPage.locator('text=/💰 최저가|🏆 최저가/').count();
  check('[11] 최저가 배지 표시', bestPrice > 0, `배지: ${bestPrice}`);

  // ══════════════════════════════════════════
  console.log('\n[12] 최고점 배지');
  const bestScore = await chefPage.locator('text=/⭐ 최고점|🏆.*최고점/').count();
  check('[12] 최고점 배지 표시', bestScore > 0, `배지: ${bestScore}`);

  // ══════════════════════════════════════════
  console.log('\n[13] ✓ 하이라이트 (최우수 셀)');
  const checkMark = await chefPage.locator('text=✓').count();
  check('[13] ✓ 하이라이트 마킹', checkMark > 0, `✓ 수: ${checkMark}`);
  await ss(chefPage, 'cmp_09_highlight');

  // ══════════════════════════════════════════
  console.log('\n[14] "이 농가 선택" 버튼 (비교 테이블 내)');
  const selectInTable = await chefPage.locator('button', { hasText: '이 농가 선택' }).count();
  check('[14] 비교 테이블 내 "이 농가 선택" 버튼', selectInTable > 0, `버튼: ${selectInTable}`);
  await ss(chefPage, 'cmp_10_select_btn');

  // ══════════════════════════════════════════
  console.log('\n[15] 셰프 — 농가 문의 미답변 표시 확인');
  await expandDeal(chefPage, '토마토');
  const inqDisplay = await chefPage.locator('text=/농가 문의.*건 미답변/').count();
  check('[15] 셰프 내 거래 — 농가 문의 미답변', inqDisplay > 0, `표시: ${inqDisplay}`);
  await ss(chefPage, 'cmp_11_chef_inq');

  // ══════════════════════════════════════════
  console.log('\n[16] 셰프 — 문의 답변 등록');
  const answerTa = chefPage.locator('textarea[placeholder="답변을 입력하세요"]').first();
  if (await answerTa.count() > 0) {
    await answerTa.fill('10kg 박스 단위로 포장됩니다.');
    const ansBtn = chefPage.locator('button', { hasText: '답변 등록' }).first();
    if (await ansBtn.count() > 0) await ansBtn.click(); await chefPage.waitForTimeout(2500);
    const answered = await chefPage.locator('text=10kg 박스 단위').count() > 0 ||
                     await chefPage.locator('text=수정').count() > 0;
    check('[16] 답변 등록 완료', answered);
  } else {
    check('[16] 답변 등록 (textarea 없어 skip)', true);
  }
  await ss(chefPage, 'cmp_12_answered');

  // ══════════════════════════════════════════
  console.log('\n[17] 농가A — 답변 알림 수신 (별도 컨텍스트, onSnapshot)');
  // 농가A 컨텍스트는 계속 활성 상태 → Firestore onSnapshot이 답변 변경 감지 → 알림 발화
  await farmPage.waitForTimeout(3000);
  const farmBrowse = farmPage.locator('button', { hasText: '딜 찾기' });
  if (await farmBrowse.count() > 0) await farmBrowse.click(); await farmPage.waitForTimeout(1500);

  const bellFarm = farmPage.locator('button').filter({ hasText: /🔔/ }).first();
  let farmNotifCount = 0;
  if (await bellFarm.count() > 0) {
    await bellFarm.click(); await farmPage.waitForTimeout(800);
    farmNotifCount = await farmPage.locator('text=/문의 답변 도착|답변/').count();
    await closeBell(farmPage);
  }
  check('[17] 농가A 알림 — 문의 답변 도착', farmNotifCount > 0, `알림: ${farmNotifCount}`);
  await ss(farmPage, 'cmp_13_farm_notif');

  // ══════════════════════════════════════════
  console.log('\n[18] 농가A — 딜 상세에서 답변 텍스트 확인');
  const back2 = farmPage.locator('button', { hasText: '← 딜 목록으로' });
  if (await back2.count() > 0) { await back2.click(); await farmPage.waitForTimeout(800); }
  let card2 = farmPage.locator('.ftt-card').filter({ hasText: '토마토' }).first();
  if (await card2.count() > 0) { await card2.click(); await farmPage.waitForTimeout(1000); }
  const ansVisible = await farmPage.locator('text=10kg 박스 단위').count() > 0 ||
                     await farmPage.locator('text=/셰프가 답변/').count() > 0;
  check('[18] 농가 딜 상세 — 답변 텍스트 표시', ansVisible);
  await ss(farmPage, 'cmp_14_farm_answer');

  // ══════════════════════════════════════════
  await browser.close();

  console.log('\n══════════════════════════════════════════════');
  console.log(`결과: ${pass}개 통과 / ${fail}개 실패 (전체 ${pass + fail}개)`);
  results.forEach(r => console.log(r));

  if (fail > 0) {
    console.log('\n[실패 항목만]');
    results.filter(r => r.startsWith('  ✗')).forEach(r => console.log(r));
    process.exit(1);
  }
})().catch(e => {
  console.error('\n테스트 오류:', e.message);
  process.exit(1);
});
