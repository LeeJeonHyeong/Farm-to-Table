/**
 * 목록에 없는 작목 지원 테스트
 *   1) AI 자동입력이 목록 밖 작목을 엉뚱한 품목으로 바꾸지 않는지
 *   2) 직접 입력으로 딜을 끝까지 등록할 수 있는지
 *   3) 내 품목 목록에 추가되고 새로고침 후에도 남는지
 *   BASE=http://localhost:5173 node test_custom_crop.cjs
 */
const { chromium } = require("playwright");

const BASE = process.env.BASE || "http://localhost:5173";
const TS = Date.now();
const EMAIL = `crop_${TS}@test.com`;
const PW = "testpass123";
const NAME = `작목테스트${TS % 10000}`;
const NEW_CROP = "아스파라거스";

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`  ${ok ? "✅" : "❌"} ${name}${detail ? "  — " + detail : ""}`);
};

// 홈 랜딩에서는 탭 바가 display:none 이라 보이는 카드를 먼저 눌러야 한다.
async function goToTab(page, label) {
  const card = page.locator("button.ftt-card", { hasText: label }).first();
  if (await card.count() && await card.isVisible().catch(() => false)) {
    await card.click({ force: true });
  } else {
    await page.locator("button.ftt-tab", { hasText: label }).first().click({ force: true });
  }
  await page.waitForTimeout(1500);
}

async function dismissOverlays(page) {
  for (let i = 0; i < 8; i++) {
    const n = page.locator("button", { hasText: /^다음$/ });
    const s = page.locator("button", { hasText: /시작하기/ });
    if (await n.count()) { await n.click({ force: true }); await page.waitForTimeout(300); }
    else if (await s.count()) { await s.click({ force: true }); await page.waitForTimeout(300); break; }
    else break;
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();

  console.log("\n▶ 1. 셰프 가입");
  await page.goto(BASE);
  await page.waitForSelector('input[type="email"]', { timeout: 30000 });
  const su = page.locator("button", { hasText: /가입/ }).first();
  if (await su.count()) await su.click();
  await page.waitForTimeout(400);
  const rb = page.locator("button", { hasText: "셰프" }).first();
  if (await rb.count()) await rb.click();
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PW);
  const ni = page.locator('input[placeholder="예: 테이블나인"]').first();
  if (await ni.count()) await ni.fill(NAME);
  for (const cb of await page.locator('input[type="checkbox"]').all()) await cb.check().catch(() => {});
  await page.locator("button", { hasText: /가입하기$/ }).last().click();
  await page.waitForTimeout(6000);
  await dismissOverlays(page);
  await page.waitForSelector("button.ftt-card, button.ftt-tab", { state: "attached", timeout: 20000 });
  check("가입·진입", true);

  console.log("\n▶ 2. 딜 만들기 — 목록 밖 작목으로 AI 자동입력");
  await goToTab(page, "딜 만들기");
  const cropSelect = page.locator("select").first();
  const before = await cropSelect.inputValue();

  await page.locator("textarea").first()
    .fill(`${NEW_CROP} 3kg 다음주 화요일까지 납품받고 싶어요. 특등급으로 부탁드려요.`);
  await page.locator("button", { hasText: "AI로 자동 입력" }).first().click();
  await page.waitForFunction(
    () => [...document.querySelectorAll("button")].some((b) => b.textContent.includes("AI로 자동 입력")),
    { timeout: 40000 }).catch(() => {});
  await page.waitForTimeout(1500);

  const body = await page.locator("body").innerText();
  const cropInput = page.locator('input[placeholder="예: 아스파라거스"]');
  const typed = (await cropInput.count()) ? await cropInput.inputValue() : "";
  check("목록 밖 작목이 그대로 들어감", typed === NEW_CROP, `품목="${typed}"`);
  check("엉뚱한 표준 품목으로 바뀌지 않음", typed !== before, `이전 기본값="${before}"`);
  check("목록에 없다는 안내 노출", /목록에 없는 작목/.test(body));
  check("'내 품목 목록에 추가' 버튼 노출",
        await page.locator("button", { hasText: "내 품목 목록에 추가" }).count() > 0);

  console.log("\n▶ 3. 숙성도 기본값 (2단계)");
  const addr0 = page.locator('input[placeholder="주소 찾기 또는 직접 입력"]').first();
  if (await addr0.count()) await addr0.fill("서울시 강남구 테헤란로 1");
  await page.locator("button", { hasText: "다음 단계" }).first().click({ force: true });
  await page.waitForTimeout(1200);
  const selects = page.locator("select");
  let ripeOk = false, ripeVal = "";
  for (let i = 0; i < await selects.count(); i++) {
    const v = await selects.nth(i).inputValue();
    if (["미숙", "중간", "완숙"].includes(v)) { ripeOk = true; ripeVal = v; break; }
  }
  check("목록 밖 작목도 숙성도 기본값 적용", ripeOk, `숙성도="${ripeVal}"`);
  const back = page.locator("button", { hasText: /이전/ }).first();
  if (await back.count()) { await back.click({ force: true }); await page.waitForTimeout(900); }

  console.log("\n▶ 4. 내 품목 목록에 추가");
  await page.locator("button", { hasText: "내 품목 목록에 추가" }).click();
  await page.waitForTimeout(2500);
  const opts = await page.locator("select").first().locator("option").allTextContents();
  check("select 목록에 추가됨", opts.includes(NEW_CROP), `옵션 ${opts.length}개`);
  check("추가 토스트 노출", /품목 목록에 추가했습니다/.test(await page.locator("body").innerText()));

  console.log("\n▶ 5. 새로고침 후에도 유지 (Firestore 저장 확인)");
  await page.reload();
  await page.waitForTimeout(7000);
  await dismissOverlays(page);
  await goToTab(page, "딜 만들기");
  const opts2 = await page.locator("select").first().locator("option").allTextContents();
  check("새로고침 후 목록 유지", opts2.includes(NEW_CROP));

  console.log("\n▶ 6. 목록 밖 작목으로 딜 등록 완주");
  await page.locator("select").first().selectOption({ label: NEW_CROP }).catch(() => {});
  await page.waitForTimeout(500);
  // 단계별 필수값: 1 주소 / 2 크기 조건 / 3 수량 / 4 납품일·희망단가
  const fillIfEmpty = async (sel, val) => {
    const el = page.locator(sel).first();
    if (await el.count() && !(await el.inputValue().catch(() => "x"))) await el.fill(val);
  };
  for (let step = 0; step < 6; step++) {
    await fillIfEmpty('input[placeholder="주소 찾기 또는 직접 입력"]', "서울시 강남구 테헤란로 1");
    await fillIfEmpty('input[placeholder="예: 지름 5cm 이상"]', "지름 2cm 이상");
    await fillIfEmpty('input[placeholder="예: 100"]', "3");
    await fillIfEmpty('input[placeholder="예: 23000"]', "30000");
    await fillIfEmpty('input[type="date"]', "2026-12-01");
    const nx = page.locator("button", { hasText: "다음 단계" }).first();
    if (await nx.count() === 0) break;
    await nx.click({ force: true });
    await page.waitForTimeout(900);
  }
  const submit = page.locator("button", { hasText: /딜 등록하고 농가 제안 받기/ });
  check("마지막 단계 도달", await submit.count() > 0);
  if (await submit.count()) {
    await submit.click();
    await page.waitForTimeout(5000);
    const after = await page.locator("body").innerText();
    check("딜 등록 성공", after.includes(NEW_CROP), NEW_CROP + " 표시 여부");
  }

  await page.screenshot({ path: "C:/Users/USER/AppData/Local/Temp/custom_crop.png", fullPage: true });
  const pass = results.filter((r) => r.ok).length;
  console.log(`\n${"=".repeat(60)}\n결과 ${pass}/${results.length} 통과`);
  for (const r of results.filter((r) => !r.ok)) console.log(`  실패: ${r.name} ${r.detail}`);
  await browser.close();
  process.exit(pass === results.length ? 0 : 1);
})().catch((e) => { console.error("오류:", e.message); process.exit(1); });
