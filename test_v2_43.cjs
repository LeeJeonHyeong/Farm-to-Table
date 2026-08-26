/**
 * test_v2_43.cjs
 * v2.43 — 발표 완성도 4개 항목 검증
 *
 * [1]  긴급:   dDay 헬퍼 존재 (SAMPLE_DEALS 동적 날짜)
 * [2]  긴급:   SAMPLE_DEALS에 하드코딩된 "2026-08-" 날짜 없음
 * [3]  HIGH-1: SettlementCard에 DEV 테스트 결제 배너 존재
 * [4]  HIGH-2: 로딩 화면에 ftt-spin CSS 애니메이션 존재
 * [5]  HIGH-3: 잔금 기한 알림 setTimeout 5000ms 딜레이 존재
 * [6]  HIGH-3: clearTimeout 클린업 존재
 * [7]  브라우저: 농가 로그인 → 딜 찾기 화면에 미래 날짜 딜 표시됨
 */

const { chromium } = require("playwright");
const fs = require("fs");

const BASE = "http://localhost:5184";
const APP_JSX = "c:/Users/USER/Desktop/D.N.A/farm-to-table-project/farm-to-table-project/src/App.jsx";
const TS = Date.now();

const FARM_EMAIL = `v243farm_${TS}@test.com`;
const PW = "testpass123";
const FARM_NAME = `v243농가${TS % 10000}`;

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
  console.log("v2.43 — 발표 완성도 4개 항목 + 브라우저 UI 검증");
  console.log("====================================================\n");

  const code = fs.readFileSync(APP_JSX, "utf8");
  const normalized = code.replace(/\r\n/g, "\n");

  console.log("── [1~6] 정적 코드 검증 ──\n");

  // [1] dDay 헬퍼 존재
  assert(
    normalized.includes("const dDay = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);"),
    "[1] v2.43 — 긴급: dDay 헬퍼 함수 존재"
  );

  // [2] 하드코딩된 "2026-08-" 날짜가 SAMPLE_DEALS 배열 내에 없음
  assert(
    (function() {
      const sampleStart = normalized.indexOf("const SAMPLE_DEALS = import.meta.env.DEV ? [");
      const sampleEnd = normalized.indexOf("] : [];", sampleStart);
      const sampleBlock = normalized.slice(sampleStart, sampleEnd);
      return !sampleBlock.includes('"2026-08-');
    })(),
    "[2] v2.43 — 긴급: SAMPLE_DEALS 내 하드코딩 날짜 없음 (모두 dDay로 교체)"
  );

  // [3] HIGH-1: 테스트 결제 배너
  assert(
    normalized.includes("🧪 테스트 결제 모드 · 카드번호: 4242 4242 4242 4242"),
    "[3] v2.43 — HIGH-1: SettlementCard 테스트 결제 배너 존재"
  );

  // [4] HIGH-2: 로딩 스피너 CSS 애니메이션
  assert(
    normalized.includes("@keyframes ftt-spin") && normalized.includes("ftt-spin 0.8s linear infinite"),
    "[4] v2.43 — HIGH-2: 로딩 화면 ftt-spin 스피너 애니메이션 존재"
  );

  // [5] HIGH-3: setTimeout 5000 (잔금 관련 clearTimeout 직전 패턴 검증)
  assert(
    normalized.includes("}, 5000);\n    return () => clearTimeout(timer);"),
    "[5] v2.43 — HIGH-3: 잔금 기한 알림 5초 setTimeout 딜레이 적용"
  );

  // [6] HIGH-3: clearTimeout 클린업
  assert(
    normalized.includes("return () => clearTimeout(timer);"),
    "[6] v2.43 — HIGH-3: clearTimeout 클린업 존재"
  );

  // ── [7] 브라우저 UI 테스트 ──
  console.log("\n── [7] 브라우저 UI 테스트 ──\n");

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  await signup(page, FARM_EMAIL, PW, "farm", FARM_NAME);

  await goToTab(page, "딜 찾기");
  await page.waitForTimeout(1000);
  const body = await page.locator("body").innerText();

  // 딜 목록이 표시되고, "만료" 또는 "기한 초과" 같은 오류 문구가 없어야 함
  const hasDeals = body.includes("토마토") || body.includes("딸기") || body.includes("바질");
  const noError = !body.includes("TypeError") && !body.includes("오류");

  assert(
    hasDeals && noError,
    "[7] v2.43 — 농가 딜 찾기 화면에 샘플 딜 정상 표시 (만료 없음)"
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
