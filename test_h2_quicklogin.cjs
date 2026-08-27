/**
 * H-2 검증: DEV 퀵 로그인 버튼 표시 + 셰프/농가 로그인 동작
 */
const { chromium } = require("playwright");

const BASE = "http://localhost:5173";

async function dismissOverlays(page) {
  for (let i = 0; i < 8; i++) {
    const next = page.locator("button", { hasText: /^다음$/ });
    const start = page.locator("button", { hasText: /시작하기/ });
    if (await next.count() > 0) { await next.click({ force: true }); await page.waitForTimeout(400); }
    else if (await start.count() > 0) { await start.click({ force: true }); await page.waitForTimeout(400); break; }
    else break;
  }
}

let passed = 0, failed = 0;
function assert(cond, label) {
  if (cond) { console.log(`  ✅ [PASS] ${label}`); passed++; }
  else { console.log(`  ❌ [FAIL] ${label}`); failed++; }
}

async function run() {
  console.log("\n====================================================");
  console.log("H-2 — DEV 퀵 로그인 검증");
  console.log("====================================================\n");

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  await page.goto(BASE);
  await page.waitForSelector('input[type="email"]', { timeout: 20000 });

  // [1] DEV 퀵 로그인 패널 표시
  const panel = page.locator("text=DEV 데모 계정 빠른 로그인");
  assert(await panel.count() > 0, "H-2-1: DEV 퀵 로그인 패널 표시됨");

  // [2] 셰프 버튼 존재
  const chefBtn = page.locator("button", { hasText: "🍳 셰프" });
  assert(await chefBtn.count() > 0, "H-2-2: 🍳 셰프 퀵 로그인 버튼 존재");

  // [3] 농가 버튼 존재
  const farmBtn = page.locator("button", { hasText: "🌱 농가" });
  assert(await farmBtn.count() > 0, "H-2-3: 🌱 농가 퀵 로그인 버튼 존재");

  // [4] 셰프 퀵 로그인 동작
  console.log("\n  셰프 퀵 로그인 시도...");
  await chefBtn.click();
  await page.waitForTimeout(4000);
  await dismissOverlays(page);
  const chefLoggedIn = await page.locator("button", { hasText: "딜 만들기" }).count() > 0;
  assert(chefLoggedIn, "H-2-4: 셰프 퀵 로그인 → 앱 진입 성공");

  // 로그아웃
  const logoutBtn = page.locator("button", { hasText: /로그아웃/ });
  if (await logoutBtn.count() > 0) { await logoutBtn.click(); await page.waitForTimeout(2000); }
  await page.goto(BASE);
  await page.waitForSelector('input[type="email"]', { timeout: 15000 });

  // [5] 농가 퀵 로그인 동작
  console.log("\n  농가 퀵 로그인 시도...");
  const farmBtn2 = page.locator("button", { hasText: "🌱 농가" });
  await farmBtn2.click();
  await page.waitForTimeout(4000);
  await dismissOverlays(page);
  const farmLoggedIn = await page.locator("button", { hasText: "딜 찾기" }).count() > 0;
  assert(farmLoggedIn, "H-2-5: 농가 퀵 로그인 → 앱 진입 성공");

  await browser.close();

  console.log(`\n결과: ${passed} / ${passed + failed} 통과`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => { console.error("오류:", err.message); process.exit(1); });
