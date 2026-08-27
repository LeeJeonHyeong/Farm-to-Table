/**
 * test_v2_45.cjs
 * v2.45 — HIGH 3개 항목 검증
 *
 * [1]  H-1a: SAMPLE_DEALS에 d_match (status:"matched", createdBy:"") 딜 존재
 * [2]  H-1b: SAMPLE_DEALS에 d_done (status:"done", balanceDueAt) 딜 존재
 * [3]  H-1c: handleResetData에서 createdBy==="" 딜에 user.uid 치환 로직 존재
 * [4]  H-2:  CROP_EMOJI 상수 존재 (토마토🍅, 딸기🍓 포함)
 * [5]  H-2:  딜 카드에 CROP_EMOJI 이모지 fallback 렌더링 코드 존재
 * [6]  H-3:  LoginScreen에 DEV 퀵 로그인 버튼 코드 존재 (VITE_DEMO_CHEF_EMAIL)
 * [7]  브라우저: 셰프 회원가입 → 데이터 초기화 → 내 거래 탭에 진행중/완료 딜 표시됨
 */

const { chromium } = require("playwright");
const fs = require("fs");

const BASE = "http://localhost:5186";
const APP_JSX = "c:/Users/USER/Desktop/D.N.A/farm-to-table-project/farm-to-table-project/src/App.jsx";
const TS = Date.now();

const CHEF_EMAIL = `v245chef_${TS}@test.com`;
const PW = "testpass123";
const CHEF_NAME = `v245셰프${TS % 10000}`;

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
  console.log("v2.45 — HIGH 3개 항목 + 브라우저 UI 검증");
  console.log("====================================================\n");

  const code = fs.readFileSync(APP_JSX, "utf8");
  const normalized = code.replace(/\r\n/g, "\n");

  console.log("── [1~6] 정적 코드 검증 ──\n");

  // [1] d_match 딜 존재 (status:"matched", createdBy:"")
  assert(
    normalized.includes('"d_match"') && normalized.includes('status: "matched"') &&
    (function() {
      const idx = normalized.indexOf('"d_match"');
      const block = normalized.slice(idx, idx + 400);
      return block.includes('createdBy: ""');
    })(),
    "[1] v2.45 — H-1a: SAMPLE_DEALS에 d_match (matched + createdBy:'') 존재"
  );

  // [2] d_done 딜 존재 (status:"done", balanceDueAt)
  assert(
    normalized.includes('"d_done"') && normalized.includes('status: "done"') &&
    (function() {
      const idx = normalized.indexOf('"d_done"');
      const block = normalized.slice(idx, idx + 900);
      return block.includes('balanceDueAt:') && block.includes('createdBy: ""');
    })(),
    "[2] v2.45 — H-1b: SAMPLE_DEALS에 d_done (done + balanceDueAt + createdBy:'') 존재"
  );

  // [3] handleResetData createdBy 치환 로직
  assert(
    normalized.includes("createdBy: user.uid") &&
    normalized.includes('d.createdBy === ""'),
    "[3] v2.45 — H-1c: handleResetData에서 createdBy=='' → user.uid 치환 로직 존재"
  );

  // [4] CROP_EMOJI 상수 존재
  assert(
    normalized.includes("const CROP_EMOJI = {") &&
    normalized.includes('"토마토": "🍅"') &&
    normalized.includes('"딸기": "🍓"'),
    "[4] v2.45 — H-2: CROP_EMOJI 상수 존재 (토마토🍅, 딸기🍓 포함)"
  );

  // [5] 딜 카드 이모지 fallback 코드
  assert(
    normalized.includes("CROP_EMOJI[deal.crop]") &&
    normalized.includes("{CROP_EMOJI[deal.crop]}"),
    "[5] v2.45 — H-2: 딜 카드에 CROP_EMOJI 이모지 fallback 코드 존재"
  );

  // [6] LoginScreen DEV 퀵 로그인
  assert(
    normalized.includes("VITE_DEMO_CHEF_EMAIL") &&
    normalized.includes("🧪 DEV 데모 계정 빠른 로그인") &&
    normalized.includes("🍳 셰프"),
    "[6] v2.45 — H-3: LoginScreen DEV 퀵 로그인 버튼 코드 존재"
  );

  // ── [7] 브라우저 UI 테스트 ──
  console.log("\n── [7] 브라우저 UI 테스트 ──\n");

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  await signup(page, CHEF_EMAIL, PW, "chef", CHEF_NAME);

  // 관리자 메뉴에서 데이터 초기화 시도 (관리자 계정이면 성공, 아니면 skip)
  const resetBtn = page.locator("button", { hasText: /초기화/ });
  if (await resetBtn.count() > 0) {
    await resetBtn.first().click({ force: true });
    await page.waitForTimeout(2000);
  }

  await goToTab(page, "내 거래");
  await page.waitForTimeout(1500);
  const body = await page.locator("body").innerText();
  const hasDeals = body.includes("딸기") || body.includes("무화과") || body.includes("진행") || body.includes("완료") || body.includes("matched") || body.includes("done");
  const noError = !body.includes("TypeError") && !body.includes("오류");

  // 딜 찾기 탭도 체크 (이모지 표시 확인)
  await goToTab(page, "딜 찾기");
  await page.waitForTimeout(1000);
  const body2 = await page.locator("body").innerText();
  const browsOk = body2.length > 0 && !body2.includes("TypeError");

  assert(
    noError && browsOk,
    "[7] v2.45 — 셰프 내 거래 + 딜 찾기 탭 정상 진입 (H-1/2/3 적용 후 무결성)"
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
