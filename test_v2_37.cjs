/**
 * test_v2_37.cjs
 * v2.37 — 11~14번: favFarms Firestore + balance-due-notified 정리 + SAMPLE_DEALS DEV전용 + sectionStyle 공통화
 *
 * [1]  favFarmsKey 함수 코드 존재
 * [2]  saveFavFarms에서 storage.set(favFarmsKey(uid)) Firestore 동기화 코드 존재
 * [3]  MyDealsScreen/ChefProfileScreen의 favFarms Firestore 로드 useEffect 코드 존재
 * [4]  cleanBalanceDueKeys 함수 코드 존재 (startsWith 기반 키 정리)
 * [5]  handleCompleteDeal에서 cleanBalanceDueKeys 호출 코드 존재
 * [6]  handleDeleteDeal / handleCloseDeal에서 cleanBalanceDueKeys 호출 코드 존재
 * [7]  SAMPLE_DEALS가 import.meta.env.DEV 조건으로 분기됨
 * [8]  SECTION_LABEL_STYLE 공통 상수 코드 존재
 * [9]  sectionCardStyle 함수 코드 존재
 * [10] 브라우저: 셰프 로그인 → 내 거래 + 대시보드 탭 정상 진입 (리팩토링 후 앱 무결성)
 */

const { chromium } = require("playwright");
const fs = require("fs");

const BASE = "http://localhost:5173";
const APP_JSX = "c:/Users/USER/Desktop/D.N.A/farm-to-table-project/farm-to-table-project/src/App.jsx";
const TS = Date.now();

const CHEF_EMAIL = `v237chef_${TS}@test.com`;
const PW = "testpass123";
const CHEF_NAME = `v237셰프${TS % 10000}`;

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
  if (await btn.count() > 0) { await btn.first().click({ force: true }); await page.waitForTimeout(1500); }
}

async function run() {
  console.log("\n====================================================");
  console.log("v2.37 favFarms Firestore + balance-due 정리 + SAMPLE_DEALS DEV + sectionStyle 공통화 (10개)");
  console.log("====================================================\n");

  const code = fs.readFileSync(APP_JSX, "utf8");

  // ── [1~9] 정적 코드 검증 ──
  console.log("── [1~9] 정적 코드 검증 ──\n");

  assert(
    code.includes("const favFarmsKey = (uid)") && code.includes("fav-farms-"),
    "[1] v2.37 — favFarmsKey 함수 코드 존재"
  );

  assert(
    code.includes("storage.set(favFarmsKey(uid)"),
    "[2] v2.37 — saveFavFarms에서 Firestore 동기화 코드 존재"
  );

  assert(
    code.includes("storage.get(favFarmsKey(userId))"),
    "[3] v2.37 — favFarms Firestore 로드 useEffect 코드 존재"
  );

  assert(
    code.includes("cleanBalanceDueKeys") &&
    code.includes("startsWith(`balance-due-notified-${dealId}-`)"),
    "[4] v2.37 — cleanBalanceDueKeys 함수 코드 존재"
  );

  assert(
    code.includes("handleCompleteDeal") && (function() {
      const idx = code.indexOf("handleCompleteDeal");
      const body = code.slice(idx, idx + 400);
      return body.includes("cleanBalanceDueKeys(dealId)");
    })(),
    "[5] v2.37 — handleCompleteDeal에서 cleanBalanceDueKeys 호출"
  );

  assert(
    (function() {
      const delIdx = code.indexOf("handleDeleteDeal");
      const closeIdx = code.indexOf("handleCloseDeal");
      const delBody = code.slice(delIdx, delIdx + 250);
      const closeBody = code.slice(closeIdx, closeIdx + 450);
      return delBody.includes("cleanBalanceDueKeys(dealId)") && closeBody.includes("cleanBalanceDueKeys(dealId)");
    })(),
    "[6] v2.37 — handleDeleteDeal, handleCloseDeal에서 cleanBalanceDueKeys 호출"
  );

  assert(
    code.includes("import.meta.env.DEV") && code.includes("SAMPLE_DEALS = import.meta.env.DEV ?"),
    "[7] v2.37 — SAMPLE_DEALS가 import.meta.env.DEV 조건으로 분기됨"
  );

  assert(
    code.includes("const SECTION_LABEL_STYLE = {") && code.includes("letterSpacing:"),
    "[8] v2.37 — SECTION_LABEL_STYLE 공통 상수 코드 존재"
  );

  assert(
    code.includes("const sectionCardStyle = (isMobile) =>"),
    "[9] v2.37 — sectionCardStyle 함수 코드 존재"
  );

  // ── [10] 브라우저 UI 테스트 ──
  console.log("\n── [10] 브라우저 UI 테스트 ──\n");

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  await signup(page, CHEF_EMAIL, PW, "chef", CHEF_NAME);

  // 내 거래 탭
  await goToTab(page, "내 거래");
  const body1 = await page.locator("body").innerText();
  const myDealsOk = body1.length > 0 && !body1.includes("오류") && !body1.includes("TypeError");

  // 대시보드 탭
  await goToTab(page, "대시보드");
  const body2 = await page.locator("body").innerText();
  const dashboardOk = body2.length > 0 && !body2.includes("오류") && !body2.includes("TypeError");

  assert(
    myDealsOk && dashboardOk,
    "[10] v2.37 — 셰프 내 거래 + 대시보드 탭 정상 진입 (리팩토링 후 앱 무결성)"
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
