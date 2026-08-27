/**
 * 데모 계정 생성 스크립트
 * 셰프 + 농가 데모 계정을 Firebase에 생성하고 자격증명을 출력합니다.
 */
const { chromium } = require("playwright");

const BASE = "http://localhost:5173";
const CHEF_EMAIL = "demo.chef@ftt-demo.kr";
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

async function createAccount(page, email, pw, role, name) {
  await page.goto(BASE);
  await page.waitForSelector('input[type="email"]', { timeout: 20000 });

  // 이미 로그인돼 있으면 로그아웃
  const logoutBtn = page.locator("button", { hasText: /로그아웃/ });
  if (await logoutBtn.count() > 0) {
    await logoutBtn.click();
    await page.waitForTimeout(2000);
    await page.goto(BASE);
    await page.waitForSelector('input[type="email"]', { timeout: 15000 });
  }

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

  await page.locator("button", { hasText: /가입하기$/ }).last().click();
  await page.waitForTimeout(4000);

  // 이미 존재하면 로그인 시도
  if (await page.locator('button[class*="ftt-tab"]').count() === 0) {
    const errText = await page.locator("body").innerText();
    if (errText.includes("이미") || errText.includes("already") || errText.includes("exists")) {
      console.log(`  ℹ 이미 존재 — 로그인으로 확인`);
    }
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', pw);
    await page.locator("button", { hasText: /로그인$/ }).last().click();
    await page.waitForTimeout(3000);
  }

  await dismissOverlays(page);

  const ok = await page.locator('button[class*="ftt-tab"]').count() > 0;
  return ok;
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
  const chefOk = await createAccount(page, CHEF_EMAIL, PW, "chef", "데모 레스토랑");
  console.log(chefOk ? "  ✅ 셰프 계정 준비 완료" : "  ❌ 셰프 계정 생성 실패");

  // 농가 계정
  console.log(`\n▶ 농가 계정 생성: ${FARM_EMAIL}`);
  const farmOk = await createAccount(page, FARM_EMAIL, PW, "farm", "데모 농장");
  console.log(farmOk ? "  ✅ 농가 계정 준비 완료" : "  ❌ 농가 계정 생성 실패");

  await browser.close();

  if (chefOk && farmOk) {
    console.log("\n============================================");
    console.log(".env.local에 추가할 내용:");
    console.log("============================================");
    console.log(`VITE_DEMO_CHEF_EMAIL=${CHEF_EMAIL}`);
    console.log(`VITE_DEMO_CHEF_PW=${PW}`);
    console.log(`VITE_DEMO_FARM_EMAIL=${FARM_EMAIL}`);
    console.log(`VITE_DEMO_FARM_PW=${PW}`);
    console.log("============================================\n");
    process.exit(0);
  } else {
    process.exit(1);
  }
}

run().catch(err => { console.error("오류:", err.message); process.exit(1); });
