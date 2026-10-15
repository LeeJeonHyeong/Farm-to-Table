import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react()],
    server: {
      proxy: {
        "/api/groq": {
          target: "https://api.groq.com",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/groq/, ""),
          configure: (proxy) => {
            proxy.on("proxyReq", (proxyReq) => {
              proxyReq.setHeader("Authorization", `Bearer ${env.GROQ_API_KEY || ""}`);
            });
          },
        },
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            "vendor-react": ["react", "react-dom"],
            // firebase/firestore 는 여기 넣지 않는다. 넣으면 동적 import 를 해도
            // 이 청크에 묶여 첫 진입에 같이 내려간다. 로그인 화면에는 필요 없으므로
            // 별도 async 청크로 떨어뜨린다 (src/firebase.js 의 loadFirestore).
            "vendor-firebase": [
              "firebase/app",
              "firebase/auth",
            ],
          },
        },
      },
      chunkSizeWarningLimit: 800,
    },
  };
});
