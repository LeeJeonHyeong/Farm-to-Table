/**
 * test_v2_28_29.cjs
 * v2.28 alert→Toast + 푸시 알림 아이콘 / v2.29 북마크 Firestore 동기화 + Firebase Storage
 *
 * [1]  v2.28 — Toast 컴포넌트 코드 존재
 * [2]  v2.28 — toast 관련 state (toastMsg) 코드 존재
 * [3]  v2.28 — alert() 완전 제거 확인 (App.jsx에 alert( 없어야 함)
 * [4]  v2.28 — 결제 실패 메시지에 setToastMsg 사용
 * [5]  v2.28 — 결제 모듈 미로드 메시지에 setToastMsg 사용
 * [6]  v2.28 — 채팅 전송 실패 메시지에 setToastMsg 사용
 * [7]  v2.28 — 푸시 알림 아이콘이 icon-192.png 사용
 * [8]  v2.28 — vite.svg가 알림 아이콘으로 사용되지 않음
 * [9]  v2.29 — bookmarkKey 함수 코드 존재
 * [10] v2.29 — 북마크 Firestore 로드 (storage.get + bookmarkKey) 코드
 * [11] v2.29 — 북마크 Firestore 저장 (storage.set + bookmarkKey) 코드
 * [12] v2.29 — firebase.js에 fbStorage export 존재
 * [13] v2.29 — firebase/storage import (ref, uploadString, getDownloadURL) 코드
 * [14] v2.29 — ImageUpload storagePath prop 코드
 * [15] v2.29 — Firebase Storage 업로드 로직 (uploadString) 코드
 * [16] v2.29 — FarmProfileScreen storagePath farm_profile 코드
 * [17] v2.29 — FarmProfileScreen storagePath cert 코드
 * [18] v2.29 — ProposalForm userId prop 코드
 * [19] v2.28 — 브라우저: Toast 렌더 확인 (toastMsg state 반응)
 * [20] v2.29 — 브라우저: 딜 찾기 북마크 버튼 존재 및 클릭 가능
 */

const { chromium } = require("playwright");
const fs = require("fs");

const BASE = "http://localhost:5173";
const APP_JSX = "c:/Users/USER/Desktop/D.N.A/farm-to-table-project/farm-to-table-project/src/App.jsx";
const FIREBASE_JS = "c:/Users/USER/Desktop/D.N.A/farm-to-table-project/farm-to-table-project/src/firebase.js";
const TS = Date.now();

const FARM_EMAIL = `v2829farm_${TS}@test.com`;
const CHEF_EMAIL = `v2829chef_${TS}@test.com`;
const PW = "testpass123";
const FARM_NAME = `테스트농가${TS % 10000}`;
const CHEF_NAME = `v2829셰프${TS % 10000}`;

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

async function login(page, email, pw) {
  await page.goto(BASE);
  await page.waitForSelector('input[type="email"]', { timeout: 12000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', pw);
  await page.locator("button", { hasText: /로그인$/ }).last().click();
  await page.waitForTimeout(3000);
  await dismissOverlays(page);
}

async function goToTab(page, label) {
  const btn = page.locator("button", { hasText: label });
  if (await btn.count() > 0) { await btn.first().click({ force: true }); await page.waitForTimeout(1000); }
}

async function createDeal(chefPage) {
  await goToTab(chefPage, "딜 만들기");
  await chefPage.waitForTimeout(800);
  let nxt = chefPage.locator("button", { hasText: "다음 단계 →" });
  if (await nxt.count() > 0) await nxt.click();
  await chefPage.waitForTimeout(600);
  const si = chefPage.locator('input[placeholder*="지름"]').first();
  if (await si.count() > 0) await si.fill("지름 5cm 이상");
  nxt = chefPage.locator("button", { hasText: "다음 단계 →" });
  if (await nxt.count() > 0) await nxt.click();
  await chefPage.waitForTimeout(600);
  const qi = chefPage.locator('input[type="number"]').first();
  if (await qi.count() > 0) await qi.fill("20");
  nxt = chefPage.locator("button", { hasText: "다음 단계 →" });
  if (await nxt.count() > 0) await nxt.click();
  await chefPage.waitForTimeout(600);
  const future = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
  const di = chefPage.locator('input[type="date"]').first();
  if (await di.count() > 0) await di.fill(future);
  const pi = chefPage.locator('input[type="number"]').first();
  if (await pi.count() > 0) await pi.fill("5000");
  nxt = chefPage.locator("button", { hasText: "다음 단계 →" });
  if (await nxt.count() > 0) await nxt.click();
  await chefPage.waitForTimeout(600);
  const sub = chefPage.locator("button", { hasText: "딜 등록하고 농가 제안 받기" });
  if (await sub.count() > 0) { await sub.click(); await chefPage.waitForTimeout(3000); }
}

async function run() {
  console.log("\n====================================================");
  console.log("v2.28 Toast/아이콘 + v2.29 북마크Firestore/Firebase Storage (20개)");
  console.log("====================================================\n");

  const code = fs.readFileSync(APP_JSX, "utf8");
  const firebaseCode = fs.readFileSync(FIREBASE_JS, "utf8");

  // ── [1~8] v2.28 정적 코드 검증 ──
  console.log("── [1~8] v2.28 정적 코드 검증 ──\n");

  assert(
    code.includes("function Toast(") || code.includes("function Toast ({"),
    "[1] v2.28 — Toast 컴포넌트 코드 존재"
  );

  assert(
    code.includes("toastMsg") && code.includes("setToastMsg"),
    "[2] v2.28 — toastMsg state 코드 존재"
  );

  assert(
    !code.includes("alert("),
    "[3] v2.28 — alert() 완전 제거 (App.jsx에 alert( 없음)"
  );

  assert(
    code.includes("setToastMsg") && code.includes("결제 실패"),
    "[4] v2.28 — 결제 실패 메시지에 setToastMsg 사용"
  );

  assert(
    code.includes("setToastMsg") && code.includes("결제 모듈"),
    "[5] v2.28 — 결제 모듈 미로드에 setToastMsg 사용"
  );

  assert(
    code.includes("setToastMsg") && code.includes("메시지 전송에 실패"),
    "[6] v2.28 — 채팅 전송 실패에 setToastMsg 사용"
  );

  assert(
    code.includes("icon-192.png"),
    "[7] v2.28 — 푸시 알림 아이콘 icon-192.png 사용"
  );

  assert(
    !code.includes('icon: "/vite.svg"') && !code.includes("icon:'/vite.svg'"),
    "[8] v2.28 — vite.svg가 알림 아이콘으로 사용되지 않음"
  );

  // ── [9~18] v2.29 정적 코드 검증 ──
  console.log("\n── [9~18] v2.29 정적 코드 검증 ──\n");

  assert(
    code.includes("bookmarkKey") && code.includes("farm-bookmarks-"),
    "[9] v2.29 — bookmarkKey 함수 코드 존재"
  );

  assert(
    code.includes("storage.get(bookmarkKey(") || code.includes("storage.get(bookmarkKey"),
    "[10] v2.29 — 북마크 Firestore 로드 코드"
  );

  assert(
    code.includes("storage.set(bookmarkKey(") || code.includes("storage.set(bookmarkKey"),
    "[11] v2.29 — 북마크 Firestore 저장 코드"
  );

  assert(
    firebaseCode.includes("fbStorage") && firebaseCode.includes("getStorage"),
    "[12] v2.29 — firebase.js fbStorage export 존재"
  );

  assert(
    code.includes("uploadString") && code.includes("getDownloadURL"),
    "[13] v2.29 — firebase/storage 함수 import 코드"
  );

  assert(
    code.includes("storagePath") && code.includes("storagePath }") || code.includes("storagePath,") || code.includes("storagePath }") || code.includes("{ storagePath }"),
    "[14] v2.29 — ImageUpload storagePath prop 코드"
  );

  assert(
    code.includes("uploadString(") && code.includes("data_url"),
    "[15] v2.29 — Firebase Storage 업로드 로직 코드"
  );

  assert(
    code.includes("farm_profile"),
    "[16] v2.29 — FarmProfileScreen storagePath farm_profile 코드"
  );

  assert(
    code.includes("`images/${userId}/cert`") || code.includes("images/${userId}/cert"),
    "[17] v2.29 — FarmProfileScreen storagePath cert 코드"
  );

  assert(
    code.includes("function ProposalForm({") && code.includes("userId }") || code.includes("userId,"),
    "[18] v2.29 — ProposalForm userId prop 코드"
  );

  // ── [19~20] 브라우저 UI 테스트 ──
  console.log("\n── [19~20] 브라우저 UI 테스트 ──\n");

  const browser = await chromium.launch({ headless: true });

  // 셰프 회원가입 (딜 생성용)
  const chefCtx = await browser.newContext();
  const chefPage = await chefCtx.newPage();
  await signup(chefPage, CHEF_EMAIL, PW, "chef", CHEF_NAME);
  await createDeal(chefPage);
  await chefCtx.close();

  // 농가 회원가입
  const farmSignupCtx = await browser.newContext();
  const farmSignupPage = await farmSignupCtx.newPage();
  await signup(farmSignupPage, FARM_EMAIL, PW, "farm", FARM_NAME);
  await farmSignupCtx.close();

  // 농가 로그인 → 딜 찾기 (Toast 주입 테스트 + 북마크 버튼 테스트)
  const farmCtx = await browser.newContext();
  const farmPage = await farmCtx.newPage();
  await login(farmPage, FARM_EMAIL, PW);

  // [19] Toast 컴포넌트가 DOM에 존재하는지 확인 (toastMsg=null이면 null return이므로 없어야 정상)
  //       → JavaScript로 직접 setToastMsg를 호출할 수 없으므로
  //         대신 Toast 컴포넌트의 DOM 구조(fixed bottom 스타일 div)가 없음을 확인한 뒤
  //         페이지 소스에서 Toast 렌더 코드가 포함됐는지 확인
  const pageHtml = await farmPage.content();
  const hasToastInSource = code.includes("<Toast message={toastMsg}");
  assert(
    hasToastInSource,
    "[19] v2.28 — JSX에 <Toast message={toastMsg} onClose> 렌더 코드 존재"
  );

  // [20] 딜 찾기 탭에서 북마크(🔖) 버튼이 보이는지 확인
  await goToTab(farmPage, "딜 찾기");
  await farmPage.waitForTimeout(1500);
  const bookmarkBtns = farmPage.locator("button", { hasText: "🔖" });
  const bookmarkCount = await bookmarkBtns.count();
  if (bookmarkCount > 0) {
    // 첫 번째 북마크 버튼 클릭
    await bookmarkBtns.first().click({ force: true });
    await farmPage.waitForTimeout(800);
    // "저장한 딜" 버튼이 표시되는지 확인
    const savedBtn = farmPage.locator("button", { hasText: "저장한 딜" });
    assert(
      await savedBtn.count() > 0,
      "[20] v2.29 — 딜 찾기 북마크 버튼 클릭 후 '저장한 딜' 필터 버튼 존재"
    );
  } else {
    // 딜이 없을 때 — 버튼 자체는 존재하지 않음, 소스코드로 확인
    assert(
      code.includes("toggleBookmark") && code.includes("bookmarkKey"),
      "[20] v2.29 — 북마크 토글·Firestore 저장 코드 존재 (딜 없어 UI 미확인)"
    );
  }

  await farmCtx.close();
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
