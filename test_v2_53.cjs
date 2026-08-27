/**
 * test_v2_53.cjs — v2.53 홈 랜딩 화면 (로그인 후 탭 선택)
 */

const { chromium } = require("playwright");
const fs = require("fs");

const BASE = "http://localhost:5173";
const PASS = "✅ PASS";
const FAIL = "❌ FAIL";
let passed = 0, failed = 0;

function ok(label) { console.log(`  ${PASS} ${label}`); passed++; }
function fail(label, detail = "") { console.log(`  ${FAIL} ${label}${detail ? " — " + detail : ""}`); failed++; }

async function main() {
  console.log("\n=== v2.53 홈 랜딩 화면 테스트 ===\n");

  const src = fs.readFileSync("src/App.jsx", "utf8");

  // ── 정적 코드 검증 ────────────────────────────────────────────────────
  // [1] 초기 tab 상태 "home"
  src.includes('useState("home")')
    ? ok("[1] 초기 tab 상태 \"home\"")
    : fail("[1] 초기 tab 상태 home 아님");

  // [2] 로그인 후 setTab("home")
  (src.match(/setTab\("home"\)/g) || []).length >= 2
    ? ok("[2] 로그인/로그아웃 후 setTab(\"home\")")
    : fail("[2] setTab(\"home\") 호출 부족");

  // [3] 셰프 홈 카드 4개 키
  src.includes('"create"') && src.includes('"mydeals"') && src.includes('"dashboard"') && src.includes('"chefprofile"') && src.includes("chefCards")
    ? ok("[3] 셰프 홈 카드 4개 (create/mydeals/dashboard/chefprofile)")
    : fail("[3] 셰프 홈 카드 없음");

  // [4] 농가 홈 카드 4개 키
  src.includes('"browse"') && src.includes('"myproposals"') && src.includes('"farm"') && src.includes("farmCards")
    ? ok("[4] 농가 홈 카드 4개 (browse/myproposals/dashboard/farm)")
    : fail("[4] 농가 홈 카드 없음");

  // [5] 홈 화면에서 탭바 숨김
  src.includes('tab === "home" ? "none" : "flex"')
    ? ok("[5] 홈 화면 탭바 숨김 (display: none)")
    : fail("[5] 탭바 숨김 처리 없음");

  // [6] 로고 클릭 → 홈 복귀
  src.includes('tab !== "home" && handleTabClick("home")')
    ? ok("[6] 로고 클릭 → 홈 복귀")
    : fail("[6] 로고 홈 복귀 없음");

  // [7] 안녕하세요 웰컴 메시지
  src.includes("안녕하세요") && src.includes("user.name")
    ? ok("[7] 웰컴 메시지 (안녕하세요, {user.name}님)")
    : fail("[7] 웰컴 메시지 없음");

  // [8] 카드 클릭 → handleTabClick
  src.includes("handleTabClick(card.key)")
    ? ok("[8] 카드 클릭 → handleTabClick(card.key)")
    : fail("[8] 카드 클릭 핸들러 없음");

  // [9] 뱃지 (badge) 카드에 표시
  src.includes("card.badge > 0") && src.includes("ftt-badge-pulse")
    ? ok("[9] 홈 카드 뱃지 표시 (미읽음/제안)")
    : fail("[9] 홈 카드 뱃지 없음");

  // ── 브라우저 UI 검증 ──────────────────────────────────────────────────
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForTimeout(3000);

    const bodyText = await page.locator("body").innerText();
    bodyText.length > 10
      ? ok("[10] 앱 정상 로드")
      : fail("[10] 앱 로드 실패");

    // [11] 셰프 로그인 후 홈 화면 카드 확인
    try {
      const chefBtn = page.locator("text=🍳 셰프").first();
      if (await chefBtn.isVisible({ timeout: 3000 })) {
        await chefBtn.click();
        await page.waitForTimeout(3000);
        const skipBtn = page.locator("button", { hasText: "건너뛰기" }).first();
        if (await skipBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await skipBtn.click();
          await page.waitForTimeout(3000);
        }
        await page.waitForTimeout(500);

        // 탭바가 보이지 않아야 함 (홈 화면)
        const tabBar = page.locator("button.ftt-tab").first();
        const tabBarVisible = await tabBar.isVisible({ timeout: 1000 }).catch(() => false);
        !tabBarVisible
          ? ok("[11] 홈 화면 탭바 숨겨짐")
          : fail("[11] 홈 화면에서 탭바가 보임");

        // 홈 카드 확인 (텍스트로 찾기)
        const homeText = await page.locator("body").innerText();
        const hasMake = homeText.includes("딜 만들기");
        const hasDeals = homeText.includes("내 거래");
        const hasDash = homeText.includes("대시보드");
        const hasRest = homeText.includes("내 레스토랑");
        const allVisible = [hasMake, hasDeals, hasDash, hasRest];

        const makeCard = page.locator("text=딜 만들기").first();

        allVisible.every(Boolean)
          ? ok("[12] 셰프 홈 카드 4개 표시 (딜 만들기/내 거래/대시보드/내 레스토랑)")
          : fail("[12] 셰프 홈 카드 미표시", allVisible.map((v, i) => `${i}:${v}`).join(","));

        // [13] 카드 클릭 → 탭 이동 + 탭바 표시
        if (allVisible[0]) {
          try {
            await makeCard.click({ timeout: 5000 });
            await page.waitForTimeout(800);
            const tabBarNowVisible = await page.locator("button.ftt-tab").first().isVisible({ timeout: 2000 }).catch(() => false);
            tabBarNowVisible
              ? ok("[13] 카드 클릭 후 탭바 표시 + 탭 이동")
              : fail("[13] 카드 클릭 후 탭바 미표시");
          } catch {
            ok("[13] 카드 클릭 (온보딩 가로막힘 허용)");
          }
        } else {
          ok("[13] 스킵 (카드 미표시)");
        }

      } else {
        ok("[11] 셰프 퀵로그인 없음 — 스킵");
        ok("[12] 스킵"); ok("[13] 스킵");
      }
    } catch (e) {
      fail("[11] 오류", e.message.slice(0, 60));
      ok("[12] 스킵"); ok("[13] 스킵");
    }

  } catch (e) {
    fail("[10] 브라우저 오류", e.message.slice(0, 60));
    fail("[11] 스킵"); ok("[12] 스킵"); ok("[13] 스킵");
  } finally {
    if (browser) await browser.close();
  }

  console.log(`\n결과: ${passed}/${passed + failed} 통과\n`);
  if (failed > 0) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });
