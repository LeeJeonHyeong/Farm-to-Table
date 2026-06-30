import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react()],
    server: {
      proxy: {
        "/api/gemini": {
          target: "https://generativelanguage.googleapis.com",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/gemini/, "/v1beta"),
          configure: (proxy) => {
            proxy.on("proxyReq", (proxyReq) => {
              const sep = proxyReq.path.includes("?") ? "&" : "?";
              proxyReq.path = proxyReq.path + sep + `key=${env.GEMINI_API_KEY || ""}`;
            });
          },
        },
      },
    },
  };
});
