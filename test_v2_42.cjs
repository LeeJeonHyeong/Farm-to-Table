/**
 * test_v2_42.cjs
 * v2.42 — 코드 리뷰 4개 항목 검증
 *
 * [1]  RACE-01: onSnapshot 효과에 pendingChatsSnap 클로저 변수 존재
 * [2]  RACE-01: deals 핸들러에서 dealsRef.current = newDeals 동기 업데이트
 * [3]  RACE-01: chats 핸들러가 chef + deals 미도착 시 pendingChatsSnap에 저장
 * [4]  RACE-01: deals 핸들러 끝에 pendingChatsSnap 재처리 로직 존재
 * [5]  UX-02:   RatingPanel handleSubmit에서 onSubmit 후 setSubmitting(false) 복원
 * [6]  STAB-03: DealDetailView effect 내 setChefData(null) 초기화 존재
 * [7]  PERF-04: chatUnreads useMemo dep이 user?.name
 * [8]  브라우저: 농가 로그인 → 딜 찾기 + 내 제안 탭 정상 진입 (전체 무결성)
 */

const { chromium } = require("playwright");
const fs = require("fs");

const BASE = "http://localhost:5182";
const APP_JSX = "c:/Users/USER/Desktop/D.N.A/farm-to-table-project/farm-to-table-project/src/App.jsx";
const TS = Date.now();

const FARM_EMAIL = `v242farm_${TS}@test.com`;
const PW = "testpass123";
const FARM_NAME = `v242농가${TS % 10000}`;

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
  console.log("v2.42 — 코드 리뷰 4개 항목 + 브라우저 UI 검증");
  console.log("====================================================\n");

  const code = fs.readFileSync(APP_JSX, "utf8");
  const normalized = code.replace(/\r\n/g, "\n");

  console.log("── [1~7] 정적 코드 검증 ──\n");

  // [1] RACE-01: pendingChatsSnap 클로저 변수
  assert(
    normalized.includes("let pendingChatsSnap = null;"),
    "[1] v2.42 — RACE-01: onSnapshot effect에 pendingChatsSnap 클로저 변수 존재"
  );

  // [2] RACE-01: dealsRef.current 동기 업데이트
  assert(
    normalized.includes("// RACE-01: ref를 동기적으로 갱신해야 processChats에서 최신 딜 참조 가능\n      dealsRef.current = newDeals;"),
    "[2] v2.42 — RACE-01: deals 핸들러에서 dealsRef.current 동기 업데이트"
  );

  // [3] RACE-01: chats 핸들러 — chef + 빈 dealsRef → pendingChatsSnap 저장
  assert(
    normalized.includes("pendingChatsSnap = snapshot;\n        return;"),
    "[3] v2.42 — RACE-01: chats 핸들러가 deals 미도착 시 snapshot 보존 후 return"
  );

  // [4] RACE-01: deals 핸들러 끝에 pendingChatsSnap 재처리
  assert(
    normalized.includes("processChats(pendingChatsSnap);\n        pendingChatsSnap = null;"),
    "[4] v2.42 — RACE-01: deals 도착 후 pendingChatsSnap 재처리"
  );

  // [5] UX-02: RatingPanel onSubmit 후 setSubmitting(false)
  assert(
    (function() {
      const ratingIdx = normalized.indexOf("function RatingPanel(");
      const ratingEnd = normalized.indexOf("\nfunction ", ratingIdx + 1);
      const ratingCode = normalized.slice(ratingIdx, ratingEnd > 0 ? ratingEnd : ratingIdx + 2000);
      return ratingCode.includes("onSubmit(rating, review);\n    setSubmitting(false);");
    })(),
    "[5] v2.42 — UX-02: RatingPanel onSubmit 후 setSubmitting(false) 복원"
  );

  // [6] STAB-03: DealDetailView effect 내 setChefData(null)
  assert(
    (function() {
      const effectIdx = normalized.indexOf("// STAB-02: 언마운트 후 setChefData 방지");
      const effectCode = normalized.slice(effectIdx > 0 ? effectIdx - 50 : 0, effectIdx + 400);
      return effectCode.includes("setChefData(null);");
    })(),
    "[6] v2.42 — STAB-03: DealDetailView effect 내 setChefData(null) 초기화"
  );

  // [7] PERF-04: chatUnreads dep user?.name
  assert(
    normalized.includes("[chats, lastChatRead, user?.name]"),
    "[7] v2.42 — PERF-04: chatUnreads useMemo dep이 user?.name"
  );

  // ── [8] 브라우저 UI 테스트 ──
  console.log("\n── [8] 브라우저 UI 테스트 ──\n");

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
    "[8] v2.42 — 농가 딜 찾기 + 내 제안 탭 정상 진입 (4개 수정 후 앱 무결성)"
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
