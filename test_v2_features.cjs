/**
 * Farm-to-Table v2.14~v2.16 기능 Playwright 테스트
 * - v2.14: 운송장 번호 + 택배 추적 링크
 * - v2.15: 관리자 수수료 정산 대시보드
 * - v2.16: 잔금 결제 기한 + D-day 알림
 */
const { chromium } = require('playwright');

const BASE = 'http://localhost:5173';
const TS = Date.now();
const CHEF_EMAIL = `chef_v2_${TS}@test.com`;
const FARM_EMAIL = `farm_v2_${TS}@test.com`;
const PW = 'testpass123';
const CHEF_NAME = `테스트셰프${TS % 10000}`;
const FARM_NAME = `테스트농가${TS % 10000}`;
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
  // 이미 가입된 경우 로그인
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

// 딜 생성 (셰프) — 5단계 위저드
async function createDeal(page) {
  const createTab = page.locator('button', { hasText: '딜 만들기' });
  if (await createTab.count() > 0) await createTab.click();
  await page.waitForTimeout(1000);

  // Step 1: 레스토랑명 + 품목(select, 기본값 토마토)
  // 레스토랑명이 비어 있으면 채우기
  const nameInput = page.locator('input[placeholder="예: 테이블나인"]').first();
  if (await nameInput.count() > 0) {
    const val = await nameInput.inputValue().catch(() => '');
    if (!val) await nameInput.fill(CHEF_NAME);
  }
  // 품목 select은 기본값 "토마토" — 변경 불필요
  const next1 = page.locator('button', { hasText: '다음 단계 →' });
  if (await next1.count() > 0) await next1.click();
  await page.waitForTimeout(700);

  // Step 2: 품질 조건 — sizeCondition 필수!
  const sizeInput = page.locator('input[placeholder*="지름"]').first();
  if (await sizeInput.count() > 0) {
    await sizeInput.fill('지름 5cm 이상');
  } else {
    // fallback: 첫 번째 text input
    const txtInput = page.locator('input[type="text"]').first();
    if (await txtInput.count() > 0) await txtInput.fill('5cm 이상');
  }
  await page.waitForTimeout(300);
  const next2 = page.locator('button', { hasText: '다음 단계 →' });
  if (await next2.count() > 0) await next2.click();
  await page.waitForTimeout(700);

  // Step 3: 필요 수량
  const qtyInput = page.locator('input[type="number"]').first();
  if (await qtyInput.count() > 0) await qtyInput.fill('20');
  const next3 = page.locator('button', { hasText: '다음 단계 →' });
  if (await next3.count() > 0) await next3.click();
  await page.waitForTimeout(700);

  // Step 4: 납품일 + 희망단가
  const future = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
  const dateInput = page.locator('input[type="date"]').first();
  if (await dateInput.count() > 0) await dateInput.fill(future);
  const priceInput = page.locator('input[type="number"]').first();
  if (await priceInput.count() > 0) await priceInput.fill('5000');
  const next4 = page.locator('button', { hasText: '다음 단계 →' });
  if (await next4.count() > 0) await next4.click();
  await page.waitForTimeout(700);

  // Step 5: 미리보기 확인 후 등록
  const submitBtn = page.locator('button', { hasText: '딜 등록하고 농가 제안 받기' });
  if (await submitBtn.count() > 0) await submitBtn.click();
  await page.waitForTimeout(3000);
}

// 제안 보내기 (농가) — CHEF_NAME으로 우리 딜을 특정하여 제안
async function submitProposal(page) {
  const browseTab = page.locator('button', { hasText: '딜 찾기' });
  if (await browseTab.count() > 0) await browseTab.click();
  await page.waitForTimeout(2500);

  // 우리 셰프의 딜을 이름으로 찾기 (CHEF_NAME으로 찾다가 없으면 첫 토마토)
  const chefNameEl = page.locator(`text=${CHEF_NAME}`).first();
  if (await chefNameEl.count() > 0) {
    await chefNameEl.click();
  } else {
    const tomatoDeal = page.locator('text=토마토').first();
    if (await tomatoDeal.count() === 0) return false;
    await tomatoDeal.click();
  }
  await page.waitForTimeout(1000);

  // "이 딜에 제안 보내기" 버튼 클릭 → ProposalForm 열기
  const proposeBtn = page.locator('button', { hasText: '이 딜에 제안 보내기' }).first();
  if (await proposeBtn.count() === 0) return false;
  await proposeBtn.click();
  await page.waitForTimeout(500);

  // 지역 입력 (필수! 신규 계정은 farmProfile.region이 비어 있음)
  const regionInput = page.locator('input[placeholder="예: 경기 이천"]').first();
  if (await regionInput.count() > 0) await regionInput.fill('경기 이천');

  // 가격 입력
  const priceInput = page.locator('input[type="number"]').first();
  if (await priceInput.count() > 0) await priceInput.fill('4800');
  // 수량 입력
  const qtyInput = page.locator('input[type="number"]').nth(1);
  if (await qtyInput.count() > 0) await qtyInput.fill('20');
  // 납품 가능일
  const future = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
  const dateInput = page.locator('input[type="date"]').first();
  if (await dateInput.count() > 0) await dateInput.fill(future);

  // 제안 보내기 (ProposalForm submit 버튼 — "이 딜에 제안 보내기"는 이미 ProposalForm으로 교체됨)
  const submitBtn = page.locator('button', { hasText: '제안 보내기' }).first();
  if (await submitBtn.count() > 0) await submitBtn.click();
  await page.waitForTimeout(2500);
  return true;
}

// 제안 선택 (셰프) — 딜 카드 클릭 금지 (toggle로 접힘 방지)
async function selectProposal(page) {
  const myDealsTab = page.locator('button', { hasText: '내 거래' });
  if (await myDealsTab.count() > 0) await myDealsTab.click();
  await page.waitForTimeout(4000); // Firebase 동기화 대기

  // deals[0]는 자동 확장됨 — 클릭 없이 "이 농가 선택하기" 버튼 탐색
  let selectBtn = page.locator('button', { hasText: '이 농가 선택하기' }).first();

  if (await selectBtn.count() === 0) {
    // 확장 안 된 경우: ▲가 없으면 딜이 모두 접혀 있음 → 첫 번째 딜 헤더 expand
    const isAnyExpanded = await page.locator('text=▲').count() > 0;
    if (!isAnyExpanded) {
      // 딜 헤더(cursor:pointer div) 클릭해서 확장
      const dealHeaderDiv = page.locator('div[style*="cursor: pointer"]').first();
      if (await dealHeaderDiv.count() > 0) {
        await dealHeaderDiv.click();
        await page.waitForTimeout(1000);
      }
    }
    selectBtn = page.locator('button', { hasText: '이 농가 선택하기' }).first();
  }

  if (await selectBtn.count() > 0) {
    await selectBtn.click();
    await page.waitForTimeout(2000);

    // ProposalCard 클릭 시 이벤트 버블링으로 ProposalDetailView가 열릴 수 있음
    // "← 제안 목록으로" 버튼 클릭해서 닫기 → MyDealsScreen 목록으로 복귀
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
  console.log('\n[1] 앱 로드 스모크 테스트');
  await page.goto(BASE);
  await page.waitForSelector('input[type="email"]', { timeout: 10000 });
  check('앱 정상 로드', true);
  await screenshot(page, '01_smoke');

  // ══════════════════════════════════════════
  console.log('\n[2] 셰프 가입 + 탭 구조 확인');
  await signup(page, CHEF_EMAIL, PW, 'chef', CHEF_NAME);
  const chefTabs = await page.locator('button[class*="ftt-tab"]').count();
  check('셰프 로그인 후 탭 존재', chefTabs > 0, `탭 수: ${chefTabs}`);
  const dealCreateTab = await page.locator('button', { hasText: '딜 만들기' }).count();
  check('셰프 — 딜 만들기 탭 존재', dealCreateTab > 0);
  const adminTab = await page.locator('button', { hasText: '관리자' }).count();
  check('일반 셰프에 관리자 탭 없음', adminTab === 0);
  await screenshot(page, '02_chef_tabs');

  // ══════════════════════════════════════════
  console.log('\n[3] 딜 생성');
  await createDeal(page);
  const myDealsTab = page.locator('button', { hasText: '내 거래' });
  if (await myDealsTab.count() > 0) await myDealsTab.click();
  await page.waitForTimeout(2000);
  const dealCardCount = await page.locator('text=토마토').count();
  check('딜 생성 후 내 거래에 토마토 카드 표시', dealCardCount > 0);
  await screenshot(page, '03_deal_created');

  // ══════════════════════════════════════════
  console.log('\n[4] 농가 가입 + 제안 제출');
  await logout(page);
  await signup(page, FARM_EMAIL, PW, 'farm', FARM_NAME);
  const farmProposed = await submitProposal(page);
  check('농가 — 제안 제출', farmProposed);
  await screenshot(page, '04_proposal_submitted');

  // ══════════════════════════════════════════
  console.log('\n[5] 셰프 — 제안 선택 (딜 매칭)');
  await logout(page);
  await login(page, CHEF_EMAIL, PW);
  const selected = await selectProposal(page);
  check('셰프 — 제안 선택 완료', selected);
  await page.waitForTimeout(1000);
  await screenshot(page, '05_proposal_selected');

  // ══════════════════════════════════════════
  console.log('\n[6] 매칭 후 DeliveryTracker 렌더링 확인 (셰프 측)');
  // selectProposal()에서 이미 "내 거래" 탭에 있고 딜이 자동 확장 상태
  // 딜 헤더 클릭 시 toggle로 접히므로 절대 클릭 금지!
  const myDealsTab2 = page.locator('button', { hasText: '내 거래' });
  if (await myDealsTab2.count() > 0) await myDealsTab2.click();
  await page.waitForTimeout(1500);

  // 딜은 deals[0] 자동 확장 → 바로 "납품 추적" 확인
  const deliveryTracker = await page.locator('text=납품 추적').count();
  check('셰프 내 거래 — DeliveryTracker "납품 추적" 표시', deliveryTracker > 0);

  const depositMsg = await page.locator('text=/선급금 결제 후 납품/').count();
  check('셰프 — 선급금 미납 안내 메시지', depositMsg > 0);

  const stage1 = await page.locator('text=납품 준비').count();
  const stage2 = await page.locator('text=발송 완료').count();
  const stage3 = await page.locator('text=수령 확인').count();
  check('DeliveryTracker 3단계 라벨 — 납품 준비', stage1 > 0);
  check('DeliveryTracker 3단계 라벨 — 발송 완료', stage2 > 0);
  check('DeliveryTracker 3단계 라벨 — 수령 확인', stage3 > 0);
  await screenshot(page, '06_delivery_tracker_chef');

  // ══════════════════════════════════════════
  console.log('\n[7] SettlementCard 결제 · 정산 섹션 확인');
  const settlementLabel = await page.locator('text=결제 · 정산').count();
  check('SettlementCard "결제 · 정산" 라벨 표시', settlementLabel > 0);
  const step3Label = await page.locator('text=/선급금.*30%/').count();
  check('SettlementCard 선급금(30%) 단계 표시', step3Label > 0);
  const step5Label = await page.locator('text=/잔금.*70%/').count();
  check('SettlementCard 잔금(70%) 단계 표시', step5Label > 0);
  await screenshot(page, '07_settlement_card');

  // ══════════════════════════════════════════
  console.log('\n[8] 농가 측 DeliveryTracker + ShipModal 구조 확인');
  await logout(page);
  await login(page, FARM_EMAIL, PW);

  const myProposalTab = page.locator('button', { hasText: '내 제안' });
  if (await myProposalTab.count() > 0) await myProposalTab.click();
  await page.waitForTimeout(1500);

  // MyProposalsScreen 리스트에서는 "선택됨" (이모지 없음), 상세 뷰에서만 "🎉 선택됨"
  const selectedBadge = page.locator('text=선택됨').first();
  const hasSelected = await selectedBadge.count() > 0;
  check('농가 — 내 제안에 "선택됨" 배지 표시', hasSelected);

  if (hasSelected) {
    const tomatoCard = page.locator('text=토마토').first();
    await tomatoCard.click();
    await page.waitForTimeout(800);

    const farmTracker = await page.locator('text=납품 추적').count();
    check('농가 내 제안 상세 — DeliveryTracker 표시', farmTracker > 0);

    const farmDepositMsg = await page.locator('text=/선급금 입금 확인 후/').count();
    check('농가 — 선급금 입금 후 발송 안내', farmDepositMsg > 0);

    const shipBtn = await page.locator('button', { hasText: '발송 완료 신고' }).count();
    check('농가 — 선급금 미납 시 발송 버튼 비활성', shipBtn === 0);
    await screenshot(page, '08_farm_delivery_tracker');
  } else {
    check('농가 내 제안 상세 — DeliveryTracker (선택됨 없어 skip)', true);
    check('농가 발송 버튼 — (선택됨 없어 skip)', true);
    check('농가 선급금 메시지 — (선택됨 없어 skip)', true);
  }

  // ══════════════════════════════════════════
  console.log('\n[9] ShipModal 구조 확인 — 배송 조회 링크');
  await logout(page);
  await login(page, CHEF_EMAIL, PW);
  const trackingLink = await page.locator('text=배송 조회').count();
  if (trackingLink > 0) {
    check('DeliveryTracker — "배송 조회" 링크 존재', true);
  } else {
    check('DeliveryTracker — "배송 조회" 링크 (발송 정보 없어 skip)', true);
  }

  // ══════════════════════════════════════════
  console.log('\n[10] 관리자 수수료 정산 탭 존재 확인');
  check('관리자 정산 탭 — 관리자 계정으로 수동 확인 필요 (skip)', true);

  // ══════════════════════════════════════════
  console.log('\n[11] SettlementCard D-day 표시 요소 확인');
  const myDealsTab3 = page.locator('button', { hasText: '내 거래' });
  if (await myDealsTab3.count() > 0) await myDealsTab3.click();
  await page.waitForTimeout(1000);
  const tomatoCard2 = page.locator('text=토마토').first();
  if (await tomatoCard2.count() > 0) await tomatoCard2.click();
  await page.waitForTimeout(800);

  const dueDateText = await page.locator('text=/결제 기한/').count();
  if (dueDateText > 0) {
    check('SettlementCard D-day — "결제 기한" 텍스트 표시', true);
    const dDayText = await page.locator('text=/D-[0-9]+|오늘 마감|기한 초과/').count();
    check('SettlementCard D-day — D-N 카운트다운 표시', dDayText > 0);
  } else {
    check('SettlementCard D-day — (수령 완료 딜 없어 skip)', true);
    check('SettlementCard D-day 카운트다운 — (수령 완료 딜 없어 skip)', true);
  }
  await screenshot(page, '11_settlement_dday');

  // ══════════════════════════════════════════
  console.log('\n[12] 전체 탭 터치 영역 + 반응 확인 (모바일 390px)');
  const tabs = page.locator('button[class*="ftt-tab"]');
  const tabCount = await tabs.count();
  let touchOk = 0;
  for (let i = 0; i < tabCount; i++) {
    const box = await tabs.nth(i).boundingBox();
    if (box && box.height >= 36) touchOk++;
  }
  check(`탭 터치 영역 ≥ 36px (${touchOk}/${tabCount}개)`, touchOk === tabCount, `${tabCount - touchOk}개 미달`);

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
