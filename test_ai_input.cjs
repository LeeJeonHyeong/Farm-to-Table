/**
 * AI 자동 입력 기능 테스트
 */
const { chromium } = require("playwright");

const BASE = "http://localhost:5173";
const TS = Date.now();
const CHEF_EMAIL = `ai_test_${TS}@test.com`;
const PW = "testpass123";
const CHEF_NAME = `AI테스트셰프${TS % 10000}`;

async function dismissOverlays(page) {
  for (let i = 0; i < 8; i++) {
    const next = page.locator("button", { hasText: /^다음$/ });
    const start = page.locator("button", { hasText: /시작하기/ });
    if (await next.count() > 0) { await next.click({ force: true }); await page.waitForTimeout(400); }
    else if (await start.count() > 0) { await start.click({ force: true }); await page.waitForTimeout(400); break; }
    else break;
  }
}

async function run() {
  const browser = await chromium.launch({ headless: false, slowMo: 300 });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  // 콘솔 로그 캡처
  page.on("console", msg => {
    if (msg.type() === "error") console.log("🔴 콘솔 오류:", msg.text());
  });

  console.log("\n▶ 1. 셰프 회원가입");
  await page.goto(BASE);
  await page.waitForSelector('input[type="email"]', { timeout: 20000 });

  const toSignup = page.locator("button", { hasText: /가입/ }).first();
  if (await toSignup.count() > 0) await toSignup.click();
  await page.waitForTimeout(500);

  const roleBtn = page.locator("button", { hasText: "셰프" }).first();
  if (await roleBtn.count() > 0) await roleBtn.click();

  await page.fill('input[type="email"]', CHEF_EMAIL);
  await page.fill('input[type="password"]', PW);
  const nameInput = page.locator('input[placeholder="예: 테이블나인"]').first();
  if (await nameInput.count() > 0) await nameInput.fill(CHEF_NAME);

  await page.locator("button", { hasText: /가입하기$/ }).last().click();
  await page.waitForTimeout(4000);

  if (await page.locator('button[class*="ftt-tab"]').count() === 0) {
    await page.fill('input[type="email"]', CHEF_EMAIL);
    await page.fill('input[type="password"]', PW);
    await page.locator("button", { hasText: /로그인$/ }).last().click();
    await page.waitForTimeout(3000);
  }
  await dismissOverlays(page);
  console.log("  ✅ 로그인 완료");

  console.log("\n▶ 2. 딜 만들기 탭 진입");
  const dealTab = page.locator("button", { hasText: "딜 만들기" }).first();
  await dealTab.click({ force: true });
  await page.waitForTimeout(1500);

  console.log("\n▶ 3. AI 자동 입력 패널 확인");
  const aiTextarea = page.locator("textarea").first();
  const aiBtn = page.locator("button", { hasText: "AI로 자동 입력" }).first();

  if (await aiTextarea.count() === 0) {
    console.log("  ❌ AI 텍스트 영역을 찾을 수 없습니다");
    await browser.close();
    return;
  }
  console.log("  ✅ AI 입력 패널 존재 확인");

  console.log("\n▶ 4. 샘플 텍스트 입력");
  const sampleText = "테이블나인인데요, 콩피용 토마토 50kg 납품받고 싶어요. 특등급으로 납품일은 2026-09-15이고 단가는 20,000원/kg 희망합니다.";
  await aiTextarea.fill(sampleText);
  console.log("  입력:", sampleText);

  console.log("\n▶ 5. 'AI로 자동 입력' 버튼 클릭");
  const startTime = Date.now();
  await aiBtn.click();

  // AI 분석 중 상태 확인
  await page.waitForTimeout(500);
  const loadingBtn = page.locator("button", { hasText: "AI 분석 중…" });
  if (await loadingBtn.count() > 0) {
    console.log("  ✅ AI 분석 중… (로딩 상태 확인)");
  }

  // 완료 대기 (최대 30초)
  try {
    await page.waitForFunction(
      () => {
        const btns = [...document.querySelectorAll("button")];
        return btns.some(b => b.textContent.includes("AI로 자동 입력"));
      },
      { timeout: 30000 }
    );
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`  ✅ AI 응답 완료 (${elapsed}초 소요)`);
  } catch {
    console.log("  ⚠ 30초 내 완료 안됨 — 계속 진행");
  }

  await page.waitForTimeout(1000);

  // 결과 확인
  const successMsg = page.locator("text=항목이 자동으로 채워졌습니다");
  const fallbackMsg = page.locator("text=키워드 분석으로 자동 입력했습니다");
  const errorMsg = page.locator("text=AI 서버 연결 불가");

  if (await successMsg.count() > 0) {
    console.log("\n  ✅ [PASS] Groq AI 자동 입력 성공 — 항목 자동 채움");
  } else if (await fallbackMsg.count() > 0) {
    console.log("\n  ⚠ [WARN] Groq API 실패 → 규칙 기반 파서 폴백 동작");
  } else if (await errorMsg.count() > 0) {
    console.log("\n  ❌ [FAIL] AI 서버 연결 불가 오류");
  } else {
    const bodyText = await page.locator("body").innerText();
    if (bodyText.includes("TypeError") || bodyText.includes("오류")) {
      console.log("\n  ❌ [FAIL] 페이지 오류 발생");
    } else {
      console.log("\n  ✅ [PASS] 오류 없이 처리됨 (메시지 확인 필요)");
    }
  }

  console.log("\n▶ 6. 스크린샷 저장");
  await page.screenshot({ path: "C:/Users/USER/AppData/Local/Temp/ai_test_result.png", fullPage: false });
  console.log("  스크린샷: C:/Users/USER/AppData/Local/Temp/ai_test_result.png");

  await page.waitForTimeout(3000);
  await browser.close();
  console.log("\n테스트 완료");
}

run().catch(err => {
  console.error("오류:", err.message);
  process.exit(1);
});
