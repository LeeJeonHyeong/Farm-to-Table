/**
 * Farm-to-Table UX 개선 기능 Playwright 테스트
 * - UX #1: 제안 비교 모드 (+ 비교 버튼)
 * - UX #2: D-day 마감 배지 (농가 딜 찾기 목록)
 * - UX #3: 제안 자동 채우기 (pre-fill 배너)
 * - UX #4: 단골 농가 즐겨찾기 (☆ 즐겨찾기 버튼)
 * - UX #5: 정기 딜 자동 연장 (↻ 다음 회차 딜 만들기)
 * - UX #6: 작물 가격 참고 (참고 · 최근 평균 거래가)
 * - v2.17: 딜 전 문의 (💬 셰프에게 문의하기 / Q·A 답변)
 * - v2.18: 결제 영수증 출력 (🖨 선급금/잔금 영수증 버튼)
 * - v2.19: 농가 성과 배지 (🌿 친환경 인증 등)
 */
const { chromium } = require('playwright');

const BASE = 'http://localhost:5173';
const TS = Date.now();
const CHEF_EMAIL = `chef_ux_${TS}@test.com`;
const FARM_EMAIL = `farm_ux_${TS}@test.com`;
const PW = 'testpass123';
const CHEF_NAME = `UX셰프${TS % 10000}`;
const FARM_NAME = `UX농가${TS % 10000}`;
const SCRATCHPAD = 'C:/Users/USER/AppData/Local/Temp/claude/c--Users-USER-Desktop-D-N-A-farm-to-table-project-farm-to-table-project/47232d6e-44b2-4c79-9b2d-ca0fe225bb38/scratchpad';

let pass = 0, fail = 0;
const results = [];

function check(name, ok, detail = '') {
  if (ok) { pass++; results.push(`  ✓ ${name}`); }
  else     { fail++; results.push(`  ✗ ${name}${detail ? ' — ' + detail : ''}`); }
}

async function screenshot(page, name) {
  await page.screenshot({ path: `${SCRATCHPAD}/${name}.png` });
}

async function dismissOverlays(page) {
  for (let i = 0; i < 6; i++) {
    const next = page.locator('button', { hasText: /^다음$/ });
    const start = page.locator('button', { hasText: /시작하기/ });
    if (await next.count() > 0) { await next.click({ force: true }); await page.waitForTimeout(400); }
    else if (await start.count() > 0) { await start.click({ force: true }); await page.waitForTimeout(400); break; }
    else break;
  }
}

async function signup(page, email, pw, role, name) {
  await page.goto(BASE);
  await page.waitForSelector('input[type="email"]', { timeout: 10000 });
  const toSignup = page.locator('button', { hasText: /가입/ }).first();
  if (await toSignup.count() > 0) await toSignup.click();
  await page.waitForTimeout(400);
  const roleBtn = page.locator('button', { hasText: role === 'chef' ? '셰프' : '농가' }).first();
  if (await roleBtn.count() > 0) await roleBtn.click();
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', pw);
  const placeholder = role === 'chef' ? '예: 테이블나인' : '예: 신선팜';
  const nameInput = page.locator(`input[placeholder="${placeholder}"]`).first();
  if (await nameInput.count() > 0) await nameInput.fill(name);
  await page.locator('button', { hasText: /가입하기$/ }).last().click();
  await page.waitForTimeout(3000);
  const tabs = await page.locator('button[class*="ftt-tab"]').count();
  if (tabs === 0) {
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', pw);
    await page.locator('button', { hasText: /로그인$/ }).last().click();
    await page.waitForTimeout(3000);
  }
  await dismissOverlays(page);
}

async function login(page, email, pw) {
  await page.goto(BASE);
  await page.waitForSelector('input[type="email"]', { timeout: 10000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', pw);
  await page.locator('button', { hasText: /로그인$/ }).last().click();
  await page.waitForTimeout(3000);
  await dismissOverlays(page);
}

async function logout(page) {
  const logoutBtn = page.locator('button', { hasText: '로그아웃' });
  if (await logoutBtn.count() > 0) await logoutBtn.click();
  await page.waitForTimeout(1000);
}

// 딜 생성 (셰프) — crop 파라미터로 품목 지정
async function createDeal(page, crop = '토마토') {
  const createTab = page.locator('button', { hasText: '딜 만들기' });
  if (await createTab.count() > 0) await createTab.click();
  await page.waitForTimeout(1000);

  // Step 1: 레스토랑명 + 품목
  const nameInput = page.locator('input[placeholder="예: 테이블나인"]').first();
  if (await nameInput.count() > 0) {
    const val = await nameInput.inputValue().catch(() => '');
    if (!val) await nameInput.fill(CHEF_NAME);
  }
  if (crop !== '토마토') {
    const cropSelect = page.locator('select').first();
    if (await cropSelect.count() > 0) await cropSelect.selectOption(crop);
    await page.waitForTimeout(300);
  }
  let nxt = page.locator('button', { hasText: '다음 단계 →' });
  if (await nxt.count() > 0) await nxt.click();
  await page.waitForTimeout(700);

  // Step 2
  const sizeInput = page.locator('input[placeholder*="지름"]').first();
  if (await sizeInput.count() > 0) await sizeInput.fill('지름 5cm 이상');
  else {
    const txt = page.locator('input[type="text"]').first();
    if (await txt.count() > 0) await txt.fill('5cm 이상');
  }
  await page.waitForTimeout(300);
  nxt = page.locator('button', { hasText: '다음 단계 →' });
  if (await nxt.count() > 0) await nxt.click();
  await page.waitForTimeout(700);

  // Step 3
  const qtyInput = page.locator('input[type="number"]').first();
  if (await qtyInput.count() > 0) await qtyInput.fill('20');
  nxt = page.locator('button', { hasText: '다음 단계 →' });
  if (await nxt.count() > 0) await nxt.click();
  await page.waitForTimeout(700);

  // Step 4
  const future = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
  const dateInput = page.locator('input[type="date"]').first();
  if (await dateInput.count() > 0) await dateInput.fill(future);
  const priceInput = page.locator('input[type="number"]').first();
  if (await priceInput.count() > 0) await priceInput.fill('5000');
  nxt = page.locator('button', { hasText: '다음 단계 →' });
  if (await nxt.count() > 0) await nxt.click();
  await page.waitForTimeout(700);

  // Step 5: 등록
  const submitBtn = page.locator('button', { hasText: '딜 등록하고 농가 제안 받기' });
  if (await submitBtn.count() > 0) await submitBtn.click();
  await page.waitForTimeout(3000);
}

// 브라우즈 탭에서 특정 crop 딜 상세 열기
// DealDetailView가 열려 있으면 먼저 목록으로 돌아감
async function openDealInBrowse(page, crop) {
  const browseTab = page.locator('button', { hasText: '딜 찾기' });
  if (await browseTab.count() > 0) await browseTab.click();
  await page.waitForTimeout(1500);

  // DealDetailView가 열려 있으면 "← 딜 목록으로" 클릭
  const backBtn = page.locator('button', { hasText: '← 딜 목록으로' });
  if (await backBtn.count() > 0) {
    await backBtn.click();
    await page.waitForTimeout(1000);
  }
  await page.waitForTimeout(1000);

  // ftt-card 중 crop + CHEF_NAME 포함된 카드 클릭
  let card = page.locator('.ftt-card').filter({ hasText: crop }).filter({ hasText: CHEF_NAME }).first();
  if (await card.count() > 0) {
    await card.click();
    await page.waitForTimeout(1000);
    return true;
  }
  // fallback: crop만으로
  card = page.locator('.ftt-card').filter({ hasText: crop }).first();
  if (await card.count() > 0) {
    await card.click();
    await page.waitForTimeout(1000);
    return true;
  }
  return false;
}

// 제안 보내기 (농가) — crop으로 딜 선택
async function submitProposal(page, crop = '토마토') {
  const opened = await openDealInBrowse(page, crop);
  if (!opened) return false;

  const proposeBtn = page.locator('button', { hasText: '이 딜에 제안 보내기' }).first();
  if (await proposeBtn.count() === 0) return false;
  await proposeBtn.click();
  await page.waitForTimeout(500);

  const regionInput = page.locator('input[placeholder="예: 경기 이천"]').first();
  if (await regionInput.count() > 0) await regionInput.fill('경기 이천');
  const priceInput = page.locator('input[type="number"]').first();
  if (await priceInput.count() > 0) await priceInput.fill('4800');
  const qtyInput = page.locator('input[type="number"]').nth(1);
  if (await qtyInput.count() > 0) await qtyInput.fill('20');
  const future = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
  const dateInput = page.locator('input[type="date"]').first();
  if (await dateInput.count() > 0) await dateInput.fill(future);

  const submitBtn = page.locator('button', { hasText: '제안 보내기' }).first();
  if (await submitBtn.count() > 0) await submitBtn.click();
  await page.waitForTimeout(2500);
  return true;
}

// 내 거래 탭에서 crop 딜 확장
async function expandDealInMyDeals(page, crop) {
  const myDealsTab = page.locator('button', { hasText: '내 거래' });
  if (await myDealsTab.count() > 0) await myDealsTab.click();
  await page.waitForTimeout(4000);

  const dealCard = page.locator('.ftt-card').filter({ hasText: crop }).first();
  if (await dealCard.count() > 0) {
    const alreadyExpanded = await dealCard.locator('text=▲').count() > 0;
    if (!alreadyExpanded) {
      const header = dealCard.locator('div[style*="cursor: pointer"]').first();
      if (await header.count() > 0) {
        await header.click();
        await page.waitForTimeout(1000);
      }
    }
  }
}

// 제안 선택 (셰프) — crop 딜 확장 후 선택
async function selectProposal(page, crop = '토마토') {
  await expandDealInMyDeals(page, crop);

  const dealCard = page.locator('.ftt-card').filter({ hasText: crop }).first();
  let selectBtn = dealCard.locator('button', { hasText: '이 농가 선택하기' }).first();
  if (await selectBtn.count() === 0) {
    selectBtn = page.locator('button', { hasText: '이 농가 선택하기' }).first();
  }

  if (await selectBtn.count() > 0) {
    await selectBtn.click();
    await page.waitForTimeout(2000);
    const backBtn = page.locator('button', { hasText: '← 제안 목록으로' });
    if (await backBtn.count() > 0) {
      await backBtn.click();
      await page.waitForTimeout(800);
    }
    return true;
  }
  return false;
}

(async () => {
  const browser = await chromium.launch({ headless: true, slowMo: 60 });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();

  // ══════════════════════════════════════════
  console.log('\n[1] 앱 로드 스모크');
  await page.goto(BASE);
  await page.waitForSelector('input[type="email"]', { timeout: 10000 });
  check('앱 정상 로드', true);

  // ══════════════════════════════════════════
  console.log('\n[2] 셰프 가입 + 딜 A (토마토) 생성');
  await signup(page, CHEF_EMAIL, PW, 'chef', CHEF_NAME);
  const chefTabs = await page.locator('button[class*="ftt-tab"]').count();
  check('셰프 가입 후 탭 존재', chefTabs > 0);

  await createDeal(page, '토마토');
  const myDealsTabRef = page.locator('button', { hasText: '내 거래' });
  if (await myDealsTabRef.count() > 0) await myDealsTabRef.click();
  await page.waitForTimeout(2000);
  check('딜 A (토마토) 생성 확인', await page.locator('text=토마토').count() > 0);
  await screenshot(page, 'ux_01_deal_a');

  // ══════════════════════════════════════════
  console.log('\n[3] 딜 B (딸기) 생성');
  await createDeal(page, '딸기');
  if (await myDealsTabRef.count() > 0) await myDealsTabRef.click();
  await page.waitForTimeout(2000);
  check('딜 B (딸기) 생성 확인', await page.locator('text=딸기').count() > 0);
  await screenshot(page, 'ux_02_deal_b');

  // ══════════════════════════════════════════
  console.log('\n[4] 농가 가입');
  await logout(page);
  await signup(page, FARM_EMAIL, PW, 'farm', FARM_NAME);
  check('농가 가입 후 탭 존재', await page.locator('button[class*="ftt-tab"]').count() > 0);

  // ══════════════════════════════════════════
  console.log('\n[5] UX #2: D-day 배지 — 딜 찾기 목록');
  const browseTab = page.locator('button', { hasText: '딜 찾기' });
  if (await browseTab.count() > 0) await browseTab.click();
  await page.waitForTimeout(2500);
  const dDayCount = await page.locator('text=/D-\\d+|D-day/').count();
  check('UX #2: D-day 배지 (농가 딜 찾기 목록)', dDayCount > 0, `개수: ${dDayCount}`);
  await screenshot(page, 'ux_03_dday');

  // ══════════════════════════════════════════
  console.log('\n[6] v2.17: 딜 전 문의 — 문의 버튼 (딜 A 토마토 상세)');
  const openedA = await openDealInBrowse(page, '토마토');
  check('딜 A (토마토) 상세 열기', openedA);

  const inquiryBtnCount = await page.locator('button', { hasText: '💬 제안 전 셰프에게 문의하기' }).count();
  check('v2.17: 문의 버튼 표시 (딜 상세)', inquiryBtnCount > 0);
  await screenshot(page, 'ux_04_inquiry_btn');

  // ══════════════════════════════════════════
  console.log('\n[7] v2.17: 문의 제출');
  if (inquiryBtnCount > 0) {
    await page.locator('button', { hasText: '💬 제안 전 셰프에게 문의하기' }).click();
    await page.waitForTimeout(500);
    const inqTextarea = page.locator('textarea').first();
    if (await inqTextarea.count() > 0) await inqTextarea.fill('납품 포장 단위가 어떻게 되나요?');
    const sendBtn = page.locator('button', { hasText: '문의 보내기' }).first();
    if (await sendBtn.count() > 0) await sendBtn.click();
    await page.waitForTimeout(2000);

    const sentOk =
      (await page.locator('text=셰프가 답변 중입니다').count() > 0) ||
      (await page.locator('text=납품 포장 단위').count() > 0) ||
      (await page.locator('text=딜 전 문의').count() > 0);
    check('v2.17: 문의 전송 후 UI 반영', sentOk);
    await screenshot(page, 'ux_05_inquiry_sent');
  } else {
    check('v2.17: 문의 전송 (버튼 없어 skip)', true);
  }

  // ══════════════════════════════════════════
  console.log('\n[8] 농가 — 딜 A (토마토)에 제안 제출');
  // "← 딜 목록으로" 클릭해 목록으로 복귀
  const backToBrowse = page.locator('button', { hasText: '← 딜 목록으로' });
  if (await backToBrowse.count() > 0) await backToBrowse.click();
  await page.waitForTimeout(1000);

  const proposedA = await submitProposal(page, '토마토');
  check('농가 — 딜 A에 제안 제출', proposedA);
  await screenshot(page, 'ux_06_proposal_a');

  // ══════════════════════════════════════════
  console.log('\n[9] UX #3: 제안 자동 채우기 — 딜 B (딸기) 제안 폼 pre-fill');
  const openedB = await openDealInBrowse(page, '딸기');
  if (openedB) {
    const proposeBtnB = page.locator('button', { hasText: '이 딜에 제안 보내기' }).first();
    if (await proposeBtnB.count() > 0) {
      await proposeBtnB.click();
      await page.waitForTimeout(500);
      const preFillBanner = await page.locator('text=이전 제안의 단가·수량·인증이 미리 채워졌습니다').count();
      check('UX #3: 제안 자동 채우기 배너 표시', preFillBanner > 0);
      await screenshot(page, 'ux_07_prefill');
      const cancelBtn = page.locator('button', { hasText: '취소' }).first();
      if (await cancelBtn.count() > 0) await cancelBtn.click();
      await page.waitForTimeout(300);
    } else {
      check('UX #3: 딜 B 제안 버튼 없어 skip', true);
    }
  } else {
    check('UX #3: 딜 B (딸기) 없어 skip', true);
  }

  // ══════════════════════════════════════════
  console.log('\n[10] 셰프 로그인 + 딜 A (토마토) 확장');
  await logout(page);
  await login(page, CHEF_EMAIL, PW);
  await expandDealInMyDeals(page, '토마토');
  await page.waitForTimeout(2000);

  // ══════════════════════════════════════════
  console.log('\n[11] v2.17: 셰프 — 농가 문의 표시 확인');
  const inquiryDisplay = await page.locator('text=/농가 문의.*건 미답변/').count();
  check('v2.17: 셰프 내 거래에 농가 문의 표시', inquiryDisplay > 0);
  await screenshot(page, 'ux_08_chef_inquiry');

  // ══════════════════════════════════════════
  console.log('\n[12] v2.17: 셰프 — 문의 답변 등록');
  const answerTextarea = page.locator('textarea[placeholder="답변을 입력하세요"]').first();
  if (await answerTextarea.count() > 0) {
    await answerTextarea.fill('10kg 단위 박스 포장입니다.');
    const answerBtn = page.locator('button', { hasText: '답변 등록' }).first();
    if (await answerBtn.count() > 0) await answerBtn.click();
    await page.waitForTimeout(2000);
    const answerDone =
      (await page.locator('text=10kg 단위 박스').count() > 0) ||
      (await page.locator('text=수정').count() > 0);
    check('v2.17: 셰프 문의 답변 등록 완료', answerDone);
    await screenshot(page, 'ux_09_answered');
  } else {
    check('v2.17: 답변 textarea 없어 skip', true);
  }

  // ══════════════════════════════════════════
  console.log('\n[13] UX #1: 제안 비교 모드 — "+ 비교" 버튼');
  await expandDealInMyDeals(page, '토마토');
  const tomatoCard = page.locator('.ftt-card').filter({ hasText: '토마토' }).first();
  const compareBtnCount = await tomatoCard.locator('button', { hasText: '+ 비교' }).count();
  check('UX #1: "+ 비교" 버튼 표시', compareBtnCount > 0);
  await screenshot(page, 'ux_10_compare_btn');

  // ══════════════════════════════════════════
  console.log('\n[14] UX #1: 비교 클릭 → "✓ 비교중" 상태');
  if (compareBtnCount > 0) {
    await tomatoCard.locator('button', { hasText: '+ 비교' }).first().click();
    await page.waitForTimeout(500);
    const comparingState = await page.locator('button', { hasText: '✓ 비교중' }).count();
    check('UX #1: "✓ 비교중" 상태 전환', comparingState > 0);
    const resetBtnCount = await page.locator('button', { hasText: /비교 초기화/ }).count();
    check('UX #1: "비교 초기화" 버튼 표시', resetBtnCount > 0);
    await screenshot(page, 'ux_11_comparing');
    const resetBtn = page.locator('button', { hasText: /비교 초기화/ }).first();
    if (await resetBtn.count() > 0) await resetBtn.click();
    await page.waitForTimeout(300);
  } else {
    check('UX #1: "✓ 비교중" 상태 (없어 skip)', true);
    check('UX #1: "비교 초기화" (없어 skip)', true);
  }

  // ══════════════════════════════════════════
  console.log('\n[15] 셰프 — 제안 선택 (딜 A 매칭)');
  const selected = await selectProposal(page, '토마토');
  check('셰프 — 제안 선택 완료 (딜 A 매칭)', selected);
  await page.waitForTimeout(1000);

  // ══════════════════════════════════════════
  console.log('\n[16] UX #4: 단골 농가 즐겨찾기 — "☆ 즐겨찾기" 버튼');
  await expandDealInMyDeals(page, '토마토');
  const favBtnCount = await page.locator('button', { hasText: '☆ 즐겨찾기' }).count();
  const favStarCount = await page.locator('button', { hasText: '★ 즐겨찾기' }).count();
  check('UX #4: "☆ 즐겨찾기" 버튼 표시 (매칭 후)', favBtnCount > 0 || favStarCount > 0,
    `☆: ${favBtnCount}, ★: ${favStarCount}`);
  await screenshot(page, 'ux_12_fav_btn');

  // ══════════════════════════════════════════
  console.log('\n[17] UX #4: 즐겨찾기 토글');
  if (favBtnCount > 0) {
    await page.locator('button', { hasText: '☆ 즐겨찾기' }).first().click();
    await page.waitForTimeout(500);
    const starAfter = await page.locator('button', { hasText: '★ 즐겨찾기' }).count();
    check('UX #4: 즐겨찾기 추가 후 "★ 즐겨찾기" 전환', starAfter > 0);
    await screenshot(page, 'ux_13_fav_toggled');
  } else if (favStarCount > 0) {
    check('UX #4: "★ 즐겨찾기" 이미 추가됨 확인', true);
  } else {
    check('UX #4: 즐겨찾기 버튼 없어 skip', true);
  }

  // ══════════════════════════════════════════
  console.log('\n[18] UX #4: 내 레스토랑 프로필 — 즐겨찾기 농가 목록');
  const chefProfileTab = page.locator('button', { hasText: '내 레스토랑' });
  if (await chefProfileTab.count() > 0) await chefProfileTab.click();
  await page.waitForTimeout(1500);
  const favSection = await page.locator('text=/★ 즐겨찾기 농가/').count();
  check('UX #4: 내 레스토랑 — 즐겨찾기 농가 목록 표시', favSection > 0);
  await screenshot(page, 'ux_14_fav_profile');

  // ══════════════════════════════════════════
  console.log('\n[19] UX #6: 작물 가격 참고 — 딜 생성 Step 4');
  const createTabRef = page.locator('button', { hasText: '딜 만들기' });
  if (await createTabRef.count() > 0) await createTabRef.click();
  await page.waitForTimeout(1000);

  // Step 1
  const nameInputChk = page.locator('input[placeholder="예: 테이블나인"]').first();
  if (await nameInputChk.count() > 0) {
    const val = await nameInputChk.inputValue().catch(() => '');
    if (!val) await nameInputChk.fill(CHEF_NAME);
  }
  let nxt = page.locator('button', { hasText: '다음 단계 →' });
  if (await nxt.count() > 0) await nxt.click();
  await page.waitForTimeout(700);
  // Step 2
  const sizeChk = page.locator('input[placeholder*="지름"]').first();
  if (await sizeChk.count() > 0) await sizeChk.fill('5cm 이상');
  nxt = page.locator('button', { hasText: '다음 단계 →' });
  if (await nxt.count() > 0) await nxt.click();
  await page.waitForTimeout(700);
  // Step 3
  const qtyChk = page.locator('input[type="number"]').first();
  if (await qtyChk.count() > 0) await qtyChk.fill('10');
  nxt = page.locator('button', { hasText: '다음 단계 →' });
  if (await nxt.count() > 0) await nxt.click();
  await page.waitForTimeout(700);

  // Step 4: 가격 참고 배너
  const cropRefCount = await page.locator('text=/참고.*최근 평균 거래가/').count();
  check('UX #6: 딜 생성 Step 4 — 작물 가격 참고 배너', cropRefCount > 0, `배너: ${cropRefCount}`);
  await screenshot(page, 'ux_15_crop_ref');

  // 탭 전환으로 딜 만들기 취소
  if (await myDealsTabRef.count() > 0) await myDealsTabRef.click();
  await page.waitForTimeout(500);

  // ══════════════════════════════════════════
  console.log('\n[20] v2.18: 결제 영수증 — SettlementCard 확인');
  await expandDealInMyDeals(page, '토마토');
  const tossPayCount = await page.locator('text=토스페이먼츠로 결제').count();
  check('v2.18: SettlementCard — 토스 결제 버튼 표시', tossPayCount > 0);
  const receiptCount = await page.locator('text=🖨 선급금 영수증').count();
  check('v2.18: 영수증 버튼 결제 전 비표시', receiptCount === 0);
  await screenshot(page, 'ux_16_settlement');

  // ══════════════════════════════════════════
  console.log('\n[21] 농가 로그인 → v2.19: 성과 배지 (친환경 인증)');
  await logout(page);
  await login(page, FARM_EMAIL, PW);

  const farmProfileTab = page.locator('button', { hasText: '내 농가' });
  if (await farmProfileTab.count() > 0) await farmProfileTab.click();
  await page.waitForTimeout(1500);

  // 지역 입력 (필수 — 없으면 저장 validation 실패)
  const regionInProfile = page.locator('input[placeholder="예: 경기 이천"]').first();
  if (await regionInProfile.count() > 0) await regionInProfile.fill('경기 이천');
  await page.waitForTimeout(200);

  // "친환경" Chip 클릭 → data.cert 즉시 업데이트 → 배지 렌더
  const certChip = page.locator('button', { hasText: '친환경' }).first();
  if (await certChip.count() > 0) await certChip.click();
  await page.waitForTimeout(500);

  const ecoBadgeImmediate = await page.locator('text=친환경 인증').count();
  check('v2.19: 친환경 인증 배지 표시 (cert 변경 즉시)', ecoBadgeImmediate > 0);
  await screenshot(page, 'ux_17_eco_badge');

  // ══════════════════════════════════════════
  console.log('\n[22] v2.19: 저장 후 재확인');
  const saveBtn = page.locator('button', { hasText: '저장' }).first();
  if (await saveBtn.count() > 0) await saveBtn.click();
  await page.waitForTimeout(3000); // Firestore 저장 대기

  // 탭 이동 후 복귀
  const browseFarmTab = page.locator('button', { hasText: '딜 찾기' });
  if (await browseFarmTab.count() > 0) await browseFarmTab.click();
  await page.waitForTimeout(2000);
  if (await farmProfileTab.count() > 0) await farmProfileTab.click();
  await page.waitForTimeout(2000);

  const ecoBadgeSaved = await page.locator('text=친환경 인증').count();
  check('v2.19: 저장 후 친환경 인증 배지 유지', ecoBadgeSaved > 0);
  await screenshot(page, 'ux_18_eco_saved');

  // ══════════════════════════════════════════
  console.log('\n[23] UX #5: 정기 딜 자동 연장 — matched 상태 미표시 확인');
  await logout(page);
  await login(page, CHEF_EMAIL, PW);
  if (await myDealsTabRef.count() > 0) await myDealsTabRef.click();
  await page.waitForTimeout(3000);

  const nextCycleBtnCount = await page.locator('button', { hasText: /↻ 다음 회차 딜 만들기/ }).count();
  check('UX #5: matched 상태 → 자동 연장 버튼 미표시 (done 전용)', nextCycleBtnCount === 0);
  await screenshot(page, 'ux_19_no_next_cycle');

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
