/**
 * test_v2_39.cjs
 * v2.39 — 5차 감사 13개 항목 검증
 *
 * [1]  SEC-02: 샘플 초기화 버튼이 isAdmin && 조건으로 게이팅됨
 * [2]  SEC-01: pendingTossKey 함수 존재 + 임시 캡처 키 "pending-toss-capture" 사용
 * [3]  SEC-01: user 로드 시 캡처 키 → uid 키 이관 코드 존재
 * [4]  SEC-03: balance-due-notified 키에 cu.uid 포함
 * [5]  SEC-03: cleanBalanceDueKeys가 -${dealId}- 포함 필터로 변경됨
 * [6]  SEC-04: orderId에 -${Date.now()} 타임스탬프 suffix 추가됨
 * [7]  SEC-04: orderId 파싱 시 lastIndexOf("-") 사용 (suffix 대비)
 * [8]  DATA-01: handleSendMessage에서 arrayUnion + merge:true 사용
 * [9]  DATA-02: setChats 낙관적 업데이트가 함수형 업데이터 사용
 * [10] STAB-01: ErrorBoundary 클래스 컴포넌트 존재
 * [11] STAB-02: ProposalForm handleSubmit에 finally { setSubmitting(false) } 존재
 * [12] STAB-03: ImageUpload mountedRef 언마운트 안전 패턴 존재
 * [13] DATA-03+PERF-01: 데이터 로드 effect deps에 user?.uid 포함 + chefDealIds 필터링
 * [14] A11Y-01: ImageUpload div에 role="button" + onKeyDown 존재
 * [15] UX-01: DealCreateScreen handleSubmit에 submitting 방지 존재
 * [16] 브라우저: 농가 로그인 → 딜 찾기 + 내 제안 탭 정상 진입 (전체 무결성)
 */

const { chromium } = require("playwright");
const fs = require("fs");

const BASE = "http://localhost:5174";
const APP_JSX = "c:/Users/USER/Desktop/D.N.A/farm-to-table-project/farm-to-table-project/src/App.jsx";
const TS = Date.now();

const FARM_EMAIL = `v239farm_${TS}@test.com`;
const PW = "testpass123";
const FARM_NAME = `v239농가${TS % 10000}`;

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
  console.log("v2.39 — 5차 감사 13개 항목 + 브라우저 UI 검증");
  console.log("====================================================\n");

  const code = fs.readFileSync(APP_JSX, "utf8");

  console.log("── [1~15] 정적 코드 검증 ──\n");

  // [1] SEC-02: isAdmin 게이팅
  assert(
    code.includes("!isMobile && isAdmin && (") &&
    code.includes("샘플 초기화"),
    "[1] v2.39 — SEC-02: 샘플 초기화 버튼 isAdmin 게이팅 존재"
  );

  // [2] SEC-01: pendingTossKey + pending-toss-capture
  assert(
    code.includes("const pendingTossKey = (uid)") &&
    code.includes("pending-toss-capture"),
    "[2] v2.39 — SEC-01: pendingTossKey 함수 + pending-toss-capture 임시 키 존재"
  );

  // [3] SEC-01: 캡처 키 → uid 키 이관
  assert(
    code.includes('localStorage.getItem("pending-toss-capture")') &&
    code.includes("localStorage.setItem(pendingTossKey(user.uid)") &&
    code.includes('localStorage.removeItem("pending-toss-capture")'),
    "[3] v2.39 — SEC-01: 캡처 키 → uid 키 이관 코드 존재"
  );

  // [4] SEC-03: balance-due-notified cu.uid 포함
  assert(
    code.includes("balance-due-notified-${cu.uid}-${deal.id}-${todayKey}"),
    "[4] v2.39 — SEC-03: balance-due-notified 키에 cu.uid 포함"
  );

  // [5] SEC-03: cleanBalanceDueKeys 업데이트된 필터
  assert(
    code.includes('k.startsWith("balance-due-notified-") && k.includes(`-${dealId}-`)'),
    "[5] v2.39 — SEC-03: cleanBalanceDueKeys dealId 포함 필터로 업데이트"
  );

  // [6] SEC-04: orderId 타임스탬프 suffix
  assert(
    code.includes("`${type === \"deposit\" ? \"dep\" : \"bal\"}-${deal.id}-${Date.now()}`"),
    "[6] v2.39 — SEC-04: orderId에 Date.now() suffix 추가"
  );

  // [7] SEC-04: orderId 파싱 lastIndexOf
  assert(
    code.includes("orderId.lastIndexOf(\"-\")"),
    "[7] v2.39 — SEC-04: orderId 파싱에 lastIndexOf 사용 (suffix 대비)"
  );

  // [8] DATA-01: arrayUnion + merge:true
  assert(
    code.includes("arrayUnion(newMsg)") &&
    code.includes("{ merge: true }"),
    "[8] v2.39 — DATA-01: handleSendMessage arrayUnion + merge:true 사용"
  );

  // [9] DATA-02: 함수형 업데이터
  assert(
    code.includes("[...(c[dealId] || []), newMsg]"),
    "[9] v2.39 — DATA-02: setChats 낙관적 업데이트 함수형 업데이터 사용"
  );

  // [10] STAB-01: ErrorBoundary
  assert(
    code.includes("class ErrorBoundary extends Component") &&
    code.includes("getDerivedStateFromError") &&
    code.includes("componentDidCatch"),
    "[10] v2.39 — STAB-01: ErrorBoundary 클래스 컴포넌트 존재"
  );

  // [11] STAB-02: finally setSubmitting(false)
  assert(
    code.includes("} finally {") &&
    code.includes("setSubmitting(false)"),
    "[11] v2.39 — STAB-02: ProposalForm finally { setSubmitting(false) } 존재"
  );

  // [12] STAB-03: mountedRef 패턴
  assert(
    code.includes("const mountedRef = useRef(true)") &&
    code.includes("mountedRef.current = false") &&
    code.includes("if (mountedRef.current)"),
    "[12] v2.39 — STAB-03: ImageUpload mountedRef 언마운트 안전 패턴 존재"
  );

  // [13] DATA-03 + PERF-01: user?.uid dep + chefDealIds 필터
  assert(
    code.includes("[authChecked, user?.uid]") &&
    code.includes("chefDealIds") &&
    code.includes("chefDealIds.has(dealId)"),
    "[13] v2.39 — DATA-03+PERF-01: 데이터 로드 effect user?.uid dep + chefDealIds 필터 존재"
  );

  // [14] A11Y-01: role=button + onKeyDown
  assert(
    code.includes('role="button"') &&
    code.includes("onKeyDown") &&
    code.includes("fileRef.current.click()"),
    "[14] v2.39 — A11Y-01: ImageUpload role=button + 키보드 접근성 존재"
  );

  // [15] UX-01: DealCreateScreen submitting 방지 (validateStep과 공존하는 패턴으로 식별)
  assert(
    (function() {
      // CRLF/LF 모두 대응: if (submitting) return; 다음 줄에 validateStep 호출 확인
      const normalized = code.replace(/\r\n/g, "\n");
      return normalized.includes("if (submitting) return;\n    if (!validateStep(1)") &&
             normalized.includes("const [submitting, setSubmitting] = useState(false)");
    })(),
    "[15] v2.39 — UX-01: DealCreateScreen submitting 더블클릭 방지 존재"
  );

  // ── [16] 브라우저 UI 테스트 ──
  console.log("\n── [16] 브라우저 UI 테스트 ──\n");

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
    "[16] v2.39 — 농가 딜 찾기 + 내 제안 탭 정상 진입 (5차 감사 후 앱 무결성)"
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
