// Groq 프록시. 서버의 GROQ_API_KEY로 호출하므로, 이 핸들러가 통과시키는 요청은
// 전부 계정 요금으로 청구된다. 따라서 경로·메서드·모델·크기를 모두 고정한다.
//
// 한계: 이 엔드포인트는 여전히 인증되지 않는다. 아래 출처 검사는 다른 사이트에서의
// 브라우저 경유 호출과 단순 스크래핑을 막을 뿐, 헤더를 위조하는 직접 호출은 막지 못한다.
// 실제 차단에는 Firebase ID 토큰 검증이 필요하다.

const ALLOWED_PATH = "openai/v1/chat/completions";
const ALLOWED_MODELS = new Set(["qwen/qwen3.8-27b"]);
const MAX_BODY_BYTES = 16 * 1024;
const MAX_TOKENS_CAP = 1024;
const WINDOW_MS = 60 * 1000;
const MAX_PER_WINDOW = 20;

// 인스턴스 로컬 카운터다. 서버리스에서는 콜드 스타트와 다중 인스턴스로 초기화되므로
// 총량 보장이 아니라 단일 출처의 순간 폭주를 눌러주는 정도로만 동작한다.
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

// 최신 브라우저는 모든 fetch에 Sec-Fetch-Site를 보낸다. 둘 다 없으면 브라우저 요청이
// 아니라고 보고 거부한다. 앱 호출부는 실패 시 규칙 기반 폴백으로 degrade한다.
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

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
  if (!process.env.GROQ_API_KEY) return res.status(503).json({ error: "not_configured" });

  const segments = Array.isArray(req.query.path) ? req.query.path : [req.query.path];
  if (segments.join("/") !== ALLOWED_PATH) return res.status(404).json({ error: "not_found" });

  if (!fromOwnOrigin(req)) return res.status(403).json({ error: "forbidden" });

  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
  if (rateLimited(ip)) return res.status(429).json({ error: "rate_limited" });

  const body = req.body;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return res.status(400).json({ error: "bad_request" });
  }
  if (!ALLOWED_MODELS.has(body.model)) return res.status(400).json({ error: "model_not_allowed" });
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return res.status(400).json({ error: "bad_request" });
  }

  const forwarded = JSON.stringify({
    ...body,
    max_tokens: Math.min(Number(body.max_tokens) || 256, MAX_TOKENS_CAP),
  });
  if (forwarded.length > MAX_BODY_BYTES) return res.status(413).json({ error: "payload_too_large" });

  try {
    const upstream = await fetch(`https://api.groq.com/${ALLOWED_PATH}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: forwarded,
    });
    if (!upstream.ok) {
      // 업스트림 오류 본문에는 계정·키 관련 정보가 담길 수 있어 그대로 전달하지 않는다.
      return res.status(upstream.status === 429 ? 429 : 502).json({ error: "upstream_error" });
    }
    return res.status(200).json(await upstream.json());
  } catch {
    return res.status(502).json({ error: "upstream_unreachable" });
  }
}
