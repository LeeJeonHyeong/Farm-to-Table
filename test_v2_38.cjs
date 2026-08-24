/**
 * test_v2_38.cjs
 * v2.38 — 4차 감사 13개 항목 검증
 *
 * [1]  SEC-03: lastMyDealsVisitKey / seenSelectionsKey / lastChatReadKey 함수 존재
 * [2]  SEC-03: useState 초기값이 공용 localStorage 키를 읽지 않음
 * [3]  SEC-03: last-chat-read 쓰기가 lastChatReadKey(user.uid)로 uid 격리됨
 * [4]  SEC-04: createdBy가 user.uid || user.name 폴백 없이 user.uid만 사용
 * [5]  SEC-05: 만료 딜 자동 종료 필터에 d.createdBy === userRef.current?.uid 조건 추가
 * [6]  DATA-04: notifiedDealsKey 함수 존재 + getNotifiedDeals/addNotifiedDeal가 uid 파라미터 받음
 * [7]  STAB-03: auth useEffect에 cancelled 플래그 존재 (cancelled = true 취소 패턴)
 * [8]  STAB-04: 채팅 롤백이 prev 전체 대신 실패한 메시지 id만 filter 제거
 * [9]  QUAL-05: rating: null로 초기화 + proposal.rating != null 가드 존재
 * [10] QUAL-06: dealsRef + useEffect(() => { dealsRef.current = deals; }) 패턴 존재
 * [11] PERF-02: cropPriceRef가 useMemo로 감싸짐
 * [12] PERF-03: JSX에서 Fraunces/IBM Plex Sans fonts.googleapis link 제거됨 + index.html에 단일 추가
 * [13] A11Y-02: Toast div에 role="alert" aria-live="assertive" 존재
 * [14] 브라우저: 농가 로그인 → 딜 찾기 + 내 제안 탭 정상 진입 (전체 무결성)
 */

const { chromium } = require("playwright");
const fs = require("fs");

const BASE = "http://localhost:5173";
const APP_JSX = "c:/Users/USER/Desktop/D.N.A/farm-to-table-project/farm-to-table-project/src/App.jsx";
const INDEX_HTML = "c:/Users/USER/Desktop/D.N.A/farm-to-table-project/farm-to-table-project/index.html";
const TS = Date.now();

const FARM_EMAIL = `v238farm_${TS}@test.com`;
const PW = "testpass123";
const FARM_NAME = `v238농가${TS % 10000}`;

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
  if (await btn.count() > 0) { await btn.first().click({ force: true }); await page.waitForTimeout(1500); }
}

async function run() {
  console.log("\n====================================================");
  console.log("v2.38 — 4차 감사 13개 항목 + 브라우저 UI 검증");
  console.log("====================================================\n");

  const code = fs.readFileSync(APP_JSX, "utf8");
  const html = fs.readFileSync(INDEX_HTML, "utf8");

  console.log("── [1~13] 정적 코드 검증 ──\n");

  // [1] SEC-03: uid 스코프 키 함수 존재
  assert(
    code.includes("const lastMyDealsVisitKey = (uid)") &&
    code.includes("const seenSelectionsKey = (uid)") &&
    code.includes("const lastChatReadKey = (uid)"),
    "[1] v2.38 — SEC-03: uid 스코프 키 함수 3개 존재"
  );

  // [2] SEC-03: useState 초기값이 공용 키 읽지 않음
  assert(
    !code.includes('localStorage.getItem("last-mydeals-visit")') &&
    !code.includes('localStorage.getItem("seen-selections")') &&
    !code.includes('localStorage.getItem("last-chat-read")'),
    "[2] v2.38 — SEC-03: useState 초기값에서 공용 localStorage 키 읽기 제거됨"
  );

  // [3] SEC-03: lastChatReadKey(user.uid) 기반 쓰기
  assert(
    code.includes("lastChatReadKey(user.uid)") &&
    code.includes("lastMyDealsVisitKey(user.uid)") &&
    code.includes("seenSelectionsKey(user.uid)"),
    "[3] v2.38 — SEC-03: uid 스코프 키로 localStorage 저장"
  );

  // [4] SEC-04: createdBy 폴백 없음
  assert(
    !code.includes("createdBy: user.uid || user.name") &&
    code.includes("createdBy: user.uid"),
    "[4] v2.38 — SEC-04: createdBy user.uid || user.name 폴백 제거"
  );

  // [5] SEC-05: 만료 딜 소유권 필터
  assert(
    code.includes("d.createdBy === userRef.current?.uid") &&
    code.includes("dealsRef.current.filter"),
    "[5] v2.38 — SEC-05: 만료 딜 자동 종료에 소유권 필터 추가"
  );

  // [6] DATA-04: notifiedDealsKey uid 함수
  assert(
    code.includes("const notifiedDealsKey = (uid)") &&
    code.includes("getNotifiedDeals(cu.uid)") &&
    code.includes("addNotifiedDeal(cu.uid, deal.id)"),
    "[6] v2.38 — DATA-04: notifiedDealsKey uid 함수 + call site uid 전달"
  );

  // [7] STAB-03: cancelled 플래그
  assert(
    code.includes("let cancelled = false;") &&
    code.includes("cancelled = true; unsub()"),
    "[7] v2.38 — STAB-03: auth 재시도 루프 cancelled 플래그 존재"
  );

  // [8] STAB-04: 채팅 롤백 실패 메시지만 filter 제거
  assert(
    code.includes(".filter((m) => m.id !== newMsg.id)") &&
    !code.includes("setChats((c) => ({ ...c, [dealId]: prev }));"),
    "[8] v2.38 — STAB-04: 채팅 rollback이 실패 메시지만 제거"
  );

  // [9] QUAL-05: rating null 초기화 + null 가드
  assert(
    code.includes("rating: null,") &&
    code.includes("proposal.rating != null"),
    "[9] v2.38 — QUAL-05: rating: null 초기화 + null 가드 존재"
  );

  // [10] QUAL-06: dealsRef 패턴
  assert(
    code.includes("const dealsRef = useRef([])") &&
    code.includes("dealsRef.current = deals"),
    "[10] v2.38 — QUAL-06: dealsRef + sync useEffect 패턴 존재"
  );

  // [11] PERF-02: useMemo
  assert(
    code.includes("const cropPriceRef = useMemo("),
    "[11] v2.38 — PERF-02: cropPriceRef useMemo로 감쌈"
  );

  // [12] PERF-03: JSX에서 중복 link 제거 + index.html 단일 추가
  const jsxFontCount = (code.match(/fonts\.googleapis\.com.*Fraunces.*IBM\+Plex\+Sans.*display=swap/g) || []).length;
  assert(
    jsxFontCount === 0 &&
    html.includes("fonts.googleapis.com") &&
    html.includes("Fraunces"),
    "[12] v2.38 — PERF-03: JSX 중복 fonts link 제거, index.html 단일 추가"
  );

  // [13] A11Y-02: Toast role="alert"
  assert(
    code.includes('role="alert"') &&
    code.includes('aria-live="assertive"'),
    "[13] v2.38 — A11Y-02: Toast role=alert + aria-live=assertive 존재"
  );

  // ── [14] 브라우저 UI 테스트 ──
  console.log("\n── [14] 브라우저 UI 테스트 ──\n");

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
    "[14] v2.38 — 농가 딜 찾기 + 내 제안 탭 정상 진입 (4차 감사 후 앱 무결성)"
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
