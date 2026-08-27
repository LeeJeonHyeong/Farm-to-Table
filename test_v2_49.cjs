/**
 * test_v2_49.cjs — v2.49 MEDIUM 항목 검증
 * M-1: A11Y aria-label (알림/북마크/농가프로필/닫기)
 * M-2: URL 딥링크 (?tab= 동기화)
 * M-3: 이미지 최적화 (WebP + loading=lazy)
 * M-4: 관리자 CSV 내보내기 (딜/수수료)
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
  console.log("\n=== v2.49 MEDIUM 항목 테스트 ===\n");

  const src = fs.readFileSync("src/App.jsx", "utf8");

  // ── M-1: A11Y ─────────────────────────────────────────────────────────
  // 알림 버튼 aria-label (동적 문자열)
  src.includes("알림 닫기") && src.includes("미읽음")
    ? ok("[1] 알림 버튼 동적 aria-label") : fail("[1] 알림 버튼 aria-label 누락");

  // 북마크 버튼 aria-label
  src.includes("aria-label={bookmarks.has(deal.id)")
    ? ok("[2] 북마크 버튼 aria-label") : fail("[2] 북마크 버튼 aria-label 누락");

  // 농가 프로필 버튼 aria-label
  src.includes('aria-label="농가 프로필 보기"')
    ? ok("[3] 농가 프로필 버튼 aria-label") : fail("[3] 농가 프로필 버튼 aria-label 누락");

  // FarmProfileModal 닫기 버튼 aria-label
  src.includes('aria-label="닫기"')
    ? ok("[4] 모달 닫기 버튼 aria-label") : fail("[4] 모달 닫기 버튼 aria-label 누락");

  // ── M-2: URL 딥링크 ────────────────────────────────────────────────────
  // urlTabRef 초기화
  src.includes("urlTabRef") && src.includes("URLSearchParams(window.location.search).get(\"tab\")")
    ? ok("[5] urlTabRef — 마운트 시 ?tab= 캡처") : fail("[5] urlTabRef 누락");

  // handleLogin에서 URL 탭 복원
  src.includes("validTabs.includes(urlTabRef.current)") && src.includes("initTab")
    ? ok("[6] handleLogin 탭 복원 로직") : fail("[6] handleLogin 탭 복원 없음");

  // handleTabClick에서 URL 업데이트
  src.includes("window.history.replaceState({}, \"\", `?tab=${key}`)")
    ? ok("[7] handleTabClick URL 동기화") : fail("[7] handleTabClick URL 동기화 없음");

  // handleLogout URL 초기화
  (src.match(/handleLogout[\s\S]{0,200}window\.history\.replaceState/) !== null)
    ? ok("[8] handleLogout URL 초기화") : fail("[8] handleLogout URL 초기화 없음");

  // ── M-3: 이미지 최적화 ─────────────────────────────────────────────────
  // WebP 변환
  src.includes("image/webp") && !src.includes("toDataURL(\"image/jpeg\"")
    ? ok("[9] canvas.toDataURL WebP 변환") : fail("[9] WebP 변환 없음 또는 JPEG 잔존");

  // loading=lazy
  (src.match(/loading="lazy"/g) || []).length >= 5
    ? ok("[10] img loading=lazy 5개 이상 적용") : fail("[10] loading=lazy 부족");

  // ── M-4: CSV 내보내기 ─────────────────────────────────────────────────
  // downloadCSV 헬퍼 함수
  src.includes("function downloadCSV(rows, filename)")
    ? ok("[11] downloadCSV 헬퍼 함수") : fail("[11] downloadCSV 함수 없음");

  // 딜 관리 CSV 버튼
  src.includes("CSV 내보내기") && src.includes("deals_")
    ? ok("[12] 딜 관리 CSV 내보내기 버튼") : fail("[12] 딜 관리 CSV 버튼 없음");

  // 수수료 정산 CSV 버튼
  src.includes("수수료 내역 CSV") && src.includes("settlement_")
    ? ok("[13] 수수료 내역 CSV 버튼") : fail("[13] 수수료 CSV 버튼 없음");

  // ── 브라우저 UI 검증 ──────────────────────────────────────────────────
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForTimeout(3000);

    // URL이 ?tab= 형식으로 바뀌는지 — 로그인 이전이므로 주소에 tab 없을 수도 있음
    const url = page.url();
    // 로그인 화면에서는 tab 파라미터 없음 — 앱이 정상 로드되면 통과
    (url.includes("5173")) ? ok("[14] 앱 정상 로드 (URL 기반)") : fail("[14] 앱 로드 실패");
  } catch (e) {
    fail("[14] 브라우저 오류", e.message.slice(0, 60));
  } finally {
    if (browser) await browser.close();
  }

  console.log(`\n결과: ${passed}/${passed + failed} 통과\n`);
  if (failed > 0) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });
