/**
 * 데모 계정 비밀번호 교체
 *
 * 기존 비밀번호가 저장소 커밋 이력에 남아 있어 파일 수정만으로는 무효화되지 않는다.
 * 기존 비밀번호를 알고 있으므로 클라이언트 SDK로 로그인한 뒤 updatePassword를 호출한다.
 * 서비스 계정 키가 필요하지 않다.
 *
 * 실행: node rotate_demo_password.cjs
 * 결과: 새 비밀번호를 출력하고 .env.local의 VITE_DEMO_*_PW 두 줄을 갱신한다.
 */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { loadEnvLocal } = require("./load_env.cjs");
const { initializeApp } = require("firebase/app");
const {
  getAuth, signInWithEmailAndPassword, updatePassword, signOut,
} = require("firebase/auth");

loadEnvLocal();

const ENV_FILE = path.join(__dirname, ".env.local");

// 혼동되는 글자(l, I, 1, O, 0)는 제외한다.
function genPassword(len = 20) {
  const chars = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%^&*-_";
  const buf = crypto.randomBytes(len * 2);
  let out = "";
  for (let i = 0; i < len; i++) out += chars[buf[i] % chars.length];
  return out;
}

function updateEnvLocal(updates) {
  const lines = fs.readFileSync(ENV_FILE, "utf8").split(/\r?\n/);
  const pending = { ...updates };
  const out = lines.map((line) => {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=/);
    if (m && pending[m[1]] !== undefined) {
      const value = pending[m[1]];
      delete pending[m[1]];
      return `${m[1]}=${value}`;
    }
    return line;
  });
  for (const [k, v] of Object.entries(pending)) out.push(`${k}=${v}`);
  fs.writeFileSync(ENV_FILE, out.join("\n"), "utf8");
}

async function rotate(auth, label, email, oldPw, newPw) {
  const cred = await signInWithEmailAndPassword(auth, email, oldPw);
  await updatePassword(cred.user, newPw);
  await signOut(auth);
  console.log(`  ✅ ${label} (${email})`);
}

async function main() {
  const required = [
    "VITE_FIREBASE_API_KEY", "VITE_FIREBASE_AUTH_DOMAIN", "VITE_FIREBASE_PROJECT_ID",
    "VITE_FIREBASE_APP_ID", "VITE_DEMO_CHEF_EMAIL", "VITE_DEMO_CHEF_PW",
    "VITE_DEMO_FARM_EMAIL", "VITE_DEMO_FARM_PW",
  ];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    console.error("`.env.local`에 다음 항목이 없습니다:\n  " + missing.join("\n  "));
    process.exit(1);
  }

  const app = initializeApp({
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    appId: process.env.VITE_FIREBASE_APP_ID,
  });
  const auth = getAuth(app);

  const newChefPw = genPassword();
  const newFarmPw = genPassword();

  // .env.local 쓰기가 실패해도 복구할 수 있도록 먼저 출력한다.
  console.log("\n새 비밀번호 (협업자에게 안전한 경로로 전달하세요):");
  console.log("============================================");
  console.log(`VITE_DEMO_CHEF_PW=${newChefPw}`);
  console.log(`VITE_DEMO_FARM_PW=${newFarmPw}`);
  console.log("============================================\n");

  console.log("Firebase 비밀번호 교체 중...");
  try {
    await rotate(auth, "셰프 데모", process.env.VITE_DEMO_CHEF_EMAIL, process.env.VITE_DEMO_CHEF_PW, newChefPw);
    await rotate(auth, "농가 데모", process.env.VITE_DEMO_FARM_EMAIL, process.env.VITE_DEMO_FARM_PW, newFarmPw);
  } catch (err) {
    console.error(`\n교체 실패 (${err.code || err.message}).`);
    if (String(err.code).includes("wrong-password") || String(err.code).includes("invalid-credential")) {
      console.error(".env.local의 기존 비밀번호가 실제와 다릅니다. 이미 교체됐을 수 있습니다.");
    }
    process.exit(1);
  }

  updateEnvLocal({ VITE_DEMO_CHEF_PW: newChefPw, VITE_DEMO_FARM_PW: newFarmPw });
  console.log("\n✅ .env.local 갱신 완료. dev 서버를 재시작하면 퀵로그인에 새 비밀번호가 적용됩니다.");
  process.exit(0);
}

main().catch((err) => { console.error("오류:", err); process.exit(1); });
