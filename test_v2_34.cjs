/**
 * test_v2_34.cjs
 * v2.34 — ScoreBreakdown 컴포넌트 추출 + 북마크 키 명확화
 *
 * [1]  ScoreBreakdown 컴포넌트 함수 코드 존재
 * [2]  ScoreBreakdown size="compact" prop 처리 코드 존재
 * [3]  SCORE_BREAKDOWN_LABELS.map 중복 블록 제거 확인 (0개)
 * [4]  <ScoreBreakdown> 사용이 3곳 존재
 * [5]  fav-farms-{uid} 에 셰프 전용 주석 코드 존재
 * [6]  farm-bookmarks-{uid} 에 farmer 전용 주석 코드 존재
 * [7]  getFavFarms / saveFavFarms 함수 코드 존재 (기존 기능 보존)
 * [8]  bookmarkKey 함수 코드 존재 (기존 기능 보존)
 * [9]  브라우저: 셰프 로그인 → 내 거래 탭 정상 진입 (리팩토링 후 앱 무결성)
 * [10] 브라우저: 농가 로그인 → 딜 찾기 탭 정상 진입 (ScoreBreakdown 렌더 오류 없음)
 */

const { chromium } = require("playwright");
const fs = require("fs");

const BASE = "http://localhost:5173";
const APP_JSX = "c:/Users/USER/Desktop/D.N.A/farm-to-table-project/farm-to-table-project/src/App.jsx";
const TS = Date.now();

const CHEF_EMAIL = `v234chef_${TS}@test.com`;
const FARM_EMAIL = `v234farm_${TS}@test.com`;
const PW = "testpass123";
const CHEF_NAME = `v234셰프${TS % 10000}`;
const FARM_NAME = `v234농가${TS % 10000}`;

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
  console.log("v2.34 ScoreBreakdown 컴포넌트 추출 + 북마크 키 명확화 (10개)");
  console.log("====================================================\n");

  const code = fs.readFileSync(APP_JSX, "utf8");

  // ── [1~8] 정적 코드 검증 ──
  console.log("── [1~8] 정적 코드 검증 ──\n");

  assert(
    code.includes("function ScoreBreakdown(") && code.includes("SCORE_BREAKDOWN_LABELS.map"),
    "[1] v2.34 — ScoreBreakdown 컴포넌트 함수 코드 존재"
  );

  assert(
    code.includes('size === "compact"') || code.includes("size==\"compact\""),
    "[2] v2.34 — ScoreBreakdown compact 사이즈 처리 코드 존재"
  );

  // SCORE_BREAKDOWN_LABELS.map이 컴포넌트 정의 내부에만 1곳 존재해야 함
  const mapMatches = (code.match(/SCORE_BREAKDOWN_LABELS\.map/g) || []).length;
  assert(
    mapMatches === 1,
    `[3] v2.34 — SCORE_BREAKDOWN_LABELS.map 중복 제거 (현재 ${mapMatches}곳 → 1곳이어야 함)`
  );

  // <ScoreBreakdown 사용이 3곳
  const usageMatches = (code.match(/<ScoreBreakdown /g) || []).length;
  assert(
    usageMatches === 3,
    `[4] v2.34 — <ScoreBreakdown> 사용 3곳 (현재 ${usageMatches}곳)`
  );

  assert(
    code.includes("셰프가 즐겨찾기한 농가") && code.includes("fav-farms-"),
    "[5] v2.34 — fav-farms 셰프 전용 주석 코드 존재"
  );

  assert(
    code.includes("농가가 관심 딜을 저장한 북마크") && code.includes("farm-bookmarks-"),
    "[6] v2.34 — farm-bookmarks farmer 전용 주석 코드 존재"
  );

  assert(
    code.includes("getFavFarms") && code.includes("saveFavFarms"),
    "[7] v2.34 — getFavFarms / saveFavFarms 함수 보존"
  );

  assert(
    code.includes("const bookmarkKey = (uid)"),
    "[8] v2.34 — bookmarkKey 함수 보존"
  );

  // ── [9~10] 브라우저 UI 테스트 ──
  console.log("\n── [9~10] 브라우저 UI 테스트 ──\n");

  const browser = await chromium.launch({ headless: true });

  // 셰프 로그인 → 내 거래
  const chefCtx = await browser.newContext();
  const chefPage = await chefCtx.newPage();
  await signup(chefPage, CHEF_EMAIL, PW, "chef", CHEF_NAME);
  await goToTab(chefPage, "내 거래");
  const chefBody = await chefPage.locator("body").innerText();
  assert(
    chefBody.length > 0 && !chefBody.includes("오류") && chefPage.url().includes("localhost"),
    "[9] v2.34 — 셰프 로그인 → 내 거래 탭 정상 진입"
  );
  await chefCtx.close();

  // 농가 로그인 → 딜 찾기
  const farmCtx = await browser.newContext();
  const farmPage = await farmCtx.newPage();
  await signup(farmPage, FARM_EMAIL, PW, "farm", FARM_NAME);
  await goToTab(farmPage, "딜 찾기");
  const farmBody = await farmPage.locator("body").innerText();
  assert(
    farmBody.length > 0 && !farmBody.includes("오류") && farmPage.url().includes("localhost"),
    "[10] v2.34 — 농가 로그인 → 딜 찾기 탭 정상 진입 (ScoreBreakdown 오류 없음)"
  );
  await farmCtx.close();

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
