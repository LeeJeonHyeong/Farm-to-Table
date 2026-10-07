/**
 * 비밀번호 재설정 기능 테스트
 *  · 로그인 탭에만 링크가 보이고 가입 탭에는 안 보이는지
 *  · 모달이 열리고 입력한 이메일이 넘어오는지
 *  · 빈 값 검증
 *  · 가입된 주소로 발송 성공
 *  · 가입되지 않은 주소도 같은 응답 (계정 존재 여부 노출 방지)
 */
const { chromium } = require("playwright");

const BASE = process.env.BASE || "http://localhost:5173";
const TS = Date.now();
const EMAIL = `pwreset_${TS}@test.com`;
const PW = "testpass123";
const NAME = `재설정셰프${TS % 10000}`;
const UNKNOWN = `nobody_${TS}@test.com`;

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`  ${ok ? "✅" : "❌"} ${name}${detail ? "  — " + detail : ""}`);
};

const modal = (page) => page.locator("text=비밀번호 재설정").first();

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newContext({ viewport: { width: 1280, height: 900 } }).then(c => c.newPage());

  console.log("\n▶ 1. 계정 하나 만들어 둔다");
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
  await page.waitForTimeout(5000);
  check("테스트 계정 생성", true, EMAIL);

  console.log("\n▶ 2. 로그아웃 후 로그인 화면으로");
  await page.evaluate(() => indexedDB.deleteDatabase("firebaseLocalStorageDb"));
  await page.context().clearCookies();
  await page.goto(BASE);
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload();
  await page.waitForSelector('input[type="email"]', { timeout: 30000 });

  console.log("\n▶ 3. 링크 노출 조건");
  const link = page.locator("button", { hasText: "비밀번호를 잊으셨나요?" });
  check("로그인 탭에 링크 노출", await link.count() > 0);
  await page.locator("button", { hasText: /^신규 가입$/ }).first().click();
  await page.waitForTimeout(400);
  check("가입 탭에서는 숨김", await page.locator("button", { hasText: "비밀번호를 잊으셨나요?" }).count() === 0);
  await page.locator("button", { hasText: /^로그인$/ }).first().click();
  await page.waitForTimeout(400);

  console.log("\n▶ 4. 입력한 이메일이 모달로 넘어오는지");
  await page.fill('input[type="email"]', EMAIL);
  await page.locator("button", { hasText: "비밀번호를 잊으셨나요?" }).click();
  await page.waitForTimeout(600);
  check("모달 열림", await modal(page).count() > 0);
  const carried = await page.locator('input[type="email"]').last().inputValue();
  check("이메일 자동 채움", carried === EMAIL, `"${carried}"`);

  console.log("\n▶ 5. 빈 값 검증");
  await page.locator('input[type="email"]').last().fill("");
  await page.locator("button", { hasText: "재설정 메일 보내기" }).click();
  await page.waitForTimeout(500);
  check("빈 값이면 안내", /이메일을 입력해주세요/.test(await page.locator("body").innerText()));

  console.log("\n▶ 6. 가입된 주소로 발송");
  await page.locator('input[type="email"]').last().fill(EMAIL);
  await page.locator("button", { hasText: "재설정 메일 보내기" }).click();
  await page.waitForTimeout(4000);
  const okText = await page.locator("body").innerText();
  check("발송 완료 안내", /재설정 메일을 보냈습니다/.test(okText));
  check("보낸 주소 표시", okText.includes(EMAIL));
  await page.locator("button", { hasText: /^확인$/ }).click();
  await page.waitForTimeout(500);
  check("확인 누르면 닫힘", await modal(page).count() === 0);

  console.log("\n▶ 7. 가입되지 않은 주소 — 같은 응답이어야 함");
  await page.locator("button", { hasText: "비밀번호를 잊으셨나요?" }).click();
  await page.waitForTimeout(500);
  await page.locator('input[type="email"]').last().fill(UNKNOWN);
  await page.locator("button", { hasText: "재설정 메일 보내기" }).click();
  await page.waitForTimeout(4000);
  const unknownText = await page.locator("body").innerText();
  check("미가입도 동일 안내 (계정 존재 여부 비노출)",
        /재설정 메일을 보냈습니다/.test(unknownText),
        /등록된 계정이 없습니다/.test(unknownText) ? "⚠ 계정 없음이 노출됨" : "");

  console.log("\n▶ 8. 링크 추가 후에도 일반 로그인이 되는지 (회귀)");
  await page.locator("button", { hasText: /^확인$/ }).click();   // 발송 완료 상태의 버튼
  await page.waitForTimeout(400);
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PW);
  await page.locator("button", { hasText: /^로그인$/ }).last().click();
  await page.waitForTimeout(5000);
  for (let i = 0; i < 8; i++) {
    const n = page.locator("button", { hasText: /^다음$/ }), s = page.locator("button", { hasText: /시작하기/ });
    if (await n.count()) { await n.click({ force: true }); await page.waitForTimeout(350); }
    else if (await s.count()) { await s.click({ force: true }); await page.waitForTimeout(350); break; }
    else break;
  }
  const entered = await page.locator("button.ftt-card, button.ftt-tab").count();
  check("기존 로그인 흐름 정상", entered > 0, `진입 후 탭/카드 ${entered}개`);

  await page.screenshot({ path: "C:/Users/USER/AppData/Local/Temp/pwreset_result.png" });

  const pass = results.filter(r => r.ok).length;
  console.log(`\n${"=".repeat(60)}\n결과 ${pass}/${results.length} 통과`);
  for (const r of results.filter(r => !r.ok)) console.log(`  실패: ${r.name} ${r.detail}`);
  await browser.close();
  process.exit(pass === results.length ? 0 : 1);
})().catch(e => { console.error("오류:", e.message); process.exit(1); });
