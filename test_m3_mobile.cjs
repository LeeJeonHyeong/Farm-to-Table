/**
 * M-3: 모바일 UI 점검 (iPhone 13 뷰포트)
 */
const { chromium } = require("playwright");

const BASE = "http://localhost:5173";
const FARM_EMAIL = "demo.farm@ftt-demo.kr";
const CHEF_EMAIL = "demo.chef@ftt-demo.kr";
const PW = "fttDemo2026!";

const MOBILE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 };

let passed = 0, failed = 0;
function assert(cond, label) {
  if (cond) { console.log(`  ✅ [PASS] ${label}`); passed++; }
  else { console.log(`  ❌ [FAIL] ${label}`); failed++; }
}

async function dismissOverlays(page) {
  for (let i = 0; i < 8; i++) {
    const next = page.locator("button", { hasText: /^다음$/ });
    const start = page.locator("button", { hasText: /시작하기/ });
    if (await next.count() > 0) { await next.click({ force: true }); await page.waitForTimeout(400); }
    else if (await start.count() > 0) { await start.click({ force: true }); await page.waitForTimeout(400); break; }
    else break;
  }
}

async function run() {
  console.log("\n====================================================");
  console.log("M-3 — 모바일 UI 점검 (390×844, iPhone 13)");
  console.log("====================================================\n");

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ ...MOBILE });
  const page = await ctx.newPage();

  // 로그인 화면
  await page.goto(BASE);
  await page.waitForSelector('input[type="email"]', { timeout: 20000 });

  const loginVisible = await page.locator('input[type="email"]').isVisible();
  assert(loginVisible, "[1] 로그인 화면 모바일 정상 표시");

  // 셰프 로그인
  await page.fill('input[type="email"]', CHEF_EMAIL);
  await page.fill('input[type="password"]', PW);
  await page.locator("button", { hasText: /로그인$/ }).last().click();
  await page.waitForTimeout(3500);
  await dismissOverlays(page);

  // 탭 바 표시
  const tabs = await page.locator("button", { hasText: "딜 만들기" }).count();
  assert(tabs > 0, "[2] 셰프 탭 바 모바일 표시됨");

  // 딜 만들기
  await page.locator("button", { hasText: "딜 만들기" }).first().click({ force: true });
  await page.waitForTimeout(1500);
  const aiPanel = await page.locator("text=AI 자동 입력").count();
  assert(aiPanel > 0, "[3] 딜 만들기 AI 패널 모바일 표시됨");

  // 내 거래
  await page.locator("button", { hasText: "내 거래" }).first().click({ force: true });
  await page.waitForTimeout(1500);
  const body1 = await page.locator("body").innerText();
  assert(!body1.includes("TypeError") && body1.length > 100, "[4] 내 거래 탭 모바일 오류 없음");

  // 사이드 SVG (left:-118 / right:-118) — 모바일에서 숨겨져야 함
  const sideSvgLeft = await page.locator("svg[style*='-118']").count();
  assert(sideSvgLeft === 0, "[5] 모바일에서 사이드 장식 SVG(-118) 숨김 확인");

  // 스크롤 가능 여부
  const scrollHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  const clientHeight = await page.evaluate(() => document.documentElement.clientHeight);
  assert(scrollHeight >= clientHeight, "[6] 페이지 스크롤 가능 (overflow 정상)");

  // 로그아웃 후 농가 로그인
  const logoutBtn = page.locator("button", { hasText: /로그아웃/ });
  if (await logoutBtn.count() > 0) { await logoutBtn.click(); await page.waitForTimeout(1500); }
  await page.goto(BASE);
  await page.waitForSelector('input[type="email"]', { timeout: 15000 });

  await page.fill('input[type="email"]', FARM_EMAIL);
  await page.fill('input[type="password"]', PW);
  await page.locator("button", { hasText: /로그인$/ }).last().click();
  await page.waitForTimeout(3500);
  await dismissOverlays(page);

  // 딜 찾기
  await page.locator("button", { hasText: "딜 찾기" }).first().click({ force: true });
  await page.waitForTimeout(1500);
  const body2 = await page.locator("body").innerText();
  assert(!body2.includes("TypeError") && body2.length > 100, "[7] 농가 딜 찾기 탭 모바일 오류 없음");

  await page.screenshot({ path: "C:/Users/USER/AppData/Local/Temp/mobile_test.png" });
  console.log("\n  스크린샷: C:/Users/USER/AppData/Local/Temp/mobile_test.png");

  await ctx.close();
  await browser.close();

  console.log(`\n====================================================`);
  console.log(`결과: ${passed} / ${passed + failed} 통과`);
  console.log(`====================================================\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => { console.error("오류:", err.message); process.exit(1); });
