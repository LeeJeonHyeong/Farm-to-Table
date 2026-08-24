/**
 * test_v2_41.cjs
 * v2.41 — MEDIUM 7개 항목 검증
 *
 * [1]  STAB-01: ChatScreen mountedRef 언마운트 안전 패턴 존재
 * [2]  STAB-02: DealDetailView chef-profile fetch 취소 플래그 + dep 수정
 * [3]  PERF-01: onSnapshot chats 핸들러에 chefDealIds 필터 존재
 * [4]  PERF-02: chatUnreads useMemo 사용
 * [5]  PERF-03: FarmProfileDetailCard badges useMemo 사용
 * [6]  PERF-03: FarmProfileScreen farmBadges useMemo 호이스팅 + IIFE 제거
 * [7]  QUAL-01: handleDepositPaid/handleBalancePaid dealsRef.current 사용
 * [8]  UX-01:   RatingPanel submitting 더블클릭 방지
 * [9]  브라우저: 농가 로그인 → 딜 찾기 + 내 제안 탭 정상 진입 (전체 무결성)
 */

const { chromium } = require("playwright");
const fs = require("fs");

const BASE = "http://localhost:5180";
const APP_JSX = "c:/Users/USER/Desktop/D.N.A/farm-to-table-project/farm-to-table-project/src/App.jsx";
const TS = Date.now();

const FARM_EMAIL = `v241farm_${TS}@test.com`;
const PW = "testpass123";
const FARM_NAME = `v241농가${TS % 10000}`;

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
  console.log("v2.41 — MEDIUM 7개 항목 + 브라우저 UI 검증");
  console.log("====================================================\n");

  const code = fs.readFileSync(APP_JSX, "utf8");

  console.log("── [1~8] 정적 코드 검증 ──\n");

  // [1] STAB-01: ChatScreen mountedRef
  assert(
    (function() {
      // ChatScreen 안에 mountedRef가 있어야 함
      const chatIdx = code.indexOf("function ChatScreen(");
      const chatEnd = code.indexOf("\nfunction ", chatIdx + 1);
      const chatCode = code.slice(chatIdx, chatEnd > 0 ? chatEnd : chatIdx + 4000);
      return chatCode.includes("const mountedRef = useRef(true)") &&
             chatCode.includes("mountedRef.current = false") &&
             chatCode.includes("if (mountedRef.current)");
    })(),
    "[1] v2.41 — STAB-01: ChatScreen mountedRef 언마운트 안전 패턴 존재"
  );

  // [2] STAB-02: DealDetailView cancelled 플래그 + dep
  assert(
    (function() {
      const normalized = code.replace(/\r\n/g, "\n");
      return normalized.includes("let cancelled = false;\n    storage.get(chefProfileKey(deal.createdBy))") &&
             normalized.includes("if (!cancelled && result?.value) setChefData(") &&
             normalized.includes("return () => { cancelled = true; };") &&
             normalized.includes("[deal.id, deal.createdBy]");
    })(),
    "[2] v2.41 — STAB-02: DealDetailView fetch cancelled 플래그 + dep 수정"
  );

  // [3] PERF-01: onSnapshot chats 셰프 필터
  assert(
    (function() {
      const snapIdx = code.indexOf("onSnapshot(collection(db, \"chats\")");
      const snapCode = code.slice(snapIdx, snapIdx + 600);
      return snapCode.includes("chefDealIds") && snapCode.includes("chefDealIds.has(dealId)");
    })(),
    "[3] v2.41 — PERF-01: onSnapshot chats 핸들러에 chefDealIds 필터 존재"
  );

  // [4] PERF-02: chatUnreads useMemo
  assert(
    code.includes("const chatUnreads = useMemo(") &&
    (code.includes("[chats, lastChatRead, user.name]") || code.includes("[chats, lastChatRead, user]")),
    "[4] v2.41 — PERF-02: chatUnreads useMemo + 의존성 배열 존재"
  );

  // [5] PERF-03: FarmProfileDetailCard badges useMemo
  assert(
    (function() {
      const detailIdx = code.indexOf("function FarmProfileDetailCard(");
      const detailEnd = code.indexOf("\nfunction ", detailIdx + 1);
      const detailCode = code.slice(detailIdx, detailEnd > 0 ? detailEnd : detailIdx + 3000);
      return detailCode.includes("useMemo(() => computeFarmBadges(") &&
             detailCode.includes("[allDeals, proposal.farmerName, proposal.cert]");
    })(),
    "[5] v2.41 — PERF-03: FarmProfileDetailCard badges useMemo 존재"
  );

  // [6] PERF-03: FarmProfileScreen farmBadges useMemo + IIFE 제거
  assert(
    (function() {
      const farmIdx = code.indexOf("function FarmProfileScreen(");
      const farmEnd = code.indexOf("\nfunction ", farmIdx + 1);
      const farmCode = code.slice(farmIdx, farmEnd > 0 ? farmEnd : farmIdx + 8000);
      return farmCode.includes("const farmBadges = useMemo(() => computeFarmBadges(") &&
             farmCode.includes("[deals, userName, data.cert]") &&
             !farmCode.includes("const badges = computeFarmBadges(deals,");
    })(),
    "[6] v2.41 — PERF-03: FarmProfileScreen farmBadges useMemo 호이스팅 + IIFE 제거"
  );

  // [7] QUAL-01: handleDepositPaid/handleBalancePaid dealsRef
  assert(
    (function() {
      const normalized = code.replace(/\r\n/g, "\n");
      const depIdx = normalized.indexOf("const handleDepositPaid = ");
      const balIdx = normalized.indexOf("const handleBalancePaid = ");
      const depCode = normalized.slice(depIdx, depIdx + 300);
      const balCode = normalized.slice(balIdx, balIdx + 300);
      return depCode.includes("dealsRef.current.find(") &&
             balCode.includes("dealsRef.current.find(");
    })(),
    "[7] v2.41 — QUAL-01: handleDepositPaid/handleBalancePaid dealsRef.current 사용"
  );

  // [8] UX-01: RatingPanel submitting 가드
  assert(
    (function() {
      const ratingIdx = code.indexOf("function RatingPanel(");
      const ratingEnd = code.indexOf("\nfunction ", ratingIdx + 1);
      const ratingCode = code.slice(ratingIdx, ratingEnd > 0 ? ratingEnd : ratingIdx + 2000);
      return ratingCode.includes("const [submitting, setSubmitting] = useState(false)") &&
             ratingCode.includes("if (submitting || rating === 0) return;") &&
             ratingCode.includes("setSubmitting(true)") &&
             ratingCode.includes("disabled={submitting}");
    })(),
    "[8] v2.41 — UX-01: RatingPanel submitting 더블클릭 방지 존재"
  );

  // ── [9] 브라우저 UI 테스트 ──
  console.log("\n── [9] 브라우저 UI 테스트 ──\n");

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
    "[9] v2.41 — 농가 딜 찾기 + 내 제안 탭 정상 진입 (MEDIUM 7개 적용 후 앱 무결성)"
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
