/**
 * 이메일 찾기 E2E — 실제 배포본에 가입한 뒤 상호명으로 되찾아지는지 확인한다.
 *   BASE=https://<프로젝트>.vercel.app node test_find_email_e2e.cjs
 */
const { chromium } = require("playwright");

const BASE = (process.env.BASE || "").replace(/\/$/, "");
if (!BASE) { console.error("BASE 환경변수가 필요합니다."); process.exit(2); }

const TS = Date.now();
const EMAIL = `findmail_${TS}@test.com`;
const PW = "testpass123";
const NAME = `찾기테스트농가${TS % 100000}`;
const UNKNOWN = `없는업체${TS}`;

// api/account/find-email.js 의 maskEmail 과 같은 규칙
const expectedMask = (() => {
  const at = EMAIL.lastIndexOf("@");
  const local = EMAIL.slice(0, at);
  const keep = local.slice(0, 2);
  return keep + "*".repeat(Math.max(3, local.length - keep.length)) + EMAIL.slice(at);
})();

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`  ${ok ? "✅" : "❌"} ${name}${detail ? "  — " + detail : ""}`);
};

(async () => {
  console.log(`\n대상: ${BASE}`);
  console.log(`가입 상호명: ${NAME}\n기대 마스킹: ${expectedMask}`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newContext({ viewport: { width: 1280, height: 900 } }).then(c => c.newPage());

  console.log("\n▶ 1. 농가로 가입");
  await page.goto(BASE);
  await page.waitForSelector('input[type="email"]', { timeout: 30000 });
  const toSignup = page.locator("button", { hasText: /가입/ }).first();
  if (await toSignup.count() > 0) await toSignup.click();
  await page.waitForTimeout(400);
  const roleBtn = page.locator("button", { hasText: "농가" }).first();
  if (await roleBtn.count() > 0) await roleBtn.click();
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PW);
  const nameInput = page.locator('input[placeholder="예: 신선팜"]').first();
  if (await nameInput.count() > 0) await nameInput.fill(NAME);
  else await page.locator('input[type="text"]').first().fill(NAME);
  for (const cb of await page.locator('input[type="checkbox"]').all()) await cb.check().catch(() => {});
  await page.locator("button", { hasText: /가입하기$/ }).last().click();
  await page.waitForTimeout(6000);
  check("가입 완료", await page.locator("button.ftt-card, button.ftt-tab").count() > 0
        || !(await page.locator("body").innerText()).includes("가입하기"));

  console.log("\n▶ 2. 로그아웃 상태로 전환");
  await page.evaluate(() => indexedDB.deleteDatabase("firebaseLocalStorageDb"));
  await page.goto(BASE);
  await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch {} });
  await page.reload();
  await page.waitForSelector('input[type="email"]', { timeout: 30000 });
  check("로그인 화면", await page.locator("button", { hasText: "이메일을 잊으셨나요?" }).count() > 0);

  console.log("\n▶ 3. 없는 상호명 → 못 찾음");
  await page.locator("button", { hasText: "이메일을 잊으셨나요?" }).click();
  await page.waitForTimeout(600);
  const nameBox = () => page.locator('input[placeholder="예: 테이블나인"]').last();
  await nameBox().fill(UNKNOWN);
  await page.locator("button", { hasText: /^찾기$/ }).click();
  await page.waitForTimeout(6000);
  const t1 = await page.locator("body").innerText();
  check("'찾지 못했습니다' 안내", /가입된 계정을 찾지 못했습니다/.test(t1));
  check("없는 이름에 주소가 안 뜸", !/@/.test(t1.split("가입된 계정을 찾지 못했습니다")[0].slice(-200)));

  console.log("\n▶ 4. 가입한 상호명 → 마스킹된 주소");
  await nameBox().fill(NAME);
  await page.locator("button", { hasText: /^찾기$/ }).click();
  await page.waitForTimeout(8000);
  const t2 = await page.locator("body").innerText();
  check("마스킹된 주소 노출", t2.includes(expectedMask), expectedMask);
  check("전체 주소는 노출되지 않음", !t2.includes(EMAIL));
  check("로컬부 전체가 안 보임", !t2.includes(`findmail_${TS}`));

  console.log("\n▶ 5. 비밀번호 재설정으로 연결");
  const handoff = page.locator("button", { hasText: /^비밀번호 재설정$/ });
  check("재설정 버튼 노출", await handoff.count() > 0);
  if (await handoff.count() > 0) {
    await handoff.click();
    await page.waitForTimeout(800);
    check("재설정 모달로 전환", /재설정 메일 보내기/.test(await page.locator("body").innerText()));
  }

  await page.screenshot({ path: "C:/Users/USER/AppData/Local/Temp/find_email_e2e.png" });
  const pass = results.filter(r => r.ok).length;
  console.log(`\n${"=".repeat(60)}\n결과 ${pass}/${results.length} 통과`);
  for (const r of results.filter(r => !r.ok)) console.log(`  실패: ${r.name} ${r.detail}`);
  await browser.close();
  process.exit(pass === results.length ? 0 : 1);
})().catch(e => { console.error("오류:", e.message); process.exit(1); });
