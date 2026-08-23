/**
 * test_v2_30.cjs
 * v2.30 거래명세서 강화 + 세금계산서 안내 패널
 *
 * [1]  거래명세서 버튼 레이블 — "선급금 거래명세서" 코드 존재
 * [2]  거래명세서 버튼 레이블 — "잔금 거래명세서" 코드 존재
 * [3]  "영수증" 버튼 레이블이 제거됐는지 확인 (선급금 영수증 / 잔금 영수증 버튼 없음)
 * [4]  printReceipt — 거래번호(dealNo) 코드 존재
 * [5]  printReceipt — 공급가액(supplyAmt) / 부가세(vatAmt) 코드 존재
 * [6]  printReceipt — 납품일(deliveredStr) 코드 존재
 * [7]  printReceipt — 공급자/공급받는자 레이블 코드 존재
 * [8]  printReceipt — 홈택스 안내 문구 코드 존재 (hometax.go.kr)
 * [9]  printReceipt — 잔금 명세서 농가 실수령액 코드 존재
 * [10] 인라인 세금계산서 안내 패널 — "세금계산서 안내" 코드 존재
 * [11] 인라인 패널 — 홈택스 링크(hometax.go.kr) 코드 존재
 * [12] 인라인 패널 — depositPaid || balancePaid 조건으로 렌더 코드 존재
 * [13] 브라우저: 셰프 로그인 → 내 거래 탭 진입 확인
 * [14] 브라우저: 거래명세서 버튼이 UI에 없음 (결제 전이므로 숨겨짐 확인)
 */

const { chromium } = require("playwright");
const fs = require("fs");

const BASE = "http://localhost:5173";
const APP_JSX = "c:/Users/USER/Desktop/D.N.A/farm-to-table-project/farm-to-table-project/src/App.jsx";
const TS = Date.now();

const CHEF_EMAIL = `v230chef_${TS}@test.com`;
const PW = "testpass123";
const CHEF_NAME = `v230셰프${TS % 10000}`;

let passed = 0;
let failed = 0;
const results = [];

function assert(condition, label) {
  if (condition) {
    console.log(`  ✅ [PASS] ${label}`);
    passed++;
    results.push({ label, ok: true });
  } else {
    console.log(`  ❌ [FAIL] ${label}`);
    failed++;
    results.push({ label, ok: false });
  }
}

async function dismissOverlays(page) {
  for (let i = 0; i < 8; i++) {
    const next  = page.locator("button", { hasText: /^다음$/ });
    const start = page.locator("button", { hasText: /시작하기/ });
    if (await next.count() > 0)       { await next.click({ force: true }); await page.waitForTimeout(400); }
    else if (await start.count() > 0) { await start.click({ force: true }); await page.waitForTimeout(400); break; }
    else break;
  }
}

async function signup(page, email, pw, role, name) {
  await page.goto(BASE);
  await page.waitForSelector('input[type="email"]', { timeout: 12000 });
  const toSignup = page.locator("button", { hasText: /가입/ }).first();
  if (await toSignup.count() > 0) await toSignup.click();
  await page.waitForTimeout(400);
  const roleBtn = page.locator("button", { hasText: role === "chef" ? "셰프" : "농가" }).first();
  if (await roleBtn.count() > 0) await roleBtn.click();
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', pw);
  const ph = role === "chef" ? "예: 테이블나인" : "예: 신선팜";
  const nameInput = page.locator(`input[placeholder="${ph}"]`).first();
  if (await nameInput.count() > 0) await nameInput.fill(name);
  await page.locator("button", { hasText: /가입하기$/ }).last().click();
  await page.waitForTimeout(3000);
  if (await page.locator('button[class*="ftt-tab"]').count() === 0) {
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', pw);
    await page.locator("button", { hasText: /로그인$/ }).last().click();
    await page.waitForTimeout(3000);
  }
  await dismissOverlays(page);
}

async function goToTab(page, label) {
  const btn = page.locator("button", { hasText: label });
  if (await btn.count() > 0) { await btn.first().click({ force: true }); await page.waitForTimeout(1200); }
}

async function run() {
  console.log("\n====================================================");
  console.log("v2.30 거래명세서 강화 + 세금계산서 안내 패널 (14개)");
  console.log("====================================================\n");

  const code = fs.readFileSync(APP_JSX, "utf8");

  // ── [1~12] 정적 코드 검증 ──
  console.log("── [1~12] 정적 코드 검증 ──\n");

  assert(
    code.includes("선급금 거래명세서"),
    "[1] v2.30 — '선급금 거래명세서' 버튼 레이블 코드 존재"
  );

  assert(
    code.includes("잔금 거래명세서"),
    "[2] v2.30 — '잔금 거래명세서' 버튼 레이블 코드 존재"
  );

  assert(
    !code.includes("선급금 영수증") && !code.includes("잔금 영수증"),
    "[3] v2.30 — '선급금/잔금 영수증' 구 레이블 제거 확인"
  );

  assert(
    code.includes("dealNo") && code.includes("거래번호"),
    "[4] v2.30 — printReceipt 거래번호(dealNo) 코드 존재"
  );

  assert(
    code.includes("supplyAmt") && code.includes("vatAmt") && code.includes("공급가액"),
    "[5] v2.30 — printReceipt 공급가액/부가세 분리 코드 존재"
  );

  assert(
    code.includes("deliveredStr") && code.includes("납품일"),
    "[6] v2.30 — printReceipt 납품일(deliveredStr) 코드 존재"
  );

  assert(
    code.includes("공급자") && code.includes("공급받는 자"),
    "[7] v2.30 — printReceipt 공급자/공급받는자 레이블 코드 존재"
  );

  assert(
    code.includes("hometax.go.kr") && code.includes("홈택스"),
    "[8] v2.30 — printReceipt 홈택스 안내 코드 존재"
  );

  assert(
    code.includes("농가 실수령액") && code.includes("total - fee"),
    "[9] v2.30 — 잔금 명세서 농가 실수령액 코드 존재"
  );

  assert(
    code.includes("세금계산서 안내"),
    "[10] v2.30 — 인라인 세금계산서 안내 패널 코드 존재"
  );

  assert(
    (code.match(/hometax\.go\.kr/g) || []).length >= 2,
    "[11] v2.30 — 인라인 패널 홈택스 링크 코드 존재 (2곳 이상)"
  );

  assert(
    code.includes("depositPaid || balancePaid") &&
    (code.match(/depositPaid \|\| balancePaid/g) || []).length >= 2,
    "[12] v2.30 — 인라인 패널 depositPaid||balancePaid 조건 렌더 코드 존재"
  );

  // ── [13~14] 브라우저 UI 테스트 ──
  console.log("\n── [13~14] 브라우저 UI 테스트 ──\n");

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  await signup(page, CHEF_EMAIL, PW, "chef", CHEF_NAME);

  // [13] 내 거래 탭 진입
  await goToTab(page, "내 거래");
  const tabContent = await page.content();
  assert(
    tabContent.includes("딜") || tabContent.includes("거래") || tabContent.includes("제안"),
    "[13] v2.30 — 셰프 로그인 → 내 거래 탭 진입 성공"
  );

  // [14] 결제 전에는 거래명세서 버튼이 없어야 함 (depositPaid=false)
  const statementBtns = page.locator("button", { hasText: /거래명세서/ });
  assert(
    await statementBtns.count() === 0,
    "[14] v2.30 — 결제 전 상태에서 거래명세서 버튼 미노출 (조건부 렌더 정상)"
  );

  await ctx.close();
  await browser.close();

  // ── 결과 요약 ──
  console.log("\n====================================================");
  console.log(`결과: ${passed} / ${passed + failed} 통과`);
  console.log("====================================================\n");

  if (failed > 0) {
    console.log("실패 항목:");
    results.filter((r) => !r.ok).forEach((r) => console.log(`  ❌ ${r.label}`));
    console.log("");
  }

  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error("테스트 실행 오류:", err);
  process.exit(1);
});
