/**
 * 채팅/제안 데이터 점검 (읽기 전용)
 *
 * participants 필드 도입 전에 기존 데이터가 어떤 상태인지 확인한다.
 * 목적: 마이그레이션으로 참여자를 복원할 수 있는 문서가 몇 건인지 파악.
 */
const { loadEnvLocal } = require("./load_env.cjs");
const { initializeApp } = require("firebase/app");
const { getAuth, signInWithEmailAndPassword } = require("firebase/auth");
const { getFirestore, collection, getDocs } = require("firebase/firestore");

loadEnvLocal();

async function main() {
  const app = initializeApp({
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    appId: process.env.VITE_FIREBASE_APP_ID,
  });
  const auth = getAuth(app);
  const db = getFirestore(app);

  await signInWithEmailAndPassword(
    auth,
    process.env.VITE_DEMO_CHEF_EMAIL,
    process.env.VITE_DEMO_CHEF_PW
  );

  const dealsSnap = await getDocs(collection(db, "deals"));
  const deals = new Map();
  dealsSnap.forEach((d) => deals.set(d.id, d.data()));

  const chatsSnap = await getDocs(collection(db, "chats"));

  let total = 0, hasParticipants = 0, chefResolvable = 0, farmResolvable = 0, both = 0;
  let emptyMessages = 0, orphanDeal = 0;
  let totalProposals = 0, proposalsWithUid = 0;

  for (const [, deal] of deals) {
    for (const p of deal.proposals || []) {
      totalProposals++;
      if (p.farmUid) proposalsWithUid++;
    }
  }

  chatsSnap.forEach((c) => {
    total++;
    const data = c.data();
    if (Array.isArray(data.participants)) hasParticipants++;
    if (!(data.messages || []).length) emptyMessages++;

    const [dealId, proposalId] = c.id.split("__");
    const deal = deals.get(dealId);
    if (!deal) { orphanDeal++; return; }

    const chefOk = !!deal.createdBy;
    const proposal = (deal.proposals || []).find((p) => p.id === proposalId);
    const farmOk = !!proposal?.farmUid;
    if (chefOk) chefResolvable++;
    if (farmOk) farmResolvable++;
    if (chefOk && farmOk) both++;
  });

  console.log("\n=== participants 없는 채팅 상세 ===");
  chatsSnap.forEach((c) => {
    const data = c.data();
    if (Array.isArray(data.participants)) return;
    const [dealId, proposalId] = c.id.split("__");
    const deal = deals.get(dealId);
    const proposal = (deal?.proposals || []).find((p) => p.id === proposalId);
    console.log(`chatId       : ${c.id}`);
    console.log(`  메시지 수  : ${(data.messages || []).length}`);
    console.log(`  보낸사람들 : ${[...new Set((data.messages || []).map((m) => `${m.senderName}(${m.senderRole})`))].join(", ")}`);
    console.log(`  딜         : ${deal ? `${deal.crop} / chefName=${deal.chefName}` : "없음"}`);
    console.log(`  셰프 uid   : ${deal?.createdBy || "없음"}`);
    console.log(`  제안       : ${proposal ? `farmerName=${proposal.farmerName}, farmName=${proposal.farmName}` : "없음"}`);
    console.log(`  농가 uid   : ${proposal?.farmUid || "없음"}`);
  });

  console.log("\n=== deals / proposals ===");
  console.log(`딜 문서            : ${deals.size}`);
  console.log(`제안 총계          : ${totalProposals}`);
  console.log(`  farmUid 보유     : ${proposalsWithUid}`);

  console.log("\n=== chats ===");
  console.log(`채팅 문서          : ${total}`);
  console.log(`  participants 보유: ${hasParticipants}`);
  console.log(`  메시지 없음      : ${emptyMessages}`);
  console.log(`  딜 없음(고아)    : ${orphanDeal}`);
  console.log(`  셰프 uid 복원가능: ${chefResolvable}`);
  console.log(`  농가 uid 복원가능: ${farmResolvable}`);
  console.log(`  양쪽 복원가능    : ${both}`);
  console.log("");
  process.exit(0);
}

main().catch((e) => { console.error("오류:", e.code || e.message); process.exit(1); });
