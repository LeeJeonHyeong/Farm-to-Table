/**
 * test_v2_47.cjs
 * v2.47 — LOW 2개 항목 검증
 *
 * [1]  L-1a: useIsNarrow 훅 정의 존재 (< 1200px)
 * [2]  L-1b: FarmToTableApp에 isNarrow = useIsNarrow() 존재
 * [3]  L-1c: 사이드 SVG 조건이 !isNarrow로 교체됨 (left/right -118 SVG 14개)
 * [4]  L-1d: 사이드 SVG 조건에 !isMobile이 남아있지 않음 (해당 절대위치 SVG 기준)
 * [5]  L-2a: 필터 빈 상태에 이모지 + 안내 문구 개선 코드 존재
 * [6]  L-2b: 필터별 이모지 분기 (모집중🌱, 진행중🤝, 완료✅) 존재
 * [7]  브라우저: 셰프 로그인 → 내 거래 탭 진입 + 필터 클릭 → 오류 없음
 */

const { chromium } = require("playwright");
const fs = require("fs");

const BASE = "http://localhost:5186";
const APP_JSX = "c:/Users/USER/Desktop/D.N.A/farm-to-table-project/farm-to-table-project/src/App.jsx";
const TS = Date.now();

const CHEF_EMAIL = `v247chef_${TS}@test.com`;
const PW = "testpass123";
const CHEF_NAME = `v247셰프${TS % 10000}`;

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
  console.log("v2.47 — LOW 2개 항목 + 브라우저 UI 검증");
  console.log("====================================================\n");

  const code = fs.readFileSync(APP_JSX, "utf8");
  const normalized = code.replace(/\r\n/g, "\n");

  console.log("── [1~6] 정적 코드 검증 ──\n");

  // [1] useIsNarrow 훅 정의
  assert(
    normalized.includes("function useIsNarrow()") &&
    normalized.includes("window.innerWidth < 1200"),
    "[1] v2.47 — L-1a: useIsNarrow 훅 정의 존재 (< 1200px)"
  );

  // [2] FarmToTableApp에서 isNarrow 사용
  assert(
    normalized.includes("const isNarrow = useIsNarrow()"),
    "[2] v2.47 — L-1b: FarmToTableApp에 isNarrow = useIsNarrow() 존재"
  );

  // [3] 사이드 SVG 조건 !isNarrow로 교체
  const narrowLeftCount = (normalized.match(/\!isNarrow.*\n.*position: "absolute", left: -118/g) || []).length;
  const narrowRightCount = (normalized.match(/\!isNarrow.*\n.*position: "absolute", right: -118/g) || []).length;
  assert(
    narrowLeftCount >= 7 && narrowRightCount >= 7,
    `[3] v2.47 — L-1c: 사이드 SVG !isNarrow 조건 적용 (left:${narrowLeftCount}/7, right:${narrowRightCount}/7)`
  );

  // [4] 절대위치 -118 SVG에 !isMobile이 남아있지 않음
  const mobileLeft = (normalized.match(/\!isMobile.*\n.*position: "absolute", left: -118/g) || []).length;
  const mobileRight = (normalized.match(/\!isMobile.*\n.*position: "absolute", right: -118/g) || []).length;
  assert(
    mobileLeft === 0 && mobileRight === 0,
    `[4] v2.47 — L-1d: 절대위치 SVG에 !isMobile 잔존 없음 (left:${mobileLeft}, right:${mobileRight})`
  );

  // [5] 필터 빈 상태 개선 코드
  assert(
    normalized.includes("딜이 없습니다\n") &&
    normalized.includes("필터를 변경해 다른 거래를 확인해 보세요"),
    "[5] v2.47 — L-2a: 필터 빈 상태 개선 안내 문구 존재"
  );

  // [6] 필터별 이모지 분기
  assert(
    normalized.includes('"open" ? "🌱"') &&
    normalized.includes('"matched" ? "🤝"') &&
    normalized.includes('"done" ? "✅"'),
    "[6] v2.47 — L-2b: 필터별 이모지 분기 (🌱🤝✅) 존재"
  );

  // ── [7] 브라우저 UI 테스트 ──
  console.log("\n── [7] 브라우저 UI 테스트 ──\n");

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  await signup(page, CHEF_EMAIL, PW, "chef", CHEF_NAME);

  await goToTab(page, "내 거래");
  const body1 = await page.locator("body").innerText();
  const myDealsOk = body1.length > 0 && !body1.includes("TypeError");

  // 필터 버튼 클릭 (진행중)
  const matchedFilter = page.locator("button", { hasText: "진행중" });
  if (await matchedFilter.count() > 0) {
    await matchedFilter.first().click({ force: true });
    await page.waitForTimeout(800);
  }
  const body2 = await page.locator("body").innerText();
  const filterOk = body2.length > 0 && !body2.includes("TypeError") && !body2.includes("오류");

  assert(
    myDealsOk && filterOk,
    "[7] v2.47 — 내 거래 탭 + 필터 전환 오류 없음 (L-1/2 적용 후 앱 무결성)"
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
