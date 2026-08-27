/**
 * H-3 검증: 농가 계정으로 딜 찾기 탭에 시연 딜이 표시되는지 확인
 */
const { chromium } = require("playwright");

const BASE = "http://localhost:5173";
const FARM_EMAIL = "demo.farm@ftt-demo.kr";
const PW = "fttDemo2026!";

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
  console.log("\n▶ 농가 로그인");
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  await page.goto(BASE);
  await page.waitForSelector('input[type="email"]', { timeout: 20000 });
  await page.fill('input[type="email"]', FARM_EMAIL);
  await page.fill('input[type="password"]', PW);
  await page.locator("button", { hasText: /로그인$/ }).last().click();
  await page.waitForTimeout(3000);
  await dismissOverlays(page);

  const tabVisible = await page.locator('button', { hasText: "딜 찾기" }).count() > 0;
  console.log(tabVisible ? "  ✅ 로그인 성공" : "  ❌ 로그인 실패");

  console.log("\n▶ 딜 찾기 탭 진입");
  await page.locator("button", { hasText: "딜 찾기" }).first().click({ force: true });
  await page.waitForTimeout(2000);

  const body = await page.locator("body").innerText();
  const dealCards = await page.locator("[class*='deal'], [data-deal]").count();

  // 딜 관련 텍스트 체크
  const hasCrops = ["토마토", "딸기", "바질", "블루베리", "케일", "파프리카", "표고버섯"].some(c => body.includes(c));
  const hasError = body.includes("TypeError") || body.includes("오류 발생");

  console.log(`  본문 길이: ${body.length}자`);
  console.log(`  농산물 키워드 발견: ${hasCrops}`);
  console.log(`  오류 없음: ${!hasError}`);

  if (hasCrops && !hasError) {
    console.log("  ✅ [PASS] 농가 입장 딜 찾기 탭에 시연 딜 표시됨");
  } else {
    console.log("  ❌ [FAIL] 딜이 표시되지 않음 — 관리자 계정으로 데이터 초기화 필요");
    // 화면 텍스트 일부 출력
    const lines = body.split("\n").filter(l => l.trim()).slice(0, 20);
    lines.forEach(l => console.log("    |", l.trim()));
  }

  await browser.close();
}

run().catch(err => { console.error("오류:", err.message); process.exit(1); });
