// 상호명으로 가입 이메일을 되찾아 준다. 전체 주소가 아니라 마스킹된 힌트만 돌려준다.
//
// 왜 서버가 필요한가: user-profile-{uid} 문서에는 이메일이 없고(이메일은 Firebase Auth 에만
// 있다), firestore.rules 는 storage 컬렉션의 목록 조회를 관리자로 제한한다. 게다가 이 기능을
// 쓰는 사람은 로그아웃 상태라 클라이언트에서는 조회 자체가 불가능하다. 규칙을 풀어 클라이언트에
// 맡기면 누구나 전 회원의 이메일을 긁어갈 수 있으므로, Admin SDK 를 쓰는 이 경로로만 연다.
//
// 노출 범위: 상호명은 앱 안에서 이미 공개되는 정보다(딜·제안 목록에 그대로 보인다).
// 따라서 "그 상호명이 가입했는지"는 새로 새는 정보가 아니고, 이메일은 마스킹해서 내보낸다.

import { cert, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const PREFIX = "user-profile-";
const MAX_SCAN = 5000;      // 사고로 거대 컬렉션을 긁지 않도록 상한
const MAX_HINTS = 3;        // 동명 업체가 여러 곳일 때 돌려줄 최대 개수
const WINDOW_MS = 60 * 1000;
const MAX_PER_WINDOW = 10;

const hits = new Map();

function rateLimited(ip) {
  const now = Date.now();
  if (hits.size > 500) {
    for (const [k, v] of hits) if (now - v.start > WINDOW_MS) hits.delete(k);
  }
  const rec = hits.get(ip);
  if (!rec || now - rec.start > WINDOW_MS) {
    hits.set(ip, { start: now, count: 1 });
    return false;
  }
  rec.count += 1;
  return rec.count > MAX_PER_WINDOW;
}

function fromOwnOrigin(req) {
  if (req.headers["sec-fetch-site"] === "same-origin") return true;
  const origin = req.headers.origin;
  if (!origin) return false;
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

// 공백 차이와 대소문자만 무시한다. 부분 일치를 허용하면 두세 글자로 회원 목록을
// 훑을 수 있으므로 정규화 후 완전 일치만 받는다.
export function normalizeName(s) {
  return String(s ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

// ab***@naver.com — 앞 2글자만 남긴다. 한 글자짜리는 그 한 글자만 남긴다.
export function maskEmail(email) {
  const at = String(email ?? "").lastIndexOf("@");
  if (at < 1) return "";
  const local = email.slice(0, at);
  const domain = email.slice(at);
  const keep = local.slice(0, Math.min(2, local.length));
  return `${keep}${"*".repeat(Math.max(3, local.length - keep.length))}${domain}`;
}

function admin() {
  if (getApps().length) return getApp();
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;
  let json;
  try {
    json = JSON.parse(raw);
  } catch {
    // 환경변수에 줄바꿈이 섞여 깨진 경우를 분리해서 알 수 있게 한다
    throw new Error("FIREBASE_SERVICE_ACCOUNT 가 올바른 JSON 이 아닙니다");
  }
  if (typeof json.private_key === "string") {
    json.private_key = json.private_key.replace(/\\n/g, "\n");
  }
  return initializeApp({ credential: cert(json) });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
  if (!fromOwnOrigin(req)) return res.status(403).json({ error: "forbidden" });

  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
  if (rateLimited(ip)) return res.status(429).json({ error: "rate_limited" });

  const wanted = normalizeName(req.body?.name);
  if (!wanted || wanted.length < 2) return res.status(400).json({ error: "bad_request" });

  let app;
  try {
    app = admin();
  } catch (err) {
    console.error("Admin SDK 초기화 실패:", err.message);
    return res.status(503).json({ error: "not_configured" });
  }
  if (!app) return res.status(503).json({ error: "not_configured" });

  try {
    const db = getFirestore(app);
    const snap = await db.collection("storage")
      .orderBy("__name__")
      .startAt(PREFIX)
      .endAt(PREFIX + "")
      .limit(MAX_SCAN)
      .get();

    const uids = [];
    snap.forEach((d) => {
      if (uids.length >= MAX_HINTS) return;
      try {
        const { displayName } = JSON.parse(d.get("value"));
        if (normalizeName(displayName) === wanted) uids.push(d.id.slice(PREFIX.length));
      } catch {
        // 형식이 깨진 문서는 건너뛴다
      }
    });

    if (uids.length === 0) return res.status(200).json({ found: false, hints: [] });

    const users = await getAuth(app).getUsers(uids.map((uid) => ({ uid })));
    const hints = users.users.map((u) => maskEmail(u.email)).filter(Boolean);
    return res.status(200).json({ found: hints.length > 0, hints });
  } catch (err) {
    console.error("이메일 찾기 실패:", err);
    return res.status(500).json({ error: "lookup_failed" });
  }
}
