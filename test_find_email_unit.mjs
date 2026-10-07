/**
 * 이메일 찾기 — 순수 로직 단위 테스트 (Firebase 자격증명 불필요)
 *   node test_find_email_unit.mjs
 */
import { normalizeName, maskEmail } from "./api/account/find-email.js";

let pass = 0, fail = 0;
const eq = (name, got, want) => {
  const ok = got === want;
  ok ? pass++ : fail++;
  console.log(`  ${ok ? "✅" : "❌"} ${name}` + (ok ? "" : `\n       기대 ${JSON.stringify(want)} / 실제 ${JSON.stringify(got)}`));
};

console.log("\n▶ normalizeName — 공백·대소문자만 무시, 부분 일치는 허용하지 않음");
eq("앞뒤 공백 제거", normalizeName("  테이블나인  "), "테이블나인");
eq("연속 공백 단일화", normalizeName("테이블  나인"), "테이블 나인");
eq("대소문자 무시", normalizeName("Table NINE"), "table nine");
eq("탭·줄바꿈도 공백 취급", normalizeName("테이블\t나인\n"), "테이블 나인");
eq("null 안전", normalizeName(null), "");
eq("undefined 안전", normalizeName(undefined), "");
eq("서로 다른 이름은 구분됨", normalizeName("테이블나인") === normalizeName("테이블나인쓰"), false);

console.log("\n▶ maskEmail — 앞 2글자만 남김");
eq("일반 주소", maskEmail("chefkim@naver.com"), "ch*****@naver.com");
eq("짧은 로컬부", maskEmail("ab@gmail.com"), "ab***@gmail.com");
eq("한 글자 로컬부", maskEmail("a@gmail.com"), "a***@gmail.com");
eq("점 포함 로컬부", maskEmail("hong.gildong@daum.net"), "ho**********@daum.net");
eq("서브도메인 유지", maskEmail("admin@mail.nonghyup.com"), "ad***@mail.nonghyup.com");
eq("@ 없는 입력", maskEmail("notanemail"), "");
eq("빈 문자열", maskEmail(""), "");
eq("null 안전", maskEmail(null), "");

console.log("\n▶ 마스킹이 원본을 복원할 수 없는지");
const src = "chefkim@naver.com";
const masked = maskEmail(src);
eq("로컬부 전체가 드러나지 않음", masked.includes("chefkim"), false);
eq("도메인은 그대로 (주소 떠올리는 데 필요)", masked.endsWith("@naver.com"), true);
eq("길이로 원본 추정 불가 — 최소 3개 마스킹", maskEmail("ab@x.com").split("@")[0], "ab***");

console.log(`\n${"=".repeat(56)}\n결과 ${pass}/${pass + fail} 통과`);
process.exit(fail === 0 ? 0 : 1);
