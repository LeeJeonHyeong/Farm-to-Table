/**
 * Firebase Hosting 재현용 정적 서버.
 * firebase.json 의 catch-all rewrite("**" → /index.html)와 동일하게,
 * 실제 파일이 없는 경로는 메서드와 무관하게 index.html 을 200 text/html 로 돌려준다.
 * → /api/groq/... 요청이 HTML 을 받는 운영 환경의 버그 상황이 그대로 재현된다.
 */
const http = require("http");
const fs = require("fs");
const path = require("path");

const DIST = process.argv[2];
const PORT = Number(process.argv[3] || 4178);
const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg",
  ".svg": "image/svg+xml", ".ico": "image/x-icon", ".mp4": "video/mp4",
  ".webmanifest": "application/manifest+json", ".txt": "text/plain",
};

http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split("?")[0]);
  const file = path.join(DIST, urlPath);
  if (urlPath !== "/" && fs.existsSync(file) && fs.statSync(file).isFile()) {
    res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
    return;
  }
  if (urlPath.startsWith("/api/")) {
    console.log(`  [서버] ${req.method} ${urlPath} → index.html (200 text/html) ※ 버그 재현`);
  }
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  fs.createReadStream(path.join(DIST, "index.html")).pipe(res);
}).listen(PORT, () => console.log(`정적 서버(catch-all rewrite) http://localhost:${PORT}  dist=${DIST}`));
