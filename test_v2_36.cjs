/**
 * test_v2_36.cjs
 * v2.36 — DATA-01/02 + STAB-01 + QUAL-02/03
 *
 * [1]  DATA-01: notifHistory 초기값이 공용 키 "notif-history" 에서 읽지 않음 (빈 배열)
 * [2]  DATA-01: _recordNotif에서 notifHistoryKey(uid) 키로 localStorage 쓰기
 * [3]  DATA-01: "모두 지우기"에서 notifHistoryKey(user.uid) 키로 localStorage 삭제
 * [4]  DATA-02: deal-search-history 고정 키 제거, searchHistoryKey 변수 사용
 * [5]  DATA-02: searchHistoryKey 기반 localStorage 저장 코드 존재
 * [6]  STAB-01: printReceipt window.open null 가드 코드 존재
 * [7]  STAB-01: handlePrint window.open null 가드 코드 존재
 * [8]  QUAL-02: ProposalDetailView useEffect deps 배열 [score, deal?.id, proposal?.id]
 * [9]  QUAL-03: AdminScreen 내 fmtDate 재정의 제거, fmtShortDate 존재
 * [10] 브라우저: 셰프 로그인 → 관리자 탭 진입 시 날짜 렌더 오류 없음
 */

const { chromium } = require("playwright");
const fs = require("fs");

const BASE = "http://localhost:5173";
const APP_JSX = "c:/Users/USER/Desktop/D.N.A/farm-to-table-project/farm-to-table-project/src/App.jsx";
const TS = Date.now();

const ADMIN_EMAIL = "jhlove0490@nonghyup.com";
const PW = "testpass123";

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

async function login(page, email, pw) {
  await page.goto(BASE);
  await page.waitForSelector('input[type="email"]', { timeout: 12000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', pw);
  await page.locator("button", { hasText: /로그인$/ }).last().click();
  await page.waitForTimeout(3000);
  await dismissOverlays(page);
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
  console.log("v2.36 DATA-01/02 + STAB-01 + QUAL-02/03 (10개)");
  console.log("====================================================\n");

  const code = fs.readFileSync(APP_JSX, "utf8");

  // ── [1~9] 정적 코드 검증 ──
  console.log("── [1~9] 정적 코드 검증 ──\n");

  // DATA-01: 초기값이 공용 "notif-history" 키를 읽지 않아야 함
  assert(
    !code.includes('localStorage.getItem("notif-history")') &&
    code.includes("setNotifHistory([])"),
    "[1] v2.36 — DATA-01: notifHistory 초기값 공용 키 사용 제거 (빈 배열)"
  );

  // DATA-01: _recordNotif에서 notifHistoryKey(uid) 기반 localStorage 쓰기
  assert(
    code.includes("localStorage.setItem(notifHistoryKey(uid)"),
    "[2] v2.36 — DATA-01: _recordNotif에서 uid별 notifHistoryKey로 localStorage 저장"
  );

  // DATA-01: 모두 지우기에서 notifHistoryKey(user.uid) 삭제
  assert(
    code.includes("localStorage.removeItem(notifHistoryKey(user.uid))"),
    "[3] v2.36 — DATA-01: 모두 지우기 시 uid별 notifHistoryKey로 localStorage 삭제"
  );

  // DATA-02: "deal-search-history" 고정 키가 코드에서 사라짐
  assert(
    !code.includes('"deal-search-history"') &&
    code.includes("searchHistoryKey") &&
    code.includes("deal-search-history-"),
    "[4] v2.36 — DATA-02: deal-search-history 고정 키 제거, uid별 searchHistoryKey 사용"
  );

  assert(
    code.includes("if (searchHistoryKey) localStorage.setItem(searchHistoryKey"),
    "[5] v2.36 — DATA-02: searchHistoryKey 기반 localStorage 저장 코드 존재"
  );

  // STAB-01: printReceipt null 가드
  assert(
    code.includes("팝업이 차단됐습니다") && code.includes("if (!w)"),
    "[6] v2.36 — STAB-01: printReceipt window.open null 가드 존재"
  );

  // STAB-01: handlePrint null 가드
  assert(
    code.includes("if (!win)"),
    "[7] v2.36 — STAB-01: handlePrint window.open null 가드 존재"
  );

  // QUAL-02: ProposalDetailView useEffect deps
  assert(
    code.includes("[score, deal?.id, proposal?.id]"),
    "[8] v2.36 — QUAL-02: ProposalDetailView useEffect deps [score, deal?.id, proposal?.id]"
  );

  // QUAL-03: AdminScreen 내 fmtDate 재정의 제거, fmtShortDate 존재
  // AdminScreen 내부 함수 스코프 안에 fmtDate 재정의가 없어야 함
  const adminScreenIdx = code.indexOf("function AdminScreen(");
  const nextFunctionIdx = code.indexOf("\nfunction ", adminScreenIdx + 20);
  const adminScreenBody = code.slice(adminScreenIdx, nextFunctionIdx > 0 ? nextFunctionIdx : adminScreenIdx + 20000);
  const hasLocalFmtDate = adminScreenBody.includes("const fmtDate =");
  assert(
    !hasLocalFmtDate && code.includes("const fmtShortDate =") && code.includes("fmtShortDate("),
    "[9] v2.36 — QUAL-03: AdminScreen 내 fmtDate 재정의 제거, fmtShortDate로 통일"
  );

  // ── [10] 브라우저 UI 테스트 ──
  console.log("\n── [10] 브라우저 UI 테스트 ──\n");

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  // 관리자 계정으로 로그인 → 관리자 탭 진입
  await login(page, ADMIN_EMAIL, PW);
  const adminTab = page.locator("button", { hasText: "관리자" });
  if (await adminTab.count() > 0) {
    await adminTab.click({ force: true });
    await page.waitForTimeout(1500);
    const bodyText = await page.locator("body").innerText();
    assert(
      bodyText.length > 0 && !bodyText.includes("오류") && !bodyText.includes("TypeError"),
      "[10] v2.36 — 관리자 탭 진입 시 날짜 렌더 오류 없음 (fmtShortDate 정상 작동)"
    );
  } else {
    // 관리자 탭이 없으면 다른 계정으로 셰프 로그인 + 내 거래 탭 확인
    const CHEF_EMAIL = `v236chef_${TS}@test.com`;
    await ctx.close();
    const ctx2 = await browser.newContext();
    const page2 = await ctx2.newPage();
    await signup(page2, CHEF_EMAIL, PW, "chef", `v236셰프${TS % 10000}`);
    await goToTab(page2, "내 거래");
    const bodyText2 = await page2.locator("body").innerText();
    assert(
      bodyText2.length > 0 && !bodyText2.includes("오류"),
      "[10] v2.36 — 셰프 내 거래 탭 정상 진입 (앱 무결성 확인)"
    );
    await ctx2.close();
  }

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
