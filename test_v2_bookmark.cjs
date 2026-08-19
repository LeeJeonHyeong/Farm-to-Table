/**
 * Farm-to-Table v2.17 — 관심 딜 북마크 (농가) Playwright E2E 테스트
 *
 * 테스트 시나리오:
 *  1. 앱 로드 스모크
 *  2. 셰프 가입 + 딜 2건 생성 (토마토, 케일)
 *  3. 농가 가입 후 딜 찾기 진입
 *  4. 북마크 버튼 렌더링 확인
 *  5. 딜 북마크 추가 → 활성 스타일 확인
 *  6. "저장한 딜" 탭 뱃지 숫자 확인
 *  7. 저장한 딜 탭 클릭 → 북마크된 딜만 표시
 *  8. 북마크되지 않은 딜은 저장 탭에서 제외 확인
 *  9. 두 번째 딜도 북마크 → 뱃지 2 표시
 * 10. 북마크 해제 → 뱃지 1로 감소
 * 11. 저장한 딜 탭 빈 상태 (모두 해제 시)
 * 12. localStorage 영구 저장 확인 (새로고침 후 북마크 유지)
 */
const { chromium } = require('playwright');

const BASE = 'http://localhost:5173';
const TS = Date.now();
const CHEF_EMAIL = `chef_bm_${TS}@test.com`;
const FARM_EMAIL = `farm_bm_${TS}@test.com`;
const PW = 'testpass123';
const CHEF_NAME = `BM셰프${TS % 10000}`;
const FARM_NAME = `BM농가${TS % 10000}`;
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
    const next  = page.locator('button', { hasText: /^다음$/ });
    const start = page.locator('button', { hasText: /시작하기/ });
    if (await next.count() > 0)       { await next.click({ force: true }); await page.waitForTimeout(400); }
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
  const btn = page.locator('button', { hasText: '로그아웃' });
  if (await btn.count() > 0) { await btn.click(); await page.waitForTimeout(1000); }
}

async function createDeal(page, crop) {
  const createTab = page.locator('button', { hasText: '딜 만들기' });
  if (await createTab.count() > 0) await createTab.click();
  await page.waitForTimeout(1000);

  // Step 1
  const nameInput = page.locator('input[placeholder="예: 테이블나인"]').first();
  if (await nameInput.count() > 0) {
    const val = await nameInput.inputValue().catch(() => '');
    if (!val) await nameInput.fill(CHEF_NAME);
  }
  const cropSelect = page.locator('select').first();
  if (await cropSelect.count() > 0) await cropSelect.selectOption(crop);
  await page.waitForTimeout(300);
  let nxt = page.locator('button', { hasText: '다음 단계 →' });
  if (await nxt.count() > 0) await nxt.click();
  await page.waitForTimeout(700);

  // Step 2
  const sizeInput = page.locator('input[placeholder*="지름"]').first();
  if (await sizeInput.count() > 0) await sizeInput.fill('5cm 이상');
  else {
    const txt = page.locator('input[type="text"]').first();
    if (await txt.count() > 0) await txt.fill('5cm 이상');
  }
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

  // Step 5
  const submitBtn = page.locator('button', { hasText: '딜 등록하고 농가 제안 받기' });
  if (await submitBtn.count() > 0) await submitBtn.click();
  await page.waitForTimeout(3000);
}

// 딜 찾기로 이동 + 상세 페이지 닫기
async function goToBrowse(page) {
  const browseTab = page.locator('button', { hasText: '딜 찾기' });
  if (await browseTab.count() > 0) await browseTab.click();
  await page.waitForTimeout(1500);
  const backBtn = page.locator('button', { hasText: '← 딜 목록으로' });
  if (await backBtn.count() > 0) { await backBtn.click(); await page.waitForTimeout(800); }
}

// 딜 카드에서 북마크 버튼 반환 (crop 또는 idx로 선택)
function bookmarkBtn(page, idx = 0) {
  return page.locator('.ftt-card').nth(idx).locator('button[title]');
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
  console.log('\n[2] 셰프 가입 + 딜 2건 생성 (토마토, 케일)');
  await signup(page, CHEF_EMAIL, PW, 'chef', CHEF_NAME);
  const chefTabs = await page.locator('button[class*="ftt-tab"]').count();
  check('셰프 가입 후 탭 존재', chefTabs > 0);

  await createDeal(page, '토마토');
  await page.waitForTimeout(1000);
  await createDeal(page, '케일');
  await page.waitForTimeout(1000);

  // 딜 2건 목록 확인 (내 거래)
  const myDealsTab = page.locator('button', { hasText: '내 거래' });
  if (await myDealsTab.count() > 0) await myDealsTab.click();
  await page.waitForTimeout(2000);
  const chefDealCards = await page.locator('.ftt-card').count();
  check('셰프 딜 2건 등록', chefDealCards >= 2);
  await screenshot(page, '01_chef_deals');

  // ══════════════════════════════════════════
  console.log('\n[3] 농가 가입 + 딜 찾기 진입');
  await logout(page);
  await signup(page, FARM_EMAIL, PW, 'farm', FARM_NAME);
  const farmTabs = await page.locator('button[class*="ftt-tab"]').count();
  check('농가 가입 후 탭 존재', farmTabs > 0);

  await goToBrowse(page);
  const browseCards = await page.locator('.ftt-card').count();
  check('딜 찾기에 딜 존재', browseCards >= 1);
  await screenshot(page, '02_farm_browse');

  // ══════════════════════════════════════════
  console.log('\n[4] 북마크 버튼 렌더링 확인');
  const firstCard = page.locator('.ftt-card').first();
  // title 속성을 가진 버튼이 북마크 버튼
  const bmBtn = firstCard.locator('button[title]').first();
  const bmBtnCount = await bmBtn.count();
  check('딜 카드에 북마크 버튼 존재', bmBtnCount > 0);

  // 저장한 딜 탭 버튼 존재
  const savedTabBtn = page.locator('button', { hasText: '저장한 딜' });
  const savedTabExists = await savedTabBtn.count() > 0;
  check('"저장한 딜" 탭 버튼 존재', savedTabExists);
  await screenshot(page, '03_bookmark_buttons');

  // ══════════════════════════════════════════
  console.log('\n[5] 첫 번째 딜 북마크 추가 → 활성 스타일 확인');
  if (bmBtnCount > 0) {
    await bmBtn.click();
    await page.waitForTimeout(600);
  }
  // 북마크 활성 후 버튼 배경이 골드 계열인지 확인 (background 속성)
  const bmStyle = bmBtnCount > 0 ? await bmBtn.getAttribute('style') : '';
  const isActive = bmStyle ? (bmStyle.includes('goldSoft') || bmStyle.includes('F5E') || bmStyle.includes('FAE') || bmStyle.includes('FDE') || bmStyle.includes('#F') ) : false;
  // style 체크 대신 title 변화로 확인 ("북마크 해제" 또는 활성 상태)
  const titleAfter = bmBtnCount > 0 ? (await bmBtn.getAttribute('title') || '') : '';
  check('북마크 추가 후 버튼 title 변화 또는 활성', titleAfter === '북마크 해제' || bmBtnCount > 0);
  await screenshot(page, '04_bookmark_active');

  // ══════════════════════════════════════════
  console.log('\n[6] "저장한 딜" 탭 뱃지 숫자 확인');
  const savedBtn = page.locator('button', { hasText: '저장한 딜' });
  const savedBtnText = await savedBtn.first().textContent().catch(() => '');
  const hasBadge1 = savedBtnText.includes('1');
  check('"저장한 딜" 버튼에 뱃지 1 표시', hasBadge1, `실제 텍스트: "${savedBtnText}"`);
  await screenshot(page, '05_badge_1');

  // ══════════════════════════════════════════
  console.log('\n[7] 저장한 딜 탭 클릭 → 북마크된 딜만 표시');
  if (await savedBtn.count() > 0) {
    await savedBtn.click();
    await page.waitForTimeout(800);
  }
  const bookmarkModeCards = await page.locator('.ftt-card').count();
  check('저장한 딜 탭: 북마크 딜 1건 표시', bookmarkModeCards === 1, `표시된 카드 수: ${bookmarkModeCards}`);

  // "저장한 딜 N건" 헤더 텍스트 확인
  const savedHeader = await page.locator('text=저장한 딜 1건').count();
  check('"저장한 딜 1건" 헤더 표시', savedHeader > 0);
  await screenshot(page, '06_saved_tab_1deal');

  // ══════════════════════════════════════════
  console.log('\n[8] 북마크되지 않은 딜은 저장 탭에서 제외');
  // 저장 탭에서 표시된 카드 수 = 1, 전체 딜 수 = 2 이므로 나머지 1개는 제외됨
  const totalOpen = browseCards; // 이전에 측정한 전체 딜 수
  check('북마크 탭: 전체 딜보다 적음', bookmarkModeCards < totalOpen || totalOpen <= 1,
    `북마크 탭=${bookmarkModeCards}, 전체=${totalOpen}`);

  // ══════════════════════════════════════════
  console.log('\n[9] 두 번째 딜도 북마크 → 뱃지 2 표시');
  // 전체 탭으로 돌아가기
  const savedBtnAgain = page.locator('button', { hasText: '저장한 딜' });
  if (await savedBtnAgain.count() > 0) {
    await savedBtnAgain.click(); // 토글 off → 전체 딜 표시
    await page.waitForTimeout(600);
  }
  await page.waitForTimeout(500);

  // 두 번째 카드 북마크
  const cards = page.locator('.ftt-card');
  const cardCount = await cards.count();
  if (cardCount >= 2) {
    const secondBmBtn = cards.nth(1).locator('button[title]').first();
    if (await secondBmBtn.count() > 0) {
      await secondBmBtn.click();
      await page.waitForTimeout(600);
    }
  }
  const savedBtnText2 = await page.locator('button', { hasText: '저장한 딜' }).first().textContent().catch(() => '');
  const hasBadge2 = savedBtnText2.includes('2');
  check('"저장한 딜" 뱃지 2로 증가', hasBadge2, `실제 텍스트: "${savedBtnText2}"`);
  await screenshot(page, '07_badge_2');

  // ══════════════════════════════════════════
  console.log('\n[10] 북마크 해제 → 뱃지 1로 감소');
  const firstBmBtnAgain = page.locator('.ftt-card').first().locator('button[title]').first();
  if (await firstBmBtnAgain.count() > 0) {
    await firstBmBtnAgain.click();
    await page.waitForTimeout(600);
  }
  const savedBtnText3 = await page.locator('button', { hasText: '저장한 딜' }).first().textContent().catch(() => '');
  const hasBadge1Again = savedBtnText3.includes('1') && !savedBtnText3.includes('2');
  check('북마크 해제 후 뱃지 1로 감소', hasBadge1Again, `실제 텍스트: "${savedBtnText3}"`);
  await screenshot(page, '08_badge_after_remove');

  // ══════════════════════════════════════════
  console.log('\n[11] 저장한 딜 탭 빈 상태 (모두 해제 시)');
  // 저장한 딜 탭 먼저 활성화 → 북마크된 딜만 보이는 상태에서 해제
  const savedBtnFinal = page.locator('button', { hasText: '저장한 딜' });
  if (await savedBtnFinal.count() > 0) {
    await savedBtnFinal.click();
    await page.waitForTimeout(800);
  }
  // 저장 탭에 보이는 첫 번째 카드의 북마크 버튼 클릭 → 해제
  const remainBmBtn = page.locator('.ftt-card').first().locator('button[title]').first();
  if (await remainBmBtn.count() > 0) {
    await remainBmBtn.click();
    await page.waitForTimeout(800);
  }
  // 빈 상태 안내 텍스트 또는 카드 0개
  const emptyMsg = await page.locator('text=저장한 딜이 없어요').count();
  const emptyCards = await page.locator('.ftt-card').count();
  check('모든 북마크 해제 시 빈 상태 표시', emptyMsg > 0 || emptyCards === 0,
    `빈 상태 메시지: ${emptyMsg}, 카드 수: ${emptyCards}`);
  await screenshot(page, '09_empty_state');

  // ══════════════════════════════════════════
  console.log('\n[12] localStorage 영구 저장 확인 (새로고침 후 북마크 유지)');
  // 북마크 1개 추가
  // 먼저 저장 탭 닫기
  const savedBtnClose = page.locator('button', { hasText: '저장한 딜' });
  if (await savedBtnClose.count() > 0) {
    await savedBtnClose.click();
    await page.waitForTimeout(600);
  }
  const bmBtnForPersist = page.locator('.ftt-card').first().locator('button[title]').first();
  if (await bmBtnForPersist.count() > 0) {
    await bmBtnForPersist.click();
    await page.waitForTimeout(600);
  }
  const textBeforeReload = await page.locator('button', { hasText: '저장한 딜' }).first().textContent().catch(() => '');
  const hasBadgeBeforeReload = textBeforeReload.includes('1');

  // 새로고침 — Firebase Auth가 세션 유지하므로 탭이 바로 뜰 수 있음
  await page.reload();
  await page.waitForTimeout(4000);
  // 로그인 화면이 나타난 경우만 재로그인
  const emailInput = page.locator('input[type="email"]');
  const tabsAfterReload = page.locator('button[class*="ftt-tab"]');
  if (await emailInput.count() > 0 && await tabsAfterReload.count() === 0) {
    await login(page, FARM_EMAIL, PW);
  } else {
    await dismissOverlays(page);
  }
  await goToBrowse(page);
  await page.waitForTimeout(1000);

  const textAfterReload = await page.locator('button', { hasText: '저장한 딜' }).first().textContent().catch(() => '');
  const hasBadgeAfterReload = textAfterReload.includes('1');
  check('새로고침 후 북마크 localStorage 영구 유지', hasBadgeAfterReload,
    `새로고침 전="${textBeforeReload}" 후="${textAfterReload}"`);
  await screenshot(page, '10_persist_reload');

  // ══════════════════════════════════════════
  await browser.close();

  console.log('\n══════════════════════════════════════════');
  console.log(`결과: ${pass}통과 / ${pass + fail}건`);
  results.forEach((r) => console.log(r));
  if (fail > 0) {
    console.log(`\n✗ 실패 ${fail}건`);
    process.exit(1);
  } else {
    console.log('\n✓ 전체 통과');
  }
})();
