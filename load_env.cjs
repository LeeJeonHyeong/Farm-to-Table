// Node 스크립트는 Vite와 달리 .env.local을 자동으로 읽지 않는다.
// 데모 자격증명을 저장소에 하드코딩하지 않기 위해 여기서 읽어 process.env에 채운다.
const fs = require("fs");
const path = require("path");

function loadEnvLocal() {
  const file = path.join(__dirname, ".env.local");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].trim();
  }
}

// 셸에 export 돼 있으면 그쪽이 우선한다.
function demoCreds() {
  loadEnvLocal();
  const creds = {
    chefEmail: process.env.VITE_DEMO_CHEF_EMAIL,
    chefPw: process.env.VITE_DEMO_CHEF_PW,
    farmEmail: process.env.VITE_DEMO_FARM_EMAIL,
    farmPw: process.env.VITE_DEMO_FARM_PW,
  };
  const missing = Object.entries(creds).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length > 0) {
    console.error(
      "데모 자격증명이 없습니다: " + missing.join(", ") + "\n" +
      ".env.local에 아래 4개를 채운 뒤 다시 실행하세요:\n" +
      "  VITE_DEMO_CHEF_EMAIL / VITE_DEMO_CHEF_PW\n" +
      "  VITE_DEMO_FARM_EMAIL / VITE_DEMO_FARM_PW"
    );
    process.exit(1);
  }
  return creds;
}

module.exports = { loadEnvLocal, demoCreds };
