/**
 * 채팅 보안 규칙 검증 (Firestore 직접 호출)
 *
 * 브라우저 E2E는 정적 코드 확인 위주라 참여자 격리를 검증하지 못한다.
 * 여기서는 데모 계정 둘로 실제 읽기/쓰기를 시도해 규칙이 막는지 확인한다.
 *
 * 전제: .env.local 에 데모 셰프/농가 자격증명이 있어야 한다.
 */
const { loadEnvLocal } = require("./load_env.cjs");
const { initializeApp } = require("firebase/app");
const { getAuth, signInWithEmailAndPassword, signOut } = require("firebase/auth");
const {
  getFirestore, doc, setDoc, getDoc, getDocs, collection, query, where, arrayUnion,
} = require("firebase/firestore");

loadEnvLocal();

let passed = 0, failed = 0;
function assert(cond, label) {
  if (cond) { console.log(`  ✅ ${label}`); passed++; }
  else { console.log(`  ❌ ${label}`); failed++; }
}

// 재실행 시 문서가 쌓이지 않도록 고정 id를 쓴다.
const CHAT_ID = "ruletest__participants";

async function main() {
  const app = initializeApp({
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    appId: process.env.VITE_FIREBASE_APP_ID,
  });
  const auth = getAuth(app);
  const db = getFirestore(app);

  console.log("\n채팅 보안 규칙 검증\n" + "=".repeat(44));

  // ── 셰프로 로그인 ──
  const chef = await signInWithEmailAndPassword(
    auth, process.env.VITE_DEMO_CHEF_EMAIL, process.env.VITE_DEMO_CHEF_PW);
  const chefUid = chef.user.uid;

  // [1] 참여자로 자신을 넣어 생성 — 허용돼야 한다
  let ok = true;
  try {
    await setDoc(doc(db, "chats", CHAT_ID), {
      participants: arrayUnion(chefUid),
      messages: arrayUnion({ id: `m${Date.now()}`, senderName: "규칙테스트", senderRole: "chef", text: "ping", ts: Date.now() }),
    }, { merge: true });
  } catch { ok = false; }
  assert(ok, "[1] 참여자 본인이 포함된 채팅 생성/수정 허용");

  // [2] 참여자 본인은 읽을 수 있어야 한다
  ok = true;
  try { await getDoc(doc(db, "chats", CHAT_ID)); } catch { ok = false; }
  assert(ok, "[2] 참여자 본인 읽기 허용");

  // [3] 참여자 필터 쿼리에 본인 대화가 나와야 한다
  let foundOwn = false;
  try {
    const snap = await getDocs(query(collection(db, "chats"), where("participants", "array-contains", chefUid)));
    snap.forEach((d) => { if (d.id === CHAT_ID) foundOwn = true; });
  } catch { /* 쿼리 자체가 막히면 실패로 둔다 */ }
  assert(foundOwn, "[3] array-contains 쿼리로 본인 대화 조회 가능");

  // [4] 참여자 없이 생성 시도 — 거부돼야 한다
  let denied = false;
  try {
    await setDoc(doc(db, "chats", `ruletest__noparticipants`), { messages: [] });
  } catch { denied = true; }
  assert(denied, "[4] participants 없이 채팅 생성 거부");

  await signOut(auth);

  // ── 농가로 로그인 (대화 비참여자) ──
  const farm = await signInWithEmailAndPassword(
    auth, process.env.VITE_DEMO_FARM_EMAIL, process.env.VITE_DEMO_FARM_PW);
  const farmUid = farm.user.uid;

  // [5] 남의 대화 직접 읽기 — 거부돼야 한다
  denied = false;
  try { await getDoc(doc(db, "chats", CHAT_ID)); } catch { denied = true; }
  assert(denied, "[5] 비참여자의 남의 대화 읽기 거부");

  // [6] 남의 대화에 메시지 주입 — 거부돼야 한다
  denied = false;
  try {
    await setDoc(doc(db, "chats", CHAT_ID), {
      messages: arrayUnion({ id: `m${Date.now()}`, senderName: "침입자", senderRole: "farmer", text: "injected", ts: Date.now() }),
    }, { merge: true });
  } catch { denied = true; }
  assert(denied, "[6] 비참여자의 메시지 주입 거부");

  // [7] 자신을 참여자에 추가하며 끼어들기 — 거부돼야 한다
  denied = false;
  try {
    await setDoc(doc(db, "chats", CHAT_ID), { participants: arrayUnion(farmUid) }, { merge: true });
  } catch { denied = true; }
  assert(denied, "[7] 비참여자가 스스로 참여자 목록에 추가하는 것 거부");

  // [8] 비참여자의 필터 쿼리에는 남의 대화가 나오지 않아야 한다
  let leaked = false;
  try {
    const snap = await getDocs(query(collection(db, "chats"), where("participants", "array-contains", farmUid)));
    snap.forEach((d) => { if (d.id === CHAT_ID) leaked = true; });
  } catch { /* ignore */ }
  assert(!leaked, "[8] 비참여자 쿼리 결과에 남의 대화 없음");

  // [9] 컬렉션 전체 조회 — 규칙상 거부돼야 한다
  denied = false;
  try { await getDocs(collection(db, "chats")); } catch { denied = true; }
  assert(denied, "[9] 필터 없는 chats 컬렉션 전체 조회 거부");

  await signOut(auth);

  console.log("=".repeat(44));
  console.log(`결과: ${passed} / ${passed + failed} 통과\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { console.error("실행 오류:", e.code || e.message); process.exit(1); });
