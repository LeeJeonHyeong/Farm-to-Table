/**
 * 데모 계정 생성 스크립트
 * 셰프 + 농가 데모 계정을 Firebase에 생성하고 자격증명을 출력합니다.
 */
const { chromium } = require("playwright");
const { demoCreds } = require("./load_env.cjs");

const BASE = "http://localhost:5173";

// 자격증명은 저장소에 두지 않는다. .env.local이 유일한 출처다.
const {
  chefEmail: CHEF_EMAIL, chefPw: CHEF_PW,
  farmEmail: FARM_EMAIL, farmPw: FARM_PW,
} = demoCreds();

async function dismissOverlays(page) {
  for (let i = 0; i < 8; i++) {
    const next = page.locator("button", { hasText: /^다음$/ });
    const start = page.locator("button", { hasText: /시작하기/ });
    if (await next.count() > 0) { await next.click({ force: true }); await page.waitForTimeout(400); }
    else if (await start.count() > 0) { await start.click({ force: true }); await page.waitForTimeout(400); break; }
    else break;
  }
}

async function createAccount(page, email, pw, role, name) {
  await page.goto(BASE);
  // 앞 계정 생성으로 로그인 상태가 남아 있을 수 있다. 로그인 폼이든 앱 화면이든
  // 먼저 렌더될 때까지 기다린 뒤, 로그인 상태면 로그아웃한다.
  // (홈 랜딩에서는 탭 바가 display:none 이라 attached 로 판단한다)
  await page.waitForSelector('input[type="email"], button.ftt-card, button.ftt-tab', { state: "attached", timeout: 25000 });
  const logoutBtn = page.locator("button", { hasText: /로그아웃/ });
  if (await logoutBtn.count() > 0) {
    await logoutBtn.first().click();
    await page.waitForTimeout(2500);
  }
  await page.waitForSelector('input[type="email"]', { timeout: 20000 });

  const toSignup = page.locator("button", { hasText: /가입/ }).first();
  if (await toSignup.count() > 0) await toSignup.click();
  await page.waitForTimeout(500);

  const roleBtn = page.locator("button", { hasText: role === "chef" ? "셰프" : "농가" }).first();
  if (await roleBtn.count() > 0) await roleBtn.click();

  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', pw);

  const ph = role === "chef" ? "예: 테이블나인" : "예: 신선팜";
  const nameInput = page.locator(`input[placeholder="${ph}"]`).first();
  if (await nameInput.count() > 0) await nameInput.fill(name);

  // 가입 시 약관 동의 필수 — 화면에 체크박스가 있으면 모두 체크한다


  for (const cb of await page.locator('input[type="checkbox"]').all()) await cb.check().catch(() => {});


  await page.locator("button", { hasText: /가입하기$/ }).last().click();
  await page.waitForTimeout(4000);

  // 이미 존재하면 로그인으로 확인. 가입 모드에서는 제출 버튼이 "가입하기"라
  // 먼저 로그인 탭으로 전환해야 한다.
  if (await page.locator('button[class*="ftt-tab"], button.ftt-card').count() === 0) {
    const errText = await page.locator("body").innerText();
    if (/이미|already|exists/.test(errText)) console.log("  ℹ 이미 존재 — 로그인으로 확인");
    const loginTab = page.locator("button", { hasText: /^로그인$/ }).first();
    if (await loginTab.count() > 0) { await loginTab.click(); await page.waitForTimeout(600); }
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', pw);
    await page.locator("button", { hasText: /^로그인$/ }).last().click();
    await page.waitForSelector('button[class*="ftt-tab"], button.ftt-card', { state: "attached", timeout: 20000 }).catch(() => {});
  }

  await dismissOverlays(page);

  return (await page.locator('button[class*="ftt-tab"], button.ftt-card').count()) > 0;
}

async function run() {
  console.log("\n============================================");
  console.log("Farm-to-Table 데모 계정 생성");
  console.log("============================================\n");

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  // 셰프 계정
  console.log(`▶ 셰프 계정 생성: ${CHEF_EMAIL}`);
  const chefOk = await createAccount(page, CHEF_EMAIL, CHEF_PW, "chef", "데모 레스토랑");
  console.log(chefOk ? "  ✅ 셰프 계정 준비 완료" : "  ❌ 셰프 계정 생성 실패");

  // 농가 계정
  console.log(`\n▶ 농가 계정 생성: ${FARM_EMAIL}`);
  const farmOk = await createAccount(page, FARM_EMAIL, FARM_PW, "farm", "데모 농장");
  console.log(farmOk ? "  ✅ 농가 계정 준비 완료" : "  ❌ 농가 계정 생성 실패");

  await browser.close();

  if (chefOk && farmOk) {
    console.log("\n============================================");
    console.log("두 계정 모두 .env.local의 자격증명으로 로그인 확인됨.");
    console.log("============================================\n");
    process.exit(0);
  } else {
    process.exit(1);
  }
}

run().catch(err => { console.error("오류:", err.message); process.exit(1); });
