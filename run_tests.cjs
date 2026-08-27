/**
 * run_tests.cjs — Farm-to-Table 전체 테스트 통합 러너
 * 사용법: node run_tests.cjs
 *        node run_tests.cjs --quick   (정적 코드 검증만, 브라우저 생략)
 *
 * 전제: npm run dev 가 localhost:5173 에서 실행 중이어야 합니다.
 */

const { execSync, spawn } = require("child_process");
const path = require("path");

const QUICK = process.argv.includes("--quick");

// 실행할 테스트 목록 (순서 유지)
const TESTS = [
  // ── 기능별 E2E ──
  { file: "test_v2_features.cjs",              label: "v2 기능 통합" },
  { file: "test_v2_ux_features.cjs",           label: "v2 UX 기능" },
  { file: "test_v2_bookmark.cjs",              label: "v2.20 관심딜 북마크" },
  { file: "test_v2_compare_inquiry.cjs",       label: "v2 비교/문의" },
  { file: "test_v2_ux2346.cjs",               label: "UX #2/#3/#4/#6" },
  { file: "test_v2_ux5_nextcycle_subscribe.cjs", label: "UX #5 자동연장/구독" },
  // ── 버전별 E2E ──
  { file: "test_v2_26_27.cjs",                label: "v2.26/27 농가이력/인증" },
  { file: "test_v2_28_29.cjs",                label: "v2.28/29 Toast/북마크Firestore" },
  { file: "test_v2_30.cjs",                   label: "v2.30 거래명세서" },
  { file: "test_v2_31.cjs",                   label: "v2.31 XSS 방어" },
  { file: "test_v2_32.cjs",                   label: "v2.32 알림dedup" },
  { file: "test_v2_33.cjs",                   label: "v2.33 setTimeout 제거" },
  { file: "test_v2_34.cjs",                   label: "v2.34 ScoreBreakdown" },
  { file: "test_v2_35.cjs",                   label: "v2.35 SEC/UX" },
  { file: "test_v2_36.cjs",                   label: "v2.36 DATA/STAB" },
  { file: "test_v2_37.cjs",                   label: "v2.37 DATA/STAB/PERF" },
  { file: "test_v2_38.cjs",                   label: "v2.38 SEC/A11Y" },
  { file: "test_v2_39.cjs",                   label: "v2.39 RACE/STAB" },
  { file: "test_v2_40.cjs",                   label: "v2.40 DATA/SEC" },
  { file: "test_v2_41.cjs",                   label: "v2.41 STAB/PERF" },
  { file: "test_v2_42.cjs",                   label: "v2.42 RACE/UX" },
  { file: "test_v2_43.cjs",                   label: "v2.43 발표 완성도 HIGH" },
  { file: "test_v2_44.cjs",                   label: "v2.44 Toast/채팅빈상태" },
  { file: "test_v2_45.cjs",                   label: "v2.45 HIGH (딜/이모지/퀵로그인)" },
  { file: "test_v2_46.cjs",                   label: "v2.46 MEDIUM (뱃지/페이드/NEW)" },
  { file: "test_v2_47.cjs",                   label: "v2.47 LOW (isNarrow/필터빈상태)" },
  { file: "test_v2_48.cjs",                   label: "v2.48 HIGH (빌드/로딩/샘플/에러)" },
  { file: "test_v2_49.cjs",                   label: "v2.49 MEDIUM (A11Y/URL/WebP/CSV)" },
  { file: "test_v2_50.cjs",                   label: "v2.50 채팅 인박스 드롭다운" },
  { file: "test_v2_51.cjs",                   label: "v2.51 역제안 알림+구별" },
  { file: "test_v2_52.cjs",                   label: "v2.52 딜찾기 정렬(AI/최신/오래된)" },
  // ── 발표 준비 ──
  { file: "test_h2_quicklogin.cjs",           label: "H-2 퀵로그인" },
  { file: "test_h3_farm_deals.cjs",           label: "H-3 농가 딜찾기" },
  { file: "test_m3_mobile.cjs",               label: "M-3 모바일 UI" },
];

const PAD = 34;
const results = [];

function runTest(file) {
  const start = Date.now();
  try {
    const args = QUICK ? ["--quick"] : [];
    execSync(`node ${file} ${args.join(" ")}`, {
      cwd: __dirname,
      timeout: 180000,
      stdio: "pipe",
    });
    return { ok: true, elapsed: Date.now() - start };
  } catch (e) {
    const output = (e.stdout || "").toString() + (e.stderr || "").toString();
    const match = output.match(/결과.*?(\d+)\s*\/\s*(\d+)/);
    return { ok: false, elapsed: Date.now() - start, detail: match ? `${match[1]}/${match[2]}` : "오류" };
  }
}

async function main() {
  console.log("\n" + "═".repeat(60));
  console.log("  Farm-to-Table 전체 테스트 러너" + (QUICK ? " [--quick]" : ""));
  console.log("  총 " + TESTS.length + "개 테스트 파일");
  console.log("═".repeat(60) + "\n");

  let passed = 0, failed = 0;

  for (const { file, label } of TESTS) {
    const prefix = `  ${label}`.padEnd(PAD);
    process.stdout.write(prefix + "실행 중...");
    const r = runTest(file);
    const status = r.ok ? "✅ PASS" : `❌ FAIL${r.detail ? " (" + r.detail + ")" : ""}`;
    const elapsed = (r.elapsed / 1000).toFixed(1) + "s";
    process.stdout.write("\r" + prefix + status + "  " + elapsed + "\n");
    results.push({ label, file, ...r });
    if (r.ok) passed++; else failed++;
  }

  console.log("\n" + "═".repeat(60));
  console.log(`  결과: ${passed} 통과 / ${failed} 실패 / ${TESTS.length} 전체`);
  console.log("═".repeat(60));

  if (failed > 0) {
    console.log("\n  실패 목록:");
    results.filter(r => !r.ok).forEach(r => console.log(`    ❌ ${r.label} (${r.file})`));
    console.log("");
    process.exit(1);
  } else {
    console.log("\n  모든 테스트 통과 ✅\n");
  }
}

main().catch(e => { console.error(e); process.exit(1); });
