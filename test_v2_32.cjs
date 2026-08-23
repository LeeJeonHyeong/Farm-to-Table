/**
 * test_v2_32.cjs
 * v2.32 — 알림 dedup 키 누적 방지 + 결제 pending Firestore 병행 저장
 *
 * [1]  NOTIFIED_DEALS_KEY 상수("notified-deals-v1") 코드 존재
 * [2]  getNotifiedDeals() 함수 코드 존재 (localStorage 파싱)
 * [3]  addNotifiedDeal() 함수 코드 존재 (300개 cap)
 * [4]  addNotifiedDeal cap=300 코드 존재 (배열 300 초과 시 잘라냄)
 * [5]  개별 notified-deal-{id} 키 직접 setItem 패턴 제거 확인
 * [6]  새 딜 알림 분기에서 getNotifiedDeals().has() + addNotifiedDeal() 사용
 * [7]  user 로드 시 localStorage → Firestore 백업 useEffect 코드 존재
 * [8]  pending-toss-${user.uid} Firestore 키 코드 존재
 * [9]  load effect에서 Firestore 폴백 조회(storage.get(firestoreKey)) 코드 존재
 * [10] load effect에서 Firestore 백업 클리어(storage.set(firestoreKey, "")) 코드 존재
 * [11] 브라우저: 셰프 로그인 → 내 거래 탭 정상 진입 (수정 후 앱 무결성)
 */

const { chromium } = require("playwright");
const fs = require("fs");

const BASE = "http://localhost:5173";
const APP_JSX = "c:/Users/USER/Desktop/D.N.A/farm-to-table-project/farm-to-table-project/src/App.jsx";
const TS = Date.now();

const CHEF_EMAIL = `v232chef_${TS}@test.com`;
const PW = "testpass123";
const CHEF_NAME = `v232셰프${TS % 10000}`;

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
  console.log("v2.32 알림 dedup 개선 + 결제 pending Firestore 병행 저장 (11개)");
  console.log("====================================================\n");

  const code = fs.readFileSync(APP_JSX, "utf8");

  // ── [1~10] 정적 코드 검증 ──
  console.log("── [1~10] 정적 코드 검증 ──\n");

  assert(
    code.includes("NOTIFIED_DEALS_KEY") && code.includes("notified-deals-v1"),
    "[1] v2.32 — NOTIFIED_DEALS_KEY 상수 코드 존재"
  );

  assert(
    code.includes("getNotifiedDeals") && code.includes("new Set(JSON.parse"),
    "[2] v2.32 — getNotifiedDeals() 함수 코드 존재"
  );

  assert(
    code.includes("addNotifiedDeal") && code.includes("s.add(id)"),
    "[3] v2.32 — addNotifiedDeal() 함수 코드 존재"
  );

  assert(
    code.includes("arr.length > 300") && code.includes("arr.length - 300"),
    "[4] v2.32 — addNotifiedDeal 300개 cap 코드 존재"
  );

  // 개별 notified-deal-{id} 키 직접 setItem 패턴이 제거됐는지 확인
  assert(
    !code.includes('localStorage.setItem(`notified-deal-') &&
    !code.includes("localStorage.setItem(`notified-deal-"),
    "[5] v2.32 — 개별 notified-deal-{id} localStorage.setItem 패턴 제거"
  );

  assert(
    code.includes("getNotifiedDeals()") && code.includes(".has(deal.id)") &&
    code.includes("addNotifiedDeal(deal.id)"),
    "[6] v2.32 — 새 딜 알림에서 getNotifiedDeals().has() + addNotifiedDeal() 사용"
  );

  assert(
    code.includes("pending-toss-payment") &&
    code.includes("storage.set(`pending-toss-${user.uid}`"),
    "[7] v2.32 — user 로드 시 localStorage → Firestore 백업 useEffect 코드 존재"
  );

  assert(
    code.includes("`pending-toss-${user.uid}`"),
    "[8] v2.32 — pending-toss-${user.uid} Firestore 키 코드 존재"
  );

  assert(
    code.includes("storage.get(firestoreKey)"),
    "[9] v2.32 — load effect Firestore 폴백 조회 코드 존재"
  );

  assert(
    code.includes('storage.set(firestoreKey, "")'),
    "[10] v2.32 — load effect Firestore 백업 클리어 코드 존재"
  );

  // ── [11] 브라우저 UI 테스트 ──
  console.log("\n── [11] 브라우저 UI 테스트 ──\n");

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  await signup(page, CHEF_EMAIL, PW, "chef", CHEF_NAME);
  await goToTab(page, "내 거래");

  const bodyText = await page.locator("body").innerText();
  assert(
    bodyText.length > 0 && !bodyText.includes("오류") && page.url().includes("localhost"),
    "[11] v2.32 — 수정 후 앱 정상 구동 (내 거래 탭 진입 성공)"
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
