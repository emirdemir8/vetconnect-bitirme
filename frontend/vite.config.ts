import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      // API istekleri aynı sunucu üzerinden backend'e yönlendirilir (bağlantı hatası önlenir)
      "/auth": { target: "http://127.0.0.1:8000", changeOrigin: true },
      "/pets": { target: "http://127.0.0.1:8000", changeOrigin: true },
      "/appointments": { target: "http://127.0.0.1:8000", changeOrigin: true },
      "/vaccine-types": { target: "http://127.0.0.1:8000", changeOrigin: true },
      "/cases": { target: "http://127.0.0.1:8000", changeOrigin: true },
      "/stats": { target: "http://127.0.0.1:8000", changeOrigin: true },
      "/vet": { target: "http://127.0.0.1:8000", changeOrigin: true },
      "/symptom-reports": { target: "http://127.0.0.1:8000", changeOrigin: true },
      "/health": { target: "http://127.0.0.1:8000", changeOrigin: true },
    },
  },
});
