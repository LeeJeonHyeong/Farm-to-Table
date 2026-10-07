/**
 * AI 자동 입력 폴백 회귀 테스트
 * 프록시가 없는 정적 호스팅(= index.html 이 200 text/html 로 돌아오는 상황)에서
 *   · 원시 예외 문구가 화면에 노출되지 않고
 *   · 규칙 기반 파서로 폴백해 안내 문구가 뜨며
 *   · 품목 / 수량 / 납품일이 실제로 채워지는지
 * 를 확인한다.
 */
const { chromium } = require("playwright");

const BASE = process.env.BASE || "http://localhost:4178";
const TS = Date.now();
const EMAIL = `ai_fb_${TS}@test.com`;
const PW = "testpass123";
const NAME = `폴백셰프${TS % 10000}`;
// 사용자가 실제로 입력했던 문장
const SAMPLE = "테이블 나인인데요. 파스타용 바질이 중간정도 크기로 2kg 필요해요. "
             + "납품일은 다음주 목요일까지 이고 가격은 5만원 정도면 좋겠어요";

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`  ${ok ? "✅" : "❌"} ${name}${detail ? "  — " + detail : ""}`);
};

async function dismissOverlays(page) {
  for (let i = 0; i < 8; i++) {
    const next = page.locator("button", { hasText: /^다음$/ });
    const start = page.locator("button", { hasText: /시작하기/ });
    if (await next.count() > 0) { await next.click({ force: true }); await page.waitForTimeout(400); }
    else if (await start.count() > 0) { await start.click({ force: true }); await page.waitForTimeout(400); break; }
    else break;
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newContext({ viewport: { width: 1280, height: 900 } }).then(c => c.newPage());
  const consoleErrors = [];
  page.on("console", m => { if (m.type() === "error") consoleErrors.push(m.text()); });

  console.log("\n▶ 1. 셰프 가입 / 로그인");
  await page.goto(BASE);
  await page.waitForSelector('input[type="email"]', { timeout: 30000 });
  const toSignup = page.locator("button", { hasText: /가입/ }).first();
  if (await toSignup.count() > 0) await toSignup.click();
  await page.waitForTimeout(500);
  const roleBtn = page.locator("button", { hasText: "셰프" }).first();
  if (await roleBtn.count() > 0) await roleBtn.click();
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PW);
  const nameInput = page.locator('input[placeholder="예: 테이블나인"]').first();
  if (await nameInput.count() > 0) await nameInput.fill(NAME);
  for (const cb of await page.locator('input[type="checkbox"]').all()) await cb.check().catch(() => {});
  await page.locator("button", { hasText: /가입하기$/ }).last().click();
  await page.waitForTimeout(5000);
  if (await page.locator('button[class*="ftt-tab"]').count() === 0) {
    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', PW);
    await page.locator("button", { hasText: /로그인$/ }).last().click();
    await page.waitForTimeout(4000);
  }
  await dismissOverlays(page);
  await page.waitForSelector('button.ftt-card, button.ftt-tab', { state: "attached", timeout: 20000 });
  check("로그인", true);

  console.log("\n▶ 2. 딜 만들기 진입");
  await page.locator("button", { hasText: "딜 만들기" }).first().click({ force: true });
  await page.waitForTimeout(1500);
  const ta = page.locator("textarea").first();
  check("AI 자동 입력 패널 노출", await ta.count() > 0);

  console.log("\n▶ 3. 문장 입력 후 실행");
  await ta.fill(SAMPLE);
  await page.locator("button", { hasText: "AI로 자동 입력" }).first().click();
  await page.waitForFunction(
    () => [...document.querySelectorAll("button")].some(b => b.textContent.includes("AI로 자동 입력")),
    { timeout: 30000 }
  ).catch(() => {});
  await page.waitForTimeout(1200);

  console.log("\n▶ 4. 검증");
  const body = await page.locator("body").innerText();

  check("원시 예외 문구 미노출 (did not match the expected pattern)",
        !/did not match the expected pattern/i.test(body));
  check("원시 예외 문구 미노출 (Unexpected token)", !/Unexpected token/i.test(body));
  check("규칙 기반 폴백 안내 노출",
        /키워드 분석으로 자동 입력했습니다/.test(body),
        /키워드 분석으로 자동 입력했습니다/.test(body) ? "" : "안내 문구 없음");

  const crop = await page.locator("select").first().inputValue().catch(() => "");
  check("품목 자동 선택 (1단계)", crop.includes("바질"), `crop="${crop}"`);

  // 수량은 3단계, 납품일은 4단계에 있다 (DEAL_STEPS: 품목·조건·수량·납품/가격·확인)
  // 납품 장소는 필수인데 파서가 채우지 않으므로 직접 입력해야 다음 단계로 넘어간다.
  console.log("\n▶ 5. 위저드를 넘기며 채워진 값 확인");
  const addr = page.locator('input[placeholder="주소 찾기 또는 직접 입력"]').first();
  if (await addr.count() > 0) await addr.fill("서울시 강남구 테헤란로 1");
  let qty = "", date = "";
  for (let step = 1; step <= 4; step++) {
    const next = page.locator("button", { hasText: "다음 단계" }).first();
    if (await next.count() === 0) break;
    await next.click({ force: true });
    await page.waitForTimeout(700);
    if (!qty) {
      const q = page.locator('input[inputmode="decimal"], input[type="number"]').first();
      if (await q.count() > 0) qty = await q.inputValue().catch(() => "");
    }
    if (!date) {
      // 날짜가 채워지면 input 대신 "📅 2026-10-15 (목)" 텍스트로 잠긴다 (App.jsx 1945)
      const locked = await page.locator("text=/📅\\s*\\d{4}-\\d{2}-\\d{2}/").first()
        .innerText().catch(() => "");
      if (locked) date = (locked.match(/\d{4}-\d{2}-\d{2}/) || [""])[0];
      if (!date) {
        const d = page.locator('input[type="date"]').first();
        if (await d.count() > 0) date = await d.inputValue().catch(() => "");
      }
    }
  }
  check("수량 자동 입력", parseFloat(qty) === 2, `quantity="${qty}"`);
  const nextThu = (() => {              // 입력 문장의 "다음주 목요일" 기대값
    const d = new Date(); const diff = ((4 - d.getDay() + 7) % 7) || 7;
    d.setDate(d.getDate() + diff + 7);
    return d.toISOString().split("T")[0];
  })();
  check("납품일 자동 입력", /^\d{4}-\d{2}-\d{2}$/.test(date), `deliveryDate="${date}"`);
  check("납품일이 '다음주 목요일'로 해석", date === nextThu, `기대 ${nextThu} / 실제 ${date}`);

  const rawInConsole = consoleErrors.filter(e => /did not match the expected pattern|Unexpected token/i.test(e));
  check("콘솔에도 파싱 예외 없음 (예외 없이 폴백)", rawInConsole.length === 0,
        rawInConsole.length ? rawInConsole[0].slice(0, 70) : "");

  await page.screenshot({ path: "C:/Users/USER/AppData/Local/Temp/ai_fallback_result.png" });

  const pass = results.filter(r => r.ok).length;
  console.log(`\n${"=".repeat(60)}\n결과 ${pass}/${results.length} 통과`);
  for (const r of results.filter(r => !r.ok)) console.log(`  실패: ${r.name} ${r.detail}`);
  await browser.close();
  process.exit(pass === results.length ? 0 : 1);
})().catch(e => { console.error("오류:", e.message); process.exit(1); });
