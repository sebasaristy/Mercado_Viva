import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  // El .env vive en la raíz del repo, no dentro de apps/pwa.
  // Vite solo expone al navegador las variables que empiezan por VITE_.
  envDir: "../../",

  plugins: [
    react(),
    tailwind(),
    VitePWA({
      registerType: "prompt",   // nunca recargar solo: puede haber un conteo abierto
      manifest: {
        name: "Mercado Viva — Inventario",
        short_name: "Inventario",
        start_url: "/",
        display: "standalone",
        background_color: "#F7F7F4",
        theme_color: "#16190F"
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,woff2}"],
        navigateFallback: "/index.html"
      }
    })
  ],
  server: { port: 5173, proxy: { "/api": "http://localhost:3000" } }
});
