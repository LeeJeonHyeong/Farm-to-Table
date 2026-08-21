/**
 * test_v2_ux2346.cjs
 * UX #2 상호 리뷰 / #3 제안 단계 채팅 / #4 카운터오퍼 / #6 제철 추천 E2E 테스트
 *
 * [1]  UX#2 — handleRateChef 핸들러 코드 존재
 * [2]  UX#2 — chefRating/chefRatedAt 저장 코드 존재
 * [3]  UX#2 — "농가가 남긴 평가" UI 코드 존재
 * [4]  UX#2 — onRespondCounterOffer prop 전달 체인 존재
 * [5]  UX#3 — chatId = dealId__proposalId 코드 존재
 * [6]  UX#3 — handleOpenChat proposalId 포함 코드 존재
 * [7]  UX#4 — CounterOfferModal 컴포넌트 존재
 * [8]  UX#4 — handleSendCounterOffer 핸들러 존재
 * [9]  UX#4 — handleRespondCounterOffer 핸들러 존재
 * [10] UX#4 — 역제안 도착/수락/거절 알림 코드 존재
 * [11] UX#6 — SEASONAL_CROPS 상수 존재
 * [12] UX#6 — SeasonalBanner 컴포넌트 존재
 * [13] UX#6 — 딜 찾기에 제철 배너 삽입 코드 존재
 * [14] UX#6 — 딜 만들기 1단계 제철 힌트 코드 존재
 * [15] UX#6 — 농가 로그인 후 딜 찾기 제철 배너 UI 표시
 * [16] UX#6 — 제철 칩 클릭 → 품목 필터 적용 (활성 스타일 변경)
 * [17] UX#6 — 쉐프 로그인 후 딜 만들기 1단계 제철 힌트 UI 표시
 * [18] UX#3 — 쉐프 내 거래 오픈 딜 제안 카드에 채팅 버튼 존재
 * [19] UX#4 — 쉐프 내 거래 오픈 딜 제안 카드에 역제안 버튼 존재
 * [20] UX#4 — 역제안 버튼 클릭 시 CounterOfferModal 표시
 * [21] UX#2 — 농가 제안 상세 뷰에 역제안 배너 수신 UI 코드 존재
 */

const { chromium } = require("playwright");
const fs = require("fs");

const BASE = "http://localhost:5173";
const APP_JSX = "c:/Users/USER/Desktop/D.N.A/farm-to-table-project/farm-to-table-project/src/App.jsx";
const TS = Date.now();

const CHEF_EMAIL = `ux2346chef_${TS}@test.com`;
const FARM_EMAIL = `ux2346farm_${TS}@test.com`;
const PW = "testpass123";
const CHEF_NAME = `UX2346셰프${TS % 10000}`;
const FARM_NAME = `UX2346농가${TS % 10000}`;

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
  if (await btn.count() > 0) { await btn.first().click(); await page.waitForTimeout(700); }
}

async function createDeal(page, crop = "토마토") {
  const tab = page.locator("button", { hasText: "딜 만들기" });
  if (await tab.count() > 0) await tab.click();
  await page.waitForTimeout(1000);
  const ni = page.locator('input[placeholder="예: 테이블나인"]').first();
  if (await ni.count() > 0 && !(await ni.inputValue())) await ni.fill(CHEF_NAME);
  // select crop if not tomato
  if (crop !== "토마토") {
    const sel = page.locator("select").first();
    if (await sel.count() > 0) await sel.selectOption(crop);
  }
  let nxt = page.locator("button", { hasText: "다음 단계 →" });
  if (await nxt.count() > 0) await nxt.click();
  await page.waitForTimeout(700);
  const si = page.locator('input[placeholder*="지름"]').first();
  if (await si.count() > 0) await si.fill("지름 5cm 이상");
  nxt = page.locator("button", { hasText: "다음 단계 →" });
  if (await nxt.count() > 0) await nxt.click();
  await page.waitForTimeout(700);
  const qi = page.locator('input[type="number"]').first();
  if (await qi.count() > 0) await qi.fill("20");
  nxt = page.locator("button", { hasText: "다음 단계 →" });
  if (await nxt.count() > 0) await nxt.click();
  await page.waitForTimeout(700);
  const future = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
  const di = page.locator('input[type="date"]').first();
  if (await di.count() > 0) await di.fill(future);
  const pi = page.locator('input[type="number"]').first();
  if (await pi.count() > 0) await pi.fill("5000");
  nxt = page.locator("button", { hasText: "다음 단계 →" });
  if (await nxt.count() > 0) await nxt.click();
  await page.waitForTimeout(700);
  const sub = page.locator("button", { hasText: "딜 등록하고 농가 제안 받기" });
  if (await sub.count() > 0) { await sub.click(); await page.waitForTimeout(3000); }
}

async function submitProposal(page, crop = "토마토") {
  await goToTab(page, "딜 찾기");
  await page.waitForTimeout(2000);
  // Use .ftt-card class to click the deal card directly (avoids seasonal banner chip with same crop text)
  const card = page.locator(".ftt-card").first();
  if (await card.count() > 0) { await card.click(); await page.waitForTimeout(1000); }
  const propBtn = page.locator("button", { hasText: /이 딜에 제안 보내기/ }).first();
  if (await propBtn.count() > 0) { await propBtn.click(); await page.waitForTimeout(800); }
  // Fill all required proposal fields
  const regionInput = page.locator('input[placeholder="예: 경기 이천"]').first();
  if (await regionInput.count() > 0) await regionInput.fill("경기 이천");
  const priceInput = page.locator('input[type="number"]').first();
  if (await priceInput.count() > 0) await priceInput.fill("4800");
  const qtyInput = page.locator('input[type="number"]').nth(1);
  if (await qtyInput.count() > 0) await qtyInput.fill("20");
  const dateInput = page.locator('input[type="date"]').first();
  if (await dateInput.count() > 0) {
    const future = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10);
    await dateInput.fill(future);
  }
  const submitBtn = page.locator("button", { hasText: /제안 보내기/ }).last();
  if (await submitBtn.count() > 0) { await submitBtn.click(); await page.waitForTimeout(3000); }
}

async function run() {
  console.log("\n====================================================");
  console.log("UX #2·#3·#4·#6 통합 테스트 (21개)");
  console.log("====================================================\n");

  // ── 정적 코드 검증 [1~14] ──────────────────────────────────────────
  console.log("── [1~14] 정적 코드 검증 ──\n");
  const code = fs.readFileSync(APP_JSX, "utf8");

  // UX #2
  assert(code.includes("handleRateChef"), "[1] UX#2 — handleRateChef 핸들러 존재");
  assert(code.includes("chefRating") && code.includes("chefRatedAt"), "[2] UX#2 — chefRating/chefRatedAt 저장 코드");
  assert(code.includes("농가가 남긴 평가"), "[3] UX#2 — '농가가 남긴 평가' UI 문자열");
  assert(code.includes("onRespondCounterOffer"), "[4] UX#2/#4 — onRespondCounterOffer prop 체인");

  // UX #3
  assert(code.includes("dealId}__${") && code.includes("proposalId}"), "[5] UX#3 — chatId = dealId__proposalId 코드");
  assert(code.includes("proposalId: proposal.id") || code.includes("proposalId: p.id"), "[6] UX#3 — onOpenChat에 proposalId 포함");

  // UX #4
  assert(code.includes("CounterOfferModal"), "[7] UX#4 — CounterOfferModal 컴포넌트");
  assert(code.includes("handleSendCounterOffer"), "[8] UX#4 — handleSendCounterOffer 핸들러");
  assert(code.includes("handleRespondCounterOffer"), "[9] UX#4 — handleRespondCounterOffer 핸들러");
  assert(
    code.includes("역제안 도착") && code.includes("역제안 수락됨") && code.includes("역제안 거절됨"),
    "[10] UX#4 — 역제안 알림 3종 코드"
  );

  // UX #6
  assert(code.includes("SEASONAL_CROPS"), "[11] UX#6 — SEASONAL_CROPS 상수");
  assert(code.includes("SeasonalBanner"), "[12] UX#6 — SeasonalBanner 컴포넌트");
  assert(code.includes("SeasonalBanner") && code.includes("onSelectCrop={setCropFilter}"), "[13] UX#6 — DealBrowseScreen 배너 삽입 코드");
  assert(code.includes("월 제철 — 클릭하면 바로 선택돼요"), "[14] UX#6 — 딜 만들기 제철 힌트 문자열");

  // ── 브라우저 UI 테스트 [15~21] ────────────────────────────────────
  console.log("\n── [15~21] 브라우저 UI 테스트 ──\n");

  const browser = await chromium.launch({ headless: true });

  try {
    // ── [15~16] 농가 로그인 → 딜 찾기 제철 배너 ──
    console.log("  → 농가 계정 생성 중...");
    const farmCtx = await browser.newContext();
    const farmPage = await farmCtx.newPage();
    await signup(farmPage, FARM_EMAIL, PW, "farmer", FARM_NAME);

    await goToTab(farmPage, "딜 찾기");
    await farmPage.waitForTimeout(1000);

    const bannerMonth = new Date().getMonth() + 1;
    const bannerText = `${bannerMonth}월 제철 식재료`;
    const bannerEl = farmPage.locator(`text=${bannerText}`).first();
    assert(await bannerEl.count() > 0, `[15] UX#6 — 딜 찾기 '${bannerText}' 배너 표시`);

    // 제철 칩 존재 여부 확인
    const { chromium: _c, ...rest } = require("playwright");
    const SEASONAL = {
      1:["시금치","비트","케일"], 2:["시금치","케일","로메인"],
      3:["딸기","로메인","루꼴라"], 4:["딸기","로메인","루꼴라","바질"],
      5:["딸기","토마토","루꼴라","바질","파슬리"],
      6:["토마토","블루베리","파프리카","깻잎","바질"],
      7:["토마토","블루베리","복숭아","파프리카","깻잎","애호박"],
      8:["복숭아","무화과","토마토","파프리카","가지","고수"],
      9:["무화과","파프리카","가지","표고버섯"],
      10:["무화과","표고버섯","시금치","비트"],
      11:["시금치","비트","표고버섯","케일"],
      12:["시금치","비트","케일","로메인"],
    };
    const crops = SEASONAL[bannerMonth] || [];
    const firstCrop = crops[0];
    const chipBtn = farmPage.locator("button", { hasText: firstCrop }).first();
    let chipFound = await chipBtn.count() > 0;
    assert(chipFound, `[16] UX#6 — 제철 칩 '${firstCrop}' 표시`);

    if (chipFound) {
      await chipBtn.click();
      await farmPage.waitForTimeout(600);
      // 버튼 배경색이 moss(활성)로 변경됐는지 확인
      const activeChip = farmPage.locator("button", { hasText: firstCrop }).first();
      const bgColor = await activeChip.evaluate((el) => getComputedStyle(el).backgroundColor);
      // 활성화 시 TOKENS.moss (#5B7553) 계열 색상
      const isActive = bgColor !== "rgb(255, 255, 255)";
      assert(isActive, `[16b] UX#6 — 제철 칩 '${firstCrop}' 클릭 후 활성 스타일 적용`);
    }

    await farmCtx.close();

    // ── [17] 쉐프 로그인 → 딜 만들기 제철 힌트 ──
    console.log("  → 쉐프 계정 생성 중...");
    const chefCtx = await browser.newContext();
    const chefPage = await chefCtx.newPage();
    await signup(chefPage, CHEF_EMAIL, PW, "chef", CHEF_NAME);

    await goToTab(chefPage, "딜 만들기");
    await chefPage.waitForTimeout(800);

    const hintText = `${bannerMonth}월 제철`;
    const hintEl = chefPage.locator(`text=${hintText}`).first();
    assert(await hintEl.count() > 0, `[17] UX#6 — 딜 만들기 1단계 '${hintText}' 제철 힌트 표시`);

    // ── [18~20] 쉐프 딜 생성 → 농가 제안 → 채팅·역제안 버튼 확인 ──
    console.log("  → 딜 생성 중...");
    await createDeal(chefPage, "토마토");

    // 농가 로그인 후 제안 제출
    console.log("  → 농가 제안 제출 중...");
    const farmCtx2 = await browser.newContext();
    const farmPage2 = await farmCtx2.newPage();
    await login(farmPage2, FARM_EMAIL, PW);
    await submitProposal(farmPage2, "토마토");
    await farmCtx2.close();

    // 쉐프 내 거래 → 오픈 딜 제안 확인
    await goToTab(chefPage, "내 거래");
    await chefPage.waitForTimeout(3000);

    // 딜 카드 펼치기 — 이미 펼쳐져 있으면 채팅 버튼이 보임, 없으면 첫 번째 카드 클릭해서 펼치기
    let chatBtn = chefPage.locator("button", { hasText: /채팅/ }).first();
    if (await chatBtn.count() === 0) {
      const dealCard = chefPage.locator(".ftt-card").first();
      if (await dealCard.count() > 0) { await dealCard.click(); await chefPage.waitForTimeout(1000); }
      chatBtn = chefPage.locator("button", { hasText: /채팅/ }).first();
    }
    assert(await chatBtn.count() > 0, "[18] UX#3 — 쉐프 내 거래 오픈 딜 제안에 채팅 버튼 존재");

    // 역제안 버튼 찾기
    const counterBtn = chefPage.locator("button", { hasText: /역제안/ }).first();
    assert(await counterBtn.count() > 0, "[19] UX#4 — 쉐프 내 거래 오픈 딜 제안에 역제안 버튼 존재");

    // 역제안 버튼 클릭 → 모달 표시
    if (await counterBtn.count() > 0) {
      await counterBtn.click();
      await chefPage.waitForTimeout(600);
      const modalTitle = chefPage.locator("text=역제안 보내기").first();
      assert(await modalTitle.count() > 0, "[20] UX#4 — 역제안 버튼 클릭 시 CounterOfferModal 표시");

      // 단가 입력 필드 존재
      const priceField = chefPage.locator('input[type="number"]').first();
      assert(await priceField.count() > 0, "[20b] UX#4 — 역제안 모달 단가 입력 필드 존재");
    } else {
      assert(false, "[20] UX#4 — 역제안 버튼 클릭 시 CounterOfferModal 표시");
      assert(false, "[20b] UX#4 — 역제안 모달 단가 입력 필드 존재");
    }

    // [21] 코드: 농가 역제안 수신 배너
    assert(code.includes("셰프가 역제안을 보냈습니다"), "[21] UX#4 — 농가 역제안 수신 배너 문자열");

    await chefCtx.close();

  } catch (err) {
    console.error("  ❌ 브라우저 테스트 오류:", err.message);
    failed++;
    results.push({ label: "브라우저 테스트 오류", ok: false });
  } finally {
    await browser.close();
  }

  // ── 결과 요약 ──────────────────────────────────────────────────────
  console.log("\n====================================================");
  console.log(`결과: ${passed}/${passed + failed} 통과`);
  console.log("====================================================");
  results.forEach((r) => console.log(`  ${r.ok ? "✅" : "❌"} ${r.label}`));
  console.log("");

  if (failed > 0) process.exit(1);
}

run().catch((err) => { console.error(err); process.exit(1); });
