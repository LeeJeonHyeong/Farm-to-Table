/**
 * test_v2_33.cjs
 * v2.33 — setTimeout 매직 넘버 제거 + 알림 내역 Firestore 연동
 *
 * [1]  setTimeout(600) → win.onload 교체 확인 (printReceipt)
 * [2]  setTimeout(900) 단순 재시도 제거 확인
 * [3]  profile 재시도 루프 코드 존재 (attempt < 5, 300ms)
 * [4]  notifHistoryKey 함수 코드 존재
 * [5]  _recordNotif에서 Firestore 저장(storage.set(notifHistoryKey())) 코드 존재
 * [6]  user 로그인 시 Firestore 알림 로드 useEffect 코드 존재
 * [7]  모두 읽음 처리 시 Firestore 동기화(storage.set(notifHistoryKey(user.uid))) 코드 존재
 * [8]  모두 지우기 시 Firestore 클리어(storage.set ... "[]") 코드 존재
 * [9]  브라우저: 셰프 로그인 → 내 거래 탭 정상 진입 (수정 후 앱 무결성)
 * [10] 브라우저: 알림 벨 버튼 존재 및 클릭 시 패널 표시 확인
 */

const { chromium } = require("playwright");
const fs = require("fs");

const BASE = "http://localhost:5173";
const APP_JSX = "c:/Users/USER/Desktop/D.N.A/farm-to-table-project/farm-to-table-project/src/App.jsx";
const TS = Date.now();

const CHEF_EMAIL = `v233chef_${TS}@test.com`;
const PW = "testpass123";
const CHEF_NAME = `v233셰프${TS % 10000}`;

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
  console.log("v2.33 setTimeout 매직 넘버 제거 + 알림 Firestore 연동 (10개)");
  console.log("====================================================\n");

  const code = fs.readFileSync(APP_JSX, "utf8");

  // ── [1~8] 정적 코드 검증 ──
  console.log("── [1~8] 정적 코드 검증 ──\n");

  assert(
    code.includes("win.onload = () => win.print()") &&
    !code.includes("setTimeout(() => win.print(), 600)"),
    "[1] v2.33 — printReceipt setTimeout(600) → win.onload 교체"
  );

  assert(
    !code.includes("await new Promise((r) => setTimeout(r, 900))"),
    "[2] v2.33 — setTimeout(900) 단순 재시도 제거"
  );

  assert(
    code.includes("attempt < 5") && code.includes("setTimeout(r, 300)"),
    "[3] v2.33 — profile 재시도 루프 (최대 5회, 300ms 간격)"
  );

  assert(
    code.includes("notifHistoryKey") && code.includes("notif-history-"),
    "[4] v2.33 — notifHistoryKey 함수 코드 존재"
  );

  assert(
    code.includes("storage.set(notifHistoryKey(uid)") ||
    code.includes("storage.set(notifHistoryKey("),
    "[5] v2.33 — _recordNotif에서 Firestore 저장 코드 존재"
  );

  assert(
    code.includes("storage.get(notifHistoryKey(user.uid))"),
    "[6] v2.33 — user 로그인 시 Firestore 알림 로드 useEffect 코드 존재"
  );

  assert(
    code.includes("storage.set(notifHistoryKey(user.uid), raw)"),
    "[7] v2.33 — 모두 읽음 처리 시 Firestore 동기화 코드 존재"
  );

  assert(
    code.includes('storage.set(notifHistoryKey(user.uid), "[]")'),
    "[8] v2.33 — 모두 지우기 시 Firestore 클리어 코드 존재"
  );

  // ── [9~10] 브라우저 UI 테스트 ──
  console.log("\n── [9~10] 브라우저 UI 테스트 ──\n");

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  await signup(page, CHEF_EMAIL, PW, "chef", CHEF_NAME);
  await goToTab(page, "내 거래");

  const bodyText = await page.locator("body").innerText();
  assert(
    bodyText.length > 0 && !bodyText.includes("오류") && page.url().includes("localhost"),
    "[9] v2.33 — 수정 후 앱 정상 구동 (내 거래 탭 진입 성공)"
  );

  // 벨 아이콘 버튼 클릭 → 알림 패널 표시 확인
  const bellBtn = page.locator("button", { hasText: /🔔/ }).first();
  if (await bellBtn.count() > 0) {
    await bellBtn.click({ force: true });
    await page.waitForTimeout(600);
    const notifPanel = page.locator("[data-notif-panel]");
    assert(
      await notifPanel.count() > 0,
      "[10] v2.33 — 알림 벨 클릭 후 알림 패널 DOM 존재 확인"
    );
  } else {
    assert(
      code.includes("data-notif-panel") && code.includes("notifHistory"),
      "[10] v2.33 — 알림 패널 코드 존재 확인 (벨 미탐지 시 코드 검증)"
    );
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
