/**
 * test_v2_40.cjs
 * v2.40 — HIGH 4개 항목 검증
 *
 * [1]  DATA-01: persistDeal setDoc에 { merge: true } 추가됨
 * [2]  DATA-02: handleSubmitProposal이 updateDoc + arrayUnion 사용
 * [3]  DATA-02: updateDoc import 추가됨
 * [4]  SEC-01:  handleResetData 함수 레벨 isAdmin 가드 존재
 * [5]  SEC-02:  isAdmin 코멘트에 함수 레벨 재확인 언급 존재
 * [6]  브라우저: 농가 로그인 → 딜 찾기 + 내 제안 탭 정상 진입 (전체 무결성)
 */

const { chromium } = require("playwright");
const fs = require("fs");

const BASE = "http://localhost:5174";
const APP_JSX = "c:/Users/USER/Desktop/D.N.A/farm-to-table-project/farm-to-table-project/src/App.jsx";
const TS = Date.now();

const FARM_EMAIL = `v240farm_${TS}@test.com`;
const PW = "testpass123";
const FARM_NAME = `v240농가${TS % 10000}`;

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
  console.log("v2.40 — HIGH 4개 항목 + 브라우저 UI 검증");
  console.log("====================================================\n");

  const code = fs.readFileSync(APP_JSX, "utf8");

  console.log("── [1~5] 정적 코드 검증 ──\n");

  // [1] DATA-01: persistDeal merge:true
  assert(
    code.includes("await setDoc(doc(db, \"deals\", deal.id), deal, { merge: true })"),
    "[1] v2.40 — DATA-01: persistDeal setDoc에 { merge: true } 추가됨"
  );

  // [2] DATA-02: handleSubmitProposal → updateDoc + arrayUnion
  assert(
    code.includes("updateDoc(doc(db, \"deals\", dealId), { proposals: arrayUnion(proposal) })"),
    "[2] v2.40 — DATA-02: handleSubmitProposal updateDoc + arrayUnion 사용"
  );

  // [3] DATA-02: updateDoc import
  assert(
    code.includes("import { doc, onSnapshot, collection, getDocs, setDoc, updateDoc, deleteDoc, writeBatch, arrayUnion }"),
    "[3] v2.40 — DATA-02: updateDoc import 추가됨"
  );

  // [4] SEC-01: handleResetData 함수 레벨 isAdmin 가드
  assert(
    code.includes("if (user?.email !== ADMIN_EMAIL) return;") &&
    code.includes("SAMPLE_DEALS.forEach((d) => batch.set("),
    "[4] v2.40 — SEC-01: handleResetData 함수 레벨 isAdmin 가드 존재"
  );

  // [5] SEC-02: isAdmin 코멘트에 함수 레벨 재확인 언급
  assert(
    code.includes("파괴적 admin 핸들러는 함수 레벨에서도 user?.email !== ADMIN_EMAIL 재확인"),
    "[5] v2.40 — SEC-02: isAdmin 코멘트에 함수 레벨 재확인 정책 명시"
  );

  // ── [6] 브라우저 UI 테스트 ──
  console.log("\n── [6] 브라우저 UI 테스트 ──\n");

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
    "[6] v2.40 — 농가 딜 찾기 + 내 제안 탭 정상 진입 (HIGH 4개 적용 후 앱 무결성)"
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
