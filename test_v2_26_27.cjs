/**
 * test_v2_26_27.cjs
 * v2.26 농가 이력 공개 + v2.27 인증 뱃지·사진첨부 E2E 테스트
 *
 * [1]  v2.26 — computeFarmBadges 함수 존재
 * [2]  v2.26 — FarmProfileDetailCard 통계 칩 코드 (총 제안·선택률·완료 거래)
 * [3]  v2.26 — FarmProfileDetailCard 최근 선택 거래 이력 테이블 코드
 * [4]  v2.26 — FarmProfileScreen "셰프에게 이렇게 보여요" 미리보기 코드
 * [5]  v2.26 — FarmProfileDetailCard farmProps/selectedHistory 데이터 로직 코드
 * [6]  v2.26 — 농가 로그인 → 내 농가 탭 진입 확인
 * [7]  v2.26 — 농가명 입력 후 "셰프에게 이렇게 보여요" 미리보기 렌더링
 * [8]  v2.26 — 미리보기 안에 FarmProfileDetailCard 구조(농가명) 표시
 * [9]  v2.27 — PhotoLightbox 컴포넌트 코드 존재
 * [10] v2.27 — FarmProfileDetailCard certPhotoURL ✓ 표시 코드
 * [11] v2.27 — ProposalCard certPhotoURL 라이트박스 코드
 * [12] v2.27 — ProposalCard cropPhotoURL 썸네일 코드
 * [13] v2.27 — ProposalForm cropPhotoURL 데이터 상태 코드
 * [14] v2.27 — ProposalForm 제출 시 certPhotoURL·cropPhotoURL 포함 코드
 * [15] v2.27 — FarmProfileScreen certPhotoURL blank state 코드
 * [16] v2.27 — FarmProfileScreen 인증서 사진 업로드 UI 코드
 * [17] v2.27 — 농가 로그인 → 내 농가 → 인증 선택 → 인증서 사진 업로드 UI 노출
 * [18] v2.27 — 농가 로그인 → 딜 찾기 → 제안 폼 → 작물 사진 첨부 UI 노출
 */

const { chromium } = require("playwright");
const fs = require("fs");

const BASE = "http://localhost:5173";
const APP_JSX = "c:/Users/USER/Desktop/D.N.A/farm-to-table-project/farm-to-table-project/src/App.jsx";
const TS = Date.now();

const CHEF_EMAIL = `v2627chef_${TS}@test.com`;
const FARM_EMAIL = `v2627farm_${TS}@test.com`;
const PW = "testpass123";
const CHEF_NAME = `v2627셰프${TS % 10000}`;
const FARM_NAME_VAL = `테스트농가${TS % 10000}`;

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
  if (await btn.count() > 0) { await btn.first().click(); await page.waitForTimeout(1000); }
}

async function goToTabStrict(page, label, timeout = 8000) {
  const btn = page.locator("button", { hasText: label }).first();
  try {
    await btn.waitFor({ state: "visible", timeout });
    await btn.click();
    await page.waitForTimeout(1200);
  } catch (e) {
    // tab not found, page stays as-is
  }
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
  console.log("v2.26 농가 이력 공개 + v2.27 인증 뱃지·사진첨부 (18개)");
  console.log("====================================================\n");

  const code = fs.readFileSync(APP_JSX, "utf8");

  // ── [1~8] v2.26 정적 코드 검증 ──
  console.log("── [1~8] v2.26 정적 코드 검증 ──\n");

  assert(code.includes("computeFarmBadges"), "[1] v2.26 — computeFarmBadges 함수 존재");

  assert(
    code.includes("총 제안") && code.includes("선택률") && code.includes("완료 거래"),
    "[2] v2.26 — FarmProfileDetailCard 통계 칩 (총 제안·선택률·완료 거래)"
  );

  assert(
    code.includes("최근 선택 거래") && code.includes("selectedHistory"),
    "[3] v2.26 — FarmProfileDetailCard 최근 선택 거래 이력 테이블"
  );

  assert(
    code.includes("셰프에게 이렇게 보여요") && code.includes("FarmProfileDetailCard"),
    "[4] v2.26 — FarmProfileScreen '셰프에게 이렇게 보여요' 미리보기"
  );

  assert(
    code.includes("farmProps") && code.includes("selectedProps") && code.includes("doneCount"),
    "[5] v2.26 — FarmProfileDetailCard 통계 데이터 계산 로직"
  );

  // ── [9~16] v2.27 정적 코드 검증 ──
  console.log("\n── [9~16] v2.27 정적 코드 검증 ──\n");

  assert(
    code.includes("function PhotoLightbox") && code.includes("onClose"),
    "[9] v2.27 — PhotoLightbox 컴포넌트 코드"
  );

  assert(
    code.includes("certPhotoURL") && code.includes("setCertLightbox"),
    "[10] v2.27 — FarmProfileDetailCard certPhotoURL ✓ 표시·라이트박스 코드"
  );

  assert(
    code.includes("setCertLightbox") && code.includes("cropLightbox"),
    "[11] v2.27 — ProposalCard certPhotoURL·cropPhotoURL 라이트박스 코드"
  );

  assert(
    code.includes("proposal.cropPhotoURL") && code.includes("setCropLightbox"),
    "[12] v2.27 — ProposalCard 작물 사진 썸네일·라이트박스 코드"
  );

  assert(
    code.includes("cropPhotoURL: \"\"") || code.includes("cropPhotoURL:\"\"") || code.includes("cropPhotoURL: ''"),
    "[13] v2.27 — ProposalForm cropPhotoURL 초기 상태"
  );

  assert(
    code.includes("certPhotoURL: farmProfile?.certPhotoURL") && code.includes("cropPhotoURL: data.cropPhotoURL"),
    "[14] v2.27 — ProposalForm 제출 시 certPhotoURL·cropPhotoURL 포함"
  );

  assert(
    code.includes("certPhotoURL: \"\"") || code.includes('certPhotoURL: ""'),
    "[15] v2.27 — FarmProfileScreen certPhotoURL blank state"
  );

  assert(
    code.includes("인증서 사진 첨부") && code.includes("작물 사진 첨부"),
    "[16] v2.27 — 인증서·작물 사진 첨부 UI 텍스트 코드"
  );

  // ── [6~8, 17~18] 브라우저 UI 테스트 ──
  console.log("\n── [6~8, 17~18] 브라우저 UI 테스트 ──\n");

  const browser = await chromium.launch({ headless: true });

  try {
    // ── 계정 생성 단계 (signup context는 계정 생성 후 닫음) ──
    console.log("  → 농가 계정 생성 중...");
    const signupCtx = await browser.newContext();
    const signupPage = await signupCtx.newPage();
    await signup(signupPage, FARM_EMAIL, PW, "farmer", FARM_NAME_VAL);
    await signupCtx.close();

    console.log("  → 셰프 계정·딜 생성 중...");
    const chefCtx = await browser.newContext();
    const chefPage = await chefCtx.newPage();
    await signup(chefPage, CHEF_EMAIL, PW, "chef", CHEF_NAME);
    await createDeal(chefPage);
    await chefCtx.close();

    // ── [6~8, 17] 농가 내 농가 탭 테스트 — login() 사용 ──
    console.log("  → 농가 로그인(내 농가 테스트) 중...");
    const farmCtx = await browser.newContext();
    const farmPage = await farmCtx.newPage();
    await login(farmPage, FARM_EMAIL, PW);

    // [6] 내 농가 탭 진입
    const farmTabBtn = farmPage.locator("button", { hasText: "내 농가" }).first();
    if (await farmTabBtn.count() > 0) {
      await farmTabBtn.click({ force: true });
      await farmPage.waitForTimeout(1500);
    }
    let farmScreenLoaded = false;
    try {
      await farmPage.waitForSelector('input[placeholder="예: 신선팜"]', { timeout: 5000 });
      farmScreenLoaded = true;
    } catch (e) {
      await farmPage.locator("button", { hasText: "내 농가" }).first().click({ force: true }).catch(() => {});
      await farmPage.waitForTimeout(2000);
      try {
        await farmPage.waitForSelector('input[placeholder="예: 신선팜"]', { timeout: 4000 });
        farmScreenLoaded = true;
      } catch (_) {}
    }
    assert(farmScreenLoaded, "[6] v2.26 — 농가 로그인 → 내 농가 탭 농가명 입력 필드 표시");

    // [7] 미리보기 확인
    if (farmScreenLoaded) {
      const farmNameInput = farmPage.locator('input[placeholder="예: 신선팜"]').first();
      const currentVal = await farmNameInput.inputValue().catch(() => "");
      if (!currentVal) await farmNameInput.fill(FARM_NAME_VAL);
      await farmPage.waitForTimeout(800);
    }
    let previewVisible = false;
    try {
      await farmPage.waitForSelector("text=셰프에게 이렇게 보여요", { timeout: 5000 });
      previewVisible = true;
    } catch (_) {}
    assert(previewVisible, "[7] v2.26 — 농가명 입력 후 '셰프에게 이렇게 보여요' 미리보기 표시");

    // [8] 미리보기 안에 농가명 렌더링
    const farmNameOccurrences = await farmPage.locator(`text=${FARM_NAME_VAL}`).count();
    assert(farmNameOccurrences >= 1, "[8] v2.26 — 미리보기 영역에 농가명 렌더링");

    // [17] 인증 선택 → 인증서 사진 업로드 UI
    if (farmScreenLoaded) {
      const certBtns = ["무농약", "유기농", "GAP", "친환경"];
      let certClicked = false;
      for (const certLabel of certBtns) {
        const btn = farmPage.locator("button", { hasText: certLabel }).first();
        if (await btn.count() > 0) {
          await btn.scrollIntoViewIfNeeded().catch(() => {});
          await btn.click();
          await farmPage.waitForTimeout(800);
          certClicked = true;
          break;
        }
      }
      let certUploadVisible = false;
      try {
        await farmPage.waitForSelector("text=인증서 사진 첨부", { timeout: 4000 });
        certUploadVisible = true;
      } catch (_) {}
      assert(certClicked && certUploadVisible, "[17] v2.27 — 인증 선택 후 '인증서 사진 첨부' 업로드 UI 표시");
    } else {
      assert(false, "[17] v2.27 — 인증 선택 후 '인증서 사진 첨부' 업로드 UI 표시");
    }
    await farmCtx.close();

    // ── [18] 딜 찾기 → 제안 폼 → 작물 사진 첨부 UI ──
    console.log("  → 농가 로그인(딜 찾기 테스트) 중...");
    const farmCtx2 = await browser.newContext();
    const farmPage2 = await farmCtx2.newPage();
    await login(farmPage2, FARM_EMAIL, PW);

    await goToTab(farmPage2, "딜 찾기");
    await farmPage2.waitForTimeout(2000);

    const dealCard = farmPage2.locator(".ftt-card").first();
    if (await dealCard.count() > 0) {
      await dealCard.click();
      await farmPage2.waitForTimeout(1000);
    }

    const propBtn = farmPage2.locator("button", { hasText: /이 딜에 제안 보내기/ }).first();
    if (await propBtn.count() > 0) {
      await propBtn.click();
      await farmPage2.waitForTimeout(800);
    }

    const cropUploadLabel = farmPage2.locator("text=작물 사진 첨부").first();
    assert(await cropUploadLabel.count() > 0, "[18] v2.27 — 제안 폼에 '작물 사진 첨부' 업로드 UI 표시");

    await farmCtx2.close();

  } catch (err) {
    console.error("  ❌ 브라우저 테스트 오류:", err.message);
    failed++;
    results.push({ label: "브라우저 테스트 오류", ok: false });
  } finally {
    await browser.close();
  }

  // ── 결과 요약 ──
  console.log("\n====================================================");
  console.log(`결과: ${passed}/${passed + failed} 통과`);
  if (failed > 0) {
    console.log("\n실패 목록:");
    results.filter((r) => !r.ok).forEach((r) => console.log(`  ✗ ${r.label}`));
  }
  console.log("====================================================\n");

  process.exit(failed > 0 ? 1 : 0);
}

run().catch((e) => { console.error(e); process.exit(1); });
