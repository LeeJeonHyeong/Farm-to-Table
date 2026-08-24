/**
 * test_v2_35.cjs
 * v2.35 — SEC-01 env 이전 + SEC-02 주석 + UX-01 userId 전파 + UX-02 ShipModal finally + QUAL-01 Hook 순서
 *
 * [1]  SEC-01: ADMIN_EMAIL이 하드코딩 문자열로 없고 import.meta.env.VITE_ADMIN_EMAIL 참조 존재
 * [2]  SEC-01: TOSS_CLIENT_KEY가 하드코딩 문자열로 없고 import.meta.env.VITE_TOSS_CLIENT_KEY 참조 존재
 * [3]  SEC-02: isAdmin 근처 SEC-02 주석 존재
 * [4]  UX-01: DealDetailView 함수 시그니처에 userId prop 포함
 * [5]  UX-01: DealBrowseScreen의 DealDetailView 렌더에 userId={userId} 전달
 * [6]  UX-02: ShipModal 확인 버튼에 finally { setLoading(false) } 코드 존재
 * [7]  QUAL-01: DealCreateScreen의 useIsMobile() 호출이 done early return 이전에 존재
 * [8]  QUAL-01: DealCreateScreen의 if (done) return 이후에 const isMobile = useIsMobile() 패턴 없음
 * [9]  브라우저: 농가 로그인 → 딜 찾기 탭 정상 진입 (UX-01 수정 후 앱 무결성)
 * [10] 브라우저: 셰프 로그인 → 딜 만들기 탭 정상 진입 (QUAL-01 수정 후 Hooks 오류 없음)
 */

const { chromium } = require("playwright");
const fs = require("fs");

const BASE = "http://localhost:5173";
const APP_JSX = "c:/Users/USER/Desktop/D.N.A/farm-to-table-project/farm-to-table-project/src/App.jsx";
const TS = Date.now();

const CHEF_EMAIL = `v235chef_${TS}@test.com`;
const FARM_EMAIL = `v235farm_${TS}@test.com`;
const PW = "testpass123";
const CHEF_NAME = `v235셰프${TS % 10000}`;
const FARM_NAME = `v235농가${TS % 10000}`;

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
  console.log("v2.35 SEC-01/02 + UX-01/02 + QUAL-01 (10개)");
  console.log("====================================================\n");

  const code = fs.readFileSync(APP_JSX, "utf8");

  // ── [1~8] 정적 코드 검증 ──
  console.log("── [1~8] 정적 코드 검증 ──\n");

  assert(
    code.includes("import.meta.env.VITE_ADMIN_EMAIL") &&
    !code.includes('"jhlove0490@nonghyup.com"'),
    "[1] v2.35 — ADMIN_EMAIL을 import.meta.env.VITE_ADMIN_EMAIL로 이전"
  );

  assert(
    code.includes("import.meta.env.VITE_TOSS_CLIENT_KEY") &&
    !code.includes('"test_ck_D5GePWvyJnrK0W0k6q8gLzN97Eoq"'),
    "[2] v2.35 — TOSS_CLIENT_KEY를 import.meta.env.VITE_TOSS_CLIENT_KEY로 이전"
  );

  assert(
    code.includes("SEC-02") && code.includes("isAdmin"),
    "[3] v2.35 — isAdmin 근처 SEC-02 주석 존재"
  );

  assert(
    code.includes("function DealDetailView(") && code.includes("onSubmitInquiry, userId }"),
    "[4] v2.35 — DealDetailView 시그니처에 userId prop 포함"
  );

  assert(
    code.includes("userId={userId}") && code.includes("onBack={() => setDetailDeal(null)}"),
    "[5] v2.35 — DealBrowseScreen의 DealDetailView에 userId={userId} 전달"
  );

  assert(
    code.includes("finally { setLoading(false);") || code.includes("finally { setLoading(false) }"),
    "[6] v2.35 — ShipModal 확인 버튼 finally { setLoading(false) } 존재"
  );

  // QUAL-01: done early return 이전에 useIsMobile 호출이 있어야 함
  const doneReturnIdx = code.indexOf("if (done) {");
  const useMobileIdx = code.indexOf("const isMobile = useIsMobile()");
  // DealCreateScreen 내 최초 done 이후의 useIsMobile 호출 위치 확인
  // DealCreateScreen 시작 위치
  const dealCreateIdx = code.indexOf("function DealCreateScreen(");
  const isMobileInDealCreate = code.indexOf("const isMobile = useIsMobile()", dealCreateIdx);
  assert(
    dealCreateIdx > 0 && isMobileInDealCreate > dealCreateIdx && isMobileInDealCreate < doneReturnIdx,
    "[7] v2.35 — DealCreateScreen의 useIsMobile() 호출이 if(done) return 이전에 존재"
  );

  // done return 이후에 중복 useIsMobile 호출이 없어야 함
  const afterDoneReturn = code.indexOf("const isMobile = useIsMobile()", doneReturnIdx + 50);
  // 다음 함수 경계까지 탐색 (afterDoneReturn가 같은 함수 내인지 확인)
  const nextFunctionAfterDone = code.indexOf("\nfunction ", doneReturnIdx);
  assert(
    afterDoneReturn === -1 || afterDoneReturn > nextFunctionAfterDone,
    "[8] v2.35 — if(done) return 이후 DealCreateScreen 내에 중복 useIsMobile 없음"
  );

  // ── [9~10] 브라우저 UI 테스트 ──
  console.log("\n── [9~10] 브라우저 UI 테스트 ──\n");

  const browser = await chromium.launch({ headless: true });

  // 농가 로그인 → 딜 찾기
  const farmCtx = await browser.newContext();
  const farmPage = await farmCtx.newPage();
  await signup(farmPage, FARM_EMAIL, PW, "farm", FARM_NAME);
  await goToTab(farmPage, "딜 찾기");
  const farmBody = await farmPage.locator("body").innerText();
  assert(
    farmBody.length > 0 && !farmBody.includes("오류") && farmPage.url().includes("localhost"),
    "[9] v2.35 — 농가 로그인 → 딜 찾기 탭 정상 진입 (UX-01 수정 후)"
  );
  await farmCtx.close();

  // 셰프 로그인 → 딜 만들기
  const chefCtx = await browser.newContext();
  const chefPage = await chefCtx.newPage();
  await signup(chefPage, CHEF_EMAIL, PW, "chef", CHEF_NAME);
  await goToTab(chefPage, "딜 만들기");
  const chefBody = await chefPage.locator("body").innerText();
  assert(
    chefBody.length > 0 && !chefBody.includes("오류") && chefPage.url().includes("localhost"),
    "[10] v2.35 — 셰프 로그인 → 딜 만들기 탭 정상 진입 (QUAL-01 수정 후 Hooks 오류 없음)"
  );
  await chefCtx.close();

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
