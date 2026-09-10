import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",   // nunca recargar solo: puede haber un conteo abierto
      manifest: {
        name: "Mercado Viva — Inventario",
        short_name: "Inventario",
        start_url: "/",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#1b1f19"
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,woff2}"],
        navigateFallback: "/index.html"
      }
    })
  ],
  server: { port: 5173, proxy: { "/api": "http://localhost:3000" } }
});
