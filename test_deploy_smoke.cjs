/**
 * 배포 스모크 테스트 — 호스팅을 옮긴 뒤 한 번에 확인한다.
 *   BASE=https://<프로젝트>.vercel.app node test_deploy_smoke.cjs
 *
 * 확인 항목
 *   1) 사이트가 뜨는지
 *   2) /api/groq 프록시가 살아 있는지 (JSON 응답)
 *   3) 회원가입 → 앱 진입  ★ Firebase '승인된 도메인' 누락 시 여기서 실패한다
 *   4) AI 자동 입력이 규칙 폴백이 아니라 실제 AI 로 동작하는지
 *   5) 비밀번호 재설정 링크·모달
 *   6) 로그아웃 → 재로그인
 */
const { chromium } = require("playwright");

const BASE = (process.env.BASE || "").replace(/\/$/, "");
if (!BASE) {
  console.error("BASE 환경변수가 필요합니다.  예) BASE=https://xxx.vercel.app node test_deploy_smoke.cjs");
  process.exit(2);
}
const TS = Date.now();
const EMAIL = `smoke_${TS}@test.com`;
const PW = "testpass123";
const NAME = `스모크셰프${TS % 10000}`;
const SAMPLE = "테이블나인인데요, 콩피용 토마토 50kg 주 1회 납품받고 싶어요. "
             + "라이트레드 단계에 특등급으로, 납품일은 다음주 목요일, 단가는 20000원/kg 희망합니다.";

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`  ${ok ? "✅" : "❌"} ${name}${detail ? "  — " + detail : ""}`);
};

(async () => {
  console.log(`\n대상: ${BASE}`);

  console.log("\n▶ 1. 사이트 · API 엔드포인트");
  const home = await fetch(BASE);
  check("사이트 응답", home.ok, `HTTP ${home.status}`);

  const api = await fetch(`${BASE}/api/groq/openai/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Sec-Fetch-Site": "same-origin", Origin: BASE },
    body: JSON.stringify({
      model: "qwen/qwen3.8-27b",
      messages: [{ role: "user", content: "ping" }], max_tokens: 5,
    }),
  });
  const ctype = api.headers.get("content-type") || "";
  check("AI 프록시가 JSON 반환", api.ok && ctype.includes("application/json"),
        `HTTP ${api.status} ${ctype}` + (ctype.includes("text/html") ? "  ※ 프록시 없음 — 정적 호스팅 상태" : ""));

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newContext({ viewport: { width: 1280, height: 900 } }).then(c => c.newPage());
  const errs = [];
  page.on("console", m => { if (m.type() === "error") errs.push(m.text()); });

  console.log("\n▶ 2. 회원가입 → 앱 진입  (Firebase 승인된 도메인 검증)");
  await page.goto(BASE);
  await page.waitForSelector('input[type="email"]', { timeout: 30000 });
  const toSignup = page.locator("button", { hasText: /가입/ }).first();
  if (await toSignup.count() > 0) await toSignup.click();
  await page.waitForTimeout(400);
  const roleBtn = page.locator("button", { hasText: "셰프" }).first();
  if (await roleBtn.count() > 0) await roleBtn.click();
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PW);
  const nameInput = page.locator('input[placeholder="예: 테이블나인"]').first();
  if (await nameInput.count() > 0) await nameInput.fill(NAME);
  for (const cb of await page.locator('input[type="checkbox"]').all()) await cb.check().catch(() => {});
  await page.locator("button", { hasText: /가입하기$/ }).last().click();
  await page.waitForTimeout(6000);

  const bodyAfter = await page.locator("body").innerText();
  const domainBlocked = /unauthorized-domain|승인되지 않은|도메인/i.test(bodyAfter);
  for (let i = 0; i < 8; i++) {
    const n = page.locator("button", { hasText: /^다음$/ }), s = page.locator("button", { hasText: /시작하기/ });
    if (await n.count()) { await n.click({ force: true }); await page.waitForTimeout(350); }
    else if (await s.count()) { await s.click({ force: true }); await page.waitForTimeout(350); break; }
    else break;
  }
  const entered = await page.locator("button.ftt-card, button.ftt-tab").count();
  check("가입 후 앱 진입", entered > 0,
        entered > 0 ? "" : (domainBlocked ? "⚠ Firebase 승인된 도메인에 이 주소를 추가하세요" : "원인 불명"));

  console.log("\n▶ 3. AI 자동 입력 (실제 AI 여부)");
  if (entered > 0) {
    await page.locator("button", { hasText: "딜 만들기" }).first().click({ force: true });
    await page.waitForTimeout(1500);
    await page.locator("textarea").first().fill(SAMPLE);
    await page.locator("button", { hasText: "AI로 자동 입력" }).first().click();
    await page.waitForFunction(
      () => [...document.querySelectorAll("button")].some(b => b.textContent.includes("AI로 자동 입력")),
      { timeout: 40000 }).catch(() => {});
    await page.waitForTimeout(1200);
    const t = await page.locator("body").innerText();
    const fellBack = /키워드 분석으로 자동 입력했습니다/.test(t);
    check("오류 문구 없음", !/did not match the expected pattern|Unexpected token/i.test(t));
    check("실제 AI 로 처리 (규칙 폴백 아님)", !fellBack,
          fellBack ? "규칙 파서로 폴백됨 — GROQ_API_KEY 또는 프록시 확인" : "");
    const crop = await page.locator("select").first().inputValue().catch(() => "");
    check("품목 자동 선택", crop.includes("토마토"), `crop="${crop}"`);
  } else {
    check("AI 자동 입력", false, "앱 진입 실패로 건너뜀");
  }

  console.log("\n▶ 4. 비밀번호 재설정");
  await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch {} });
  await page.evaluate(() => indexedDB.deleteDatabase("firebaseLocalStorageDb"));
  await page.goto(BASE);
  await page.waitForSelector('input[type="email"]', { timeout: 30000 });
  const link = page.locator("button", { hasText: "비밀번호를 잊으셨나요?" });
  check("재설정 링크 노출", await link.count() > 0);
  if (await link.count() > 0) {
    await page.fill('input[type="email"]', EMAIL);
    await link.click();
    await page.waitForTimeout(600);
    await page.locator("button", { hasText: "재설정 메일 보내기" }).click();
    await page.waitForTimeout(4000);
    check("재설정 메일 발송", /재설정 메일을 보냈습니다/.test(await page.locator("body").innerText()));
    await page.locator("button", { hasText: /^확인$/ }).click().catch(() => {});
    await page.waitForTimeout(400);
  }

  console.log("\n▶ 5. 재로그인");
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PW);
  await page.locator("button", { hasText: /^로그인$/ }).last().click();
  await page.waitForTimeout(6000);
  for (let i = 0; i < 8; i++) {
    const n = page.locator("button", { hasText: /^다음$/ }), s = page.locator("button", { hasText: /시작하기/ });
    if (await n.count()) { await n.click({ force: true }); await page.waitForTimeout(350); }
    else if (await s.count()) { await s.click({ force: true }); await page.waitForTimeout(350); break; }
    else break;
  }
  check("재로그인 성공", await page.locator("button.ftt-card, button.ftt-tab").count() > 0);

  const fatal = errs.filter(e => !/favicon|manifest|sw\.js/i.test(e));
  check("치명적 콘솔 오류 없음", fatal.length === 0, fatal[0] ? fatal[0].slice(0, 80) : "");

  await page.screenshot({ path: "C:/Users/USER/AppData/Local/Temp/deploy_smoke.png" });
  const pass = results.filter(r => r.ok).length;
  console.log(`\n${"=".repeat(64)}\n결과 ${pass}/${results.length} 통과`);
  for (const r of results.filter(r => !r.ok)) console.log(`  실패: ${r.name}  ${r.detail}`);
  await browser.close();
  process.exit(pass === results.length ? 0 : 1);
})().catch(e => { console.error("오류:", e.message); process.exit(1); });
