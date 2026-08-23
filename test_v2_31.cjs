/**
 * test_v2_31.cjs
 * v2.31 보안 수정 — XSS 방어 + window.open noopener
 *
 * [1]  printReceipt — esc() HTML escape 함수 코드 존재
 * [2]  printReceipt — proposal.farmName을 esc() 처리 후 사용
 * [3]  printReceipt — deal.chefName을 esc() 처리 후 사용
 * [4]  printReceipt — deal.crop을 esc() 처리 후 사용
 * [5]  printReceipt — deal.grade를 esc() 처리 후 사용
 * [6]  printReceipt — HTML 템플릿에 원본 proposal.farmName 직접 삽입 없음
 * [7]  window.open 발송 사진 — noopener,noreferrer 포함
 * [8]  window.open 채팅 이미지 — noopener,noreferrer 포함
 * [9]  App.jsx 전체에서 "_blank" 단독 사용(noopener 없이) 패턴 없음
 * [10] 브라우저: 셰프 로그인 → 내 거래 탭 정상 진입 (보안 수정 후 앱 무결성)
 */

const { chromium } = require("playwright");
const fs = require("fs");

const BASE = "http://localhost:5173";
const APP_JSX = "c:/Users/USER/Desktop/D.N.A/farm-to-table-project/farm-to-table-project/src/App.jsx";
const TS = Date.now();

const CHEF_EMAIL = `v231chef_${TS}@test.com`;
const PW = "testpass123";
const CHEF_NAME = `v231셰프${TS % 10000}`;

let passed = 0;
let failed = 0;
const results = [];

function assert(condition, label) {
  if (condition) {
    console.log(`  ✅ [PASS] ${label}`);
    passed++;
    results.push({ label, ok: true });
  } else {
    console.log(`  ❌ [FAIL] ${label}`);
    failed++;
    results.push({ label, ok: false });
  }
}

async function dismissOverlays(page) {
  for (let i = 0; i < 8; i++) {
    const next  = page.locator("button", { hasText: /^다음$/ });
    const start = page.locator("button", { hasText: /시작하기/ });
    if (await next.count() > 0)       { await next.click({ force: true }); await page.waitForTimeout(400); }
    else if (await start.count() > 0) { await start.click({ force: true }); await page.waitForTimeout(400); break; }
    else break;
  }
}

async function signup(page, email, pw, role, name) {
  await page.goto(BASE);
  await page.waitForSelector('input[type="email"]', { timeout: 12000 });
  const toSignup = page.locator("button", { hasText: /가입/ }).first();
  if (await toSignup.count() > 0) await toSignup.click();
  await page.waitForTimeout(400);
  const roleBtn = page.locator("button", { hasText: role === "chef" ? "셰프" : "농가" }).first();
  if (await roleBtn.count() > 0) await roleBtn.click();
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', pw);
  const ph = role === "chef" ? "예: 테이블나인" : "예: 신선팜";
  const nameInput = page.locator(`input[placeholder="${ph}"]`).first();
  if (await nameInput.count() > 0) await nameInput.fill(name);
  await page.locator("button", { hasText: /가입하기$/ }).last().click();
  await page.waitForTimeout(3000);
  if (await page.locator('button[class*="ftt-tab"]').count() === 0) {
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', pw);
    await page.locator("button", { hasText: /로그인$/ }).last().click();
    await page.waitForTimeout(3000);
  }
  await dismissOverlays(page);
}

async function goToTab(page, label) {
  const btn = page.locator("button", { hasText: label });
  if (await btn.count() > 0) { await btn.first().click({ force: true }); await page.waitForTimeout(1200); }
}

async function run() {
  console.log("\n====================================================");
  console.log("v2.31 보안 수정 — XSS 방어 + noopener (10개)");
  console.log("====================================================\n");

  const code = fs.readFileSync(APP_JSX, "utf8");

  // ── [1~9] 정적 코드 검증 ──
  console.log("── [1~9] 정적 코드 검증 ──\n");

  assert(
    code.includes("replace(/&/g") && code.includes("&amp;") && code.includes("&lt;") && code.includes("&gt;"),
    "[1] v2.31 — esc() HTML escape 함수 코드 존재"
  );

  assert(
    code.includes("esc(proposal.farmName)"),
    "[2] v2.31 — proposal.farmName → esc() 처리"
  );

  assert(
    code.includes("esc(deal.chefName)"),
    "[3] v2.31 — deal.chefName → esc() 처리"
  );

  assert(
    code.includes("esc(deal.crop)"),
    "[4] v2.31 — deal.crop → esc() 처리"
  );

  assert(
    code.includes("esc(deal.grade)"),
    "[5] v2.31 — deal.grade → esc() 처리"
  );

  // HTML 템플릿에 원본 proposal.farmName이 직접 삽입되지 않는지 확인
  // (esc된 변수 farmName을 쓰므로 템플릿에 proposal.farmName이 없어야 함)
  const printReceiptStart = code.indexOf("const printReceipt");
  const printReceiptEnd = code.indexOf("};", printReceiptStart) + 2;
  const printReceiptCode = code.slice(printReceiptStart, printReceiptEnd);
  assert(
    !printReceiptCode.includes("${proposal.farmName}") && !printReceiptCode.includes("${deal.chefName}"),
    "[6] v2.31 — HTML 템플릿에 원본 proposal.farmName / deal.chefName 직접 삽입 없음"
  );

  assert(
    code.includes('window.open(deal.shippedPhotoURL, "_blank", "noopener,noreferrer")'),
    "[7] v2.31 — 발송 사진 window.open noopener,noreferrer 포함"
  );

  assert(
    code.includes('window.open(m.imageURL, "_blank", "noopener,noreferrer")'),
    "[8] v2.31 — 채팅 이미지 window.open noopener,noreferrer 포함"
  );

  // "_blank" 단독(noopener 없이) 패턴 검사
  // window.open("", "_blank") — 자기 도메인 빈 창은 제외 (printReceipt, handlePrint)
  // 외부 URL을 여는 "_blank" 단독 패턴만 검출
  const externalBlankPattern = /window\.open\([^"']+(?:URL|Url|url|Src|src|href|Photo)[^)]*,\s*["']_blank["']\s*\)/g;
  const externalBlankMatches = code.match(externalBlankPattern) || [];
  assert(
    externalBlankMatches.length === 0,
    `[9] v2.31 — 외부 URL window.open "_blank" noopener 없는 패턴 없음 (${externalBlankMatches.length}건)`
  );

  // ── [10] 브라우저 UI 테스트 ──
  console.log("\n── [10] 브라우저 UI 테스트 ──\n");

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  await signup(page, CHEF_EMAIL, PW, "chef", CHEF_NAME);
  await goToTab(page, "내 거래");

  const bodyText = await page.locator("body").innerText();
  assert(
    bodyText.length > 0 && !bodyText.includes("오류") && page.url().includes("localhost"),
    "[10] v2.31 — 보안 수정 후 앱 정상 구동 (내 거래 탭 진입 성공)"
  );

  await ctx.close();
  await browser.close();

  // ── 결과 요약 ──
  console.log("\n====================================================");
  console.log(`결과: ${passed} / ${passed + failed} 통과`);
  console.log("====================================================\n");

  if (failed > 0) {
    console.log("실패 항목:");
    results.filter((r) => !r.ok).forEach((r) => console.log(`  ❌ ${r.label}`));
    console.log("");
  }

  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error("테스트 실행 오류:", err);
  process.exit(1);
});
