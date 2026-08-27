/**
 * test_v2_46.cjs
 * v2.46 — MEDIUM 3개 항목 검증
 *
 * [1]  M-1a: 글로벌 CSS에 ftt-pulse 키프레임 존재
 * [2]  M-1b: ftt-badge-pulse 클래스 존재 + 탭 뱃지에 적용
 * [3]  M-2a: 글로벌 CSS에 ftt-fade 키프레임 존재
 * [4]  M-2b: 탭 콘텐츠 래퍼에 key={tab} + ftt-tab-content 클래스 존재
 * [5]  M-3a: newDealId 상태 존재 (App)
 * [6]  M-3b: handleCreateDeal에 setNewDealId + setTimeout 존재
 * [7]  M-3c: MyDealsScreen 호출에 newDealId prop 존재
 * [8]  M-3d: MyDealsScreen 함수에 newDealId 파라미터 + NEW 뱃지 코드 존재
 * [9]  브라우저: 셰프 로그인 → 딜 만들기 → 내 거래 탭 진입 (앱 무결성)
 */

const { chromium } = require("playwright");
const fs = require("fs");

const BASE = "http://localhost:5186";
const APP_JSX = "c:/Users/USER/Desktop/D.N.A/farm-to-table-project/farm-to-table-project/src/App.jsx";
const TS = Date.now();

const CHEF_EMAIL = `v246chef_${TS}@test.com`;
const PW = "testpass123";
const CHEF_NAME = `v246셰프${TS % 10000}`;

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
  await page.waitForSelector('input[type="email"]', { timeout: 20000 });
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
  if (await btn.count() > 0) { await btn.first().click({ force: true }); await page.waitForTimeout(1500); }
}

async function run() {
  console.log("\n====================================================");
  console.log("v2.46 — MEDIUM 3개 항목 + 브라우저 UI 검증");
  console.log("====================================================\n");

  const code = fs.readFileSync(APP_JSX, "utf8");
  const normalized = code.replace(/\r\n/g, "\n");

  console.log("── [1~8] 정적 코드 검증 ──\n");

  // [1] ftt-pulse 키프레임
  assert(
    normalized.includes("@keyframes ftt-pulse") &&
    normalized.includes("ftt-pulse 2s ease-in-out infinite"),
    "[1] v2.46 — M-1a: ftt-pulse 키프레임 + badge-pulse 애니메이션 정의 존재"
  );

  // [2] ftt-badge-pulse 클래스 + 탭 뱃지 적용
  assert(
    normalized.includes(".ftt-badge-pulse") &&
    normalized.includes('className="ftt-badge-pulse"'),
    "[2] v2.46 — M-1b: ftt-badge-pulse CSS 클래스 + 탭 뱃지 적용 존재"
  );

  // [3] ftt-fade 키프레임
  assert(
    normalized.includes("@keyframes ftt-fade") &&
    normalized.includes("ftt-fade 0.15s ease"),
    "[3] v2.46 — M-2a: ftt-fade 키프레임 + ftt-tab-content 클래스 정의 존재"
  );

  // [4] 탭 콘텐츠 래퍼 key + 클래스
  assert(
    normalized.includes('key={tab}') &&
    normalized.includes('className="ftt-tab-content"'),
    "[4] v2.46 — M-2b: 탭 콘텐츠 래퍼에 key={tab} + ftt-tab-content 클래스 존재"
  );

  // [5] newDealId 상태
  assert(
    normalized.includes("const [newDealId, setNewDealId] = useState(null)"),
    "[5] v2.46 — M-3a: newDealId 상태 선언 존재"
  );

  // [6] handleCreateDeal setNewDealId + setTimeout
  assert(
    normalized.includes("setNewDealId(newDeal.id)") &&
    normalized.includes("setTimeout(() => setNewDealId(null), 5000)"),
    "[6] v2.46 — M-3b: handleCreateDeal에 setNewDealId + 5초 timeout 존재"
  );

  // [7] MyDealsScreen 호출에 newDealId prop
  assert(
    normalized.includes("newDealId={newDealId}"),
    "[7] v2.46 — M-3c: MyDealsScreen 호출에 newDealId prop 존재"
  );

  // [8] MyDealsScreen 파라미터 + NEW 뱃지
  assert(
    normalized.includes("newDealId = null }") &&
    normalized.includes("deal.id === newDealId") &&
    normalized.includes(">\\nNEW\\n") === false &&
    normalized.includes("NEW"),
    "[8] v2.46 — M-3d: MyDealsScreen newDealId 파라미터 + NEW 뱃지 코드 존재"
  );

  // ── [9] 브라우저 UI 테스트 ──
  console.log("\n── [9] 브라우저 UI 테스트 ──\n");

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  await signup(page, CHEF_EMAIL, PW, "chef", CHEF_NAME);

  // 딜 만들기 탭 진입 확인
  await goToTab(page, "딜 만들기");
  const body1 = await page.locator("body").innerText();
  const createOk = body1.length > 0 && !body1.includes("TypeError");

  // 내 거래 탭 진입 확인
  await goToTab(page, "내 거래");
  const body2 = await page.locator("body").innerText();
  const myDealsOk = body2.length > 0 && !body2.includes("TypeError");

  // 탭 전환 — ftt-tab-content 클래스가 DOM에 있는지 확인
  const tabContent = await page.locator(".ftt-tab-content").count();

  assert(
    createOk && myDealsOk && tabContent > 0,
    "[9] v2.46 — 셰프 탭 전환 정상 + ftt-tab-content 클래스 DOM 존재 (M-1/2/3 적용 후 무결성)"
  );

  await ctx.close();
  await browser.close();

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
