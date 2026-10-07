// 상호명으로 가입 이메일을 되찾아 준다. 전체 주소가 아니라 마스킹된 힌트만 돌려준다.
//
// 왜 서버가 필요한가: user-profile-{uid} 문서에는 이메일이 없고(이메일은 Firebase Auth 에만
// 있다), firestore.rules 는 storage 컬렉션의 목록 조회를 관리자로 제한한다. 게다가 이 기능을
// 쓰는 사람은 로그아웃 상태라 클라이언트에서는 조회 자체가 불가능하다. 규칙을 풀어 클라이언트에
// 맡기면 누구나 전 회원의 이메일을 긁어갈 수 있으므로 서버 자격증명으로만 연다.
//
// 왜 firebase-admin 을 안 쓰나: firebase-admin 14 는 jwks-rsa(CommonJS) → jose@6(ESM) 를
// 끌어오는데, Vercel 번들러가 동적 import 를 require() 로 바꿔 넣어 런타임에 터진다.
//   require() of ES Module .../jose/dist/webapi/index.js from .../jwks-rsa/src/...
// 서비스 계정 JWT 로 액세스 토큰을 받아 REST 를 직접 치면 의존성이 0이라 이 문제가 없고,
// 콜드 스타트도 훨씬 가볍다. Node 18+ 의 crypto 와 fetch 만 쓴다.
//
// 노출 범위: 상호명은 앱 안에서 이미 공개되는 정보다(딜·제안 목록에 그대로 보인다).
// 따라서 "그 상호명이 가입했는지"는 새로 새는 정보가 아니고, 이메일은 마스킹해서 내보낸다.

import { createSign } from "node:crypto";

const PREFIX = "user-profile-";
const MAX_SCAN = 3000;      // 사고로 거대 컬렉션을 긁지 않도록 상한
const MAX_HINTS = 3;        // 동명 업체가 여러 곳일 때 돌려줄 최대 개수
const WINDOW_MS = 60 * 1000;
const MAX_PER_WINDOW = 10;
const SCOPES = [
  "https://www.googleapis.com/auth/datastore",
  "https://www.googleapis.com/auth/identitytoolkit",
].join(" ");

const hits = new Map();
let tokenCache = null; // { token, exp }

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

function serviceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT 미설정");
  let sa;
  try {
    sa = JSON.parse(raw);
  } catch {
    throw new Error("FIREBASE_SERVICE_ACCOUNT 가 올바른 JSON 이 아닙니다");
  }
  if (!sa.client_email || !sa.private_key || !sa.project_id) {
    throw new Error("서비스 계정 JSON 에 client_email · private_key · project_id 가 필요합니다");
  }
  // 환경변수에 리터럴 \n 으로 들어온 경우를 복원한다
  sa.private_key = String(sa.private_key).replace(/\\n/g, "\n");
  return sa;
}

const b64u = (v) => Buffer.from(typeof v === "string" ? v : JSON.stringify(v)).toString("base64url");

async function accessToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  if (tokenCache && tokenCache.exp > now + 60) return tokenCache.token;

  const payload = `${b64u({ alg: "RS256", typ: "JWT" })}.${b64u({
    iss: sa.client_email,
    scope: SCOPES,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  })}`;
  const signer = createSign("RSA-SHA256");
  signer.update(payload);
  const assertion = `${payload}.${signer.sign(sa.private_key, "base64url")}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    throw new Error(`토큰 발급 실패 ${res.status} ${data.error ?? ""}`);
  }
  tokenCache = { token: data.access_token, exp: now + (data.expires_in ?? 3600) };
  return tokenCache.token;
}

// user-profile- 로 시작하는 문서만 범위 조회한다. '-'(0x2D) 다음 문자는 '.'(0x2E) 이므로
// [user-profile- , user-profile.) 범위가 접두어 전체를 정확히 덮는다.
async function fetchProfiles(sa, token) {
  const base = `projects/${sa.project_id}/databases/(default)/documents`;
  const ref = (suffix) => `${base}/storage/${suffix}`;
  const res = await fetch(`https://firestore.googleapis.com/v1/${base}:runQuery`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: "storage" }],
        where: {
          compositeFilter: {
            op: "AND",
            filters: [
              { fieldFilter: { field: { fieldPath: "__name__" }, op: "GREATER_THAN_OR_EQUAL", value: { referenceValue: ref(PREFIX) } } },
              { fieldFilter: { field: { fieldPath: "__name__" }, op: "LESS_THAN", value: { referenceValue: ref("user-profile.") } } },
            ],
          },
        },
        limit: MAX_SCAN,
      },
    }),
  });
  if (!res.ok) throw new Error(`Firestore 조회 실패 ${res.status} ${(await res.text()).slice(0, 160)}`);
  const rows = await res.json();
  return (Array.isArray(rows) ? rows : [])
    .filter((r) => r.document)
    .map((r) => ({
      uid: r.document.name.split("/").pop().slice(PREFIX.length),
      value: r.document.fields?.value?.stringValue ?? "",
    }));
}

async function lookupEmails(sa, token, uids) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/projects/${sa.project_id}/accounts:lookup`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ localId: uids }),
    }
  );
  if (!res.ok) throw new Error(`계정 조회 실패 ${res.status} ${(await res.text()).slice(0, 160)}`);
  const data = await res.json();
  return (data.users ?? []).map((u) => u.email).filter(Boolean);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
  if (!fromOwnOrigin(req)) return res.status(403).json({ error: "forbidden" });

  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
  if (rateLimited(ip)) return res.status(429).json({ error: "rate_limited" });

  const wanted = normalizeName(req.body?.name);
  if (!wanted || wanted.length < 2) return res.status(400).json({ error: "bad_request" });

  let sa;
  try {
    sa = serviceAccount();
  } catch (err) {
    console.error("서비스 계정 설정 오류:", err.message);
    return res.status(503).json({ error: "not_configured", reason: String(err.message).slice(0, 120) });
  }

  try {
    const token = await accessToken(sa);
    const profiles = await fetchProfiles(sa, token);

    const uids = [];
    for (const p of profiles) {
      if (uids.length >= MAX_HINTS) break;
      try {
        if (normalizeName(JSON.parse(p.value).displayName) === wanted) uids.push(p.uid);
      } catch {
        // 형식이 깨진 문서는 건너뛴다
      }
    }
    if (uids.length === 0) return res.status(200).json({ found: false, hints: [] });

    const hints = (await lookupEmails(sa, token, uids)).map(maskEmail).filter(Boolean);
    return res.status(200).json({ found: hints.length > 0, hints });
  } catch (err) {
    console.error("이메일 찾기 실패:", err);
    return res.status(500).json({ error: "lookup_failed", reason: String(err.message).slice(0, 160) });
  }
}
