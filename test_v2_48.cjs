/**
 * test_v2_48.cjs — v2.48 HIGH 항목 검증
 * H-1: Vite manualChunks, 로딩 화면 브랜딩
 * H-2: 시연 딜 데이터 강화 (d_match 배송중, d_done 완납/리뷰, 오픈딜 제안 추가)
 * H-3: 에러 화면 브랜드 UI, ErrorBoundary 개선
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
  console.log("\n=== v2.48 HIGH 항목 테스트 ===\n");

  // ── [1~4] 정적 코드 검증 ──────────────────────────────────────────────
  const src = fs.readFileSync("src/App.jsx", "utf8");
  const vite = fs.readFileSync("vite.config.js", "utf8");

  // H-1: vite manualChunks
  vite.includes("manualChunks") ? ok("[1] vite.config.js manualChunks 설정") : fail("[1] vite.config.js manualChunks 없음");
  vite.includes("vendor-react") ? ok("[2] vendor-react 청크 분리") : fail("[2] vendor-react 청크 없음");
  vite.includes("vendor-firebase") ? ok("[3] vendor-firebase 청크 분리") : fail("[3] vendor-firebase 청크 없음");

  // H-1: 로딩 화면 브랜딩
  (src.includes("Farm to Table") && src.includes("ftt-load-pulse")) ? ok("[4] 로딩 화면 브랜드 텍스트·애니메이션") : fail("[4] 로딩 화면 브랜딩 누락");

  // H-2: d_match 배송중 데이터
  (src.includes('"d_match"') && src.includes("deliveryStatus: \"shipped\"") && src.includes("courierName") && src.includes("trackingNumber"))
    ? ok("[5] d_match 배송중 필드 (shipped/courier/tracking)") : fail("[5] d_match 배송중 필드 누락");

  // H-2: d_done 완납·리뷰
  (src.includes("balancePaidAt") && src.includes("chefRating") && src.includes("chefReview"))
    ? ok("[6] d_done 완납·상호리뷰 필드") : fail("[6] d_done 완납·리뷰 필드 누락");

  // H-2: d_done 배송 정보
  (src.includes('"d_done"') && src.includes("shippedAt") && src.includes("한진택배"))
    ? ok("[7] d_done 배송 완료 정보") : fail("[7] d_done 배송 정보 누락");

  // H-2: d1 오픈딜 제안 추가
  (src.includes('"pd1_1"') && src.includes('"pd1_2"'))
    ? ok("[8] d1(토마토) 경쟁 입찰 제안 2건") : fail("[8] d1 제안 누락");

  // H-2: d4 오픈딜 제안 추가
  src.includes('"pd4_1"') ? ok("[9] d4(로메인) 제안 1건") : fail("[9] d4 제안 누락");

  // H-3: 에러 화면 개선
  (src.includes("navigator.onLine") && src.includes("인터넷 연결 없음"))
    ? ok("[10] 에러 화면 오프라인 감지") : fail("[10] 오프라인 감지 누락");

  // H-3: ErrorBoundary 개선
  (src.includes("예기치 않은 오류") && src.includes("Fraunces") && src.includes("5B7553"))
    ? ok("[11] ErrorBoundary 브랜드 UI") : fail("[11] ErrorBoundary 브랜드 UI 누락");

  // ── [12] 브라우저 UI 검증 ─────────────────────────────────────────────
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForTimeout(3000);

    // 앱이 로드되어 로그인 화면 또는 메인 화면이 보이는지 확인
    const bodyText = await page.locator("body").innerText();
    (bodyText.length > 0) ? ok("[12] 앱 정상 로드") : fail("[12] 앱 로드 실패");
  } catch (e) {
    fail("[12] 브라우저 오류", e.message.slice(0, 60));
  } finally {
    if (browser) await browser.close();
  }

  console.log(`\n결과: ${passed}/${passed + failed} 통과\n`);
  if (failed > 0) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });
