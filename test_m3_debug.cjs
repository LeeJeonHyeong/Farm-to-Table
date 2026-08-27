const { chromium } = require("playwright");
const BASE = "http://localhost:5173";
const CHEF_EMAIL = "demo.chef@ftt-demo.kr";
const PW = "fttDemo2026!";
const MOBILE = { width: 390, height: 844, isMobile: true, hasTouch: true };

async function run() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ ...MOBILE });
  const page = await ctx.newPage();

  await page.goto(BASE);
  await page.waitForSelector('input[type="email"]', { timeout: 20000 });
  await page.fill('input[type="email"]', CHEF_EMAIL);
  await page.fill('input[type="password"]', PW);
  await page.locator("button", { hasText: /로그인$/ }).last().click();
  await page.waitForTimeout(4000);

  // 온보딩 dismiss
  for (let i = 0; i < 8; i++) {
    const next = page.locator("button", { hasText: /^다음$/ });
    const start = page.locator("button", { hasText: /시작하기/ });
    if (await next.count() > 0) { await next.click({ force: true }); await page.waitForTimeout(400); }
    else if (await start.count() > 0) { await start.click({ force: true }); await page.waitForTimeout(400); break; }
    else break;
  }

  await page.locator("button", { hasText: "내 거래" }).first().click({ force: true });
  await page.waitForTimeout(1500);

  // 디버그 정보
  const info = await page.evaluate(() => {
    const w = window.innerWidth;
    const svgs = [...document.querySelectorAll("svg")].filter(s => (s.style.cssText || "").includes("-118"));
    return {
      innerWidth: w,
      svgCount: svgs.length,
      svgStyles: svgs.map(s => s.style.cssText.substring(0, 120))
    };
  });

  console.log("window.innerWidth:", info.innerWidth);
  console.log("SVG with -118 count:", info.svgCount);
  info.svgStyles.forEach((s, i) => console.log(`  SVG[${i}]:`, s));

  await browser.close();
}
run().catch(e => { console.error(e.message); process.exit(1); });
