/**
 * test_v2_44.cjs
 * v2.44 — MEDIUM 8개 항목 검증
 *
 * [1]  UX-03a: handleCreateDeal 성공 후 toast "딜이 등록됐습니다"
 * [2]  UX-03b: handleSubmitProposal 성공 후 toast "제안이 전송됐습니다"
 * [3]  UX-03c: handleSelectProposal 성공 후 toast "농가를 선택했습니다"
 * [4]  UX-03d: handleSignContract role별 분기 toast
 * [5]  UX-03e: handleShipDeal 성공 후 toast "납품 신고 완료"
 * [6]  UX-03f: handleConfirmDelivery 성공 후 toast "수령 확인 완료"
 * [7]  UX-03g: handleRateChef / handleRateProposal 성공 후 toast "평점을 남겼습니다"
 * [8]  UX-04:  채팅 빈 상태 아이콘+메시지 개선 (💬 + "아직 대화가 없습니다")
 * [9]  브라우저: 농가 로그인 → 딜 찾기 + 내 제안 탭 정상 진입 (전체 무결성)
 */

const { chromium } = require("playwright");
const fs = require("fs");

const BASE = "http://localhost:5186";
const APP_JSX = "c:/Users/USER/Desktop/D.N.A/farm-to-table-project/farm-to-table-project/src/App.jsx";
const TS = Date.now();

const FARM_EMAIL = `v244farm_${TS}@test.com`;
const PW = "testpass123";
const FARM_NAME = `v244농가${TS % 10000}`;

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
  console.log("v2.44 — MEDIUM 8개 항목 + 브라우저 UI 검증");
  console.log("====================================================\n");

  const code = fs.readFileSync(APP_JSX, "utf8");
  const normalized = code.replace(/\r\n/g, "\n");

  console.log("── [1~8] 정적 코드 검증 ──\n");

  // [1] handleCreateDeal toast — 고유 문자열 직접 검색
  assert(
    normalized.includes('setToastMsg("✅ 딜이 등록됐습니다!")'),
    "[1] v2.44 — UX-03a: handleCreateDeal 성공 toast 존재"
  );

  // [2] handleSubmitProposal toast
  assert(
    normalized.includes('setToastMsg("✅ 제안이 전송됐습니다!")'),
    "[2] v2.44 — UX-03b: handleSubmitProposal 성공 toast 존재"
  );

  // [3] handleSelectProposal toast
  assert(
    normalized.includes("농가를 선택했습니다") && (function() {
      const idx = normalized.indexOf("농가를 선택했습니다");
      return normalized.slice(Math.max(0, idx - 50), idx + 5).includes("setToastMsg");
    })(),
    "[3] v2.44 — UX-03c: handleSelectProposal 성공 toast 존재"
  );

  // [4] handleSignContract role별 toast
  assert(
    normalized.includes("waitingFor") && normalized.includes("✍️ 서명 완료!"),
    "[4] v2.44 — UX-03d: handleSignContract role별 toast 존재"
  );

  // [5] handleShipDeal toast
  assert(
    normalized.includes('setToastMsg("📦 납품 신고 완료!")'),
    "[5] v2.44 — UX-03e: handleShipDeal 성공 toast 존재"
  );

  // [6] handleConfirmDelivery toast
  assert(
    normalized.includes('setToastMsg("✅ 수령 확인 완료! 잔금 결제를 진행해 주세요.")'),
    "[6] v2.44 — UX-03f: handleConfirmDelivery 성공 toast 존재"
  );

  // [7] handleRateChef toast
  assert(
    normalized.includes("평점을 남겼습니다") && (function() {
      const idx = normalized.indexOf("평점을 남겼습니다");
      return normalized.slice(Math.max(0, idx - 50), idx + 10).includes("setToastMsg");
    })(),
    "[7] v2.44 — UX-03g: handleRateChef 성공 toast 존재"
  );

  // [8] 채팅 빈 상태 개선
  assert(
    normalized.includes("아직 대화가 없습니다") && normalized.includes("첫 메시지를 보내 대화를 시작해 보세요"),
    "[8] v2.44 — UX-04: 채팅 빈 상태 아이콘+메시지 개선"
  );

  // ── [9] 브라우저 UI 테스트 ──
  console.log("\n── [9] 브라우저 UI 테스트 ──\n");

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  await signup(page, FARM_EMAIL, PW, "farm", FARM_NAME);

  await goToTab(page, "딜 찾기");
  const body1 = await page.locator("body").innerText();
  const browseOk = body1.length > 0 && !body1.includes("TypeError") && !body1.includes("오류");

  await goToTab(page, "내 제안");
  const body2 = await page.locator("body").innerText();
  const proposalsOk = body2.length > 0 && !body2.includes("TypeError") && !body2.includes("오류");

  assert(
    browseOk && proposalsOk,
    "[9] v2.44 — 농가 딜 찾기 + 내 제안 탭 정상 진입 (MEDIUM 8개 적용 후 앱 무결성)"
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
