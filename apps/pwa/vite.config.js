import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  // El .env vive en la raíz del repo, no dentro de apps/pwa.
  envDir: "../../",

  plugins: [
    react(),
    tailwind(),
    VitePWA({
      registerType: "prompt",   // nunca recargar solo: puede haber una venta a medias
      includeAssets: ["favicon.svg", "apple-touch-icon.png"],
      manifest: {
        id: "/",
        name: "Mercado Viva",
        short_name: "Mercado Viva",
        description: "Inventario, caja y tablero de la tienda. Sigue funcionando sin señal.",
        lang: "es-CO",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#F7F7F4",
        theme_color: "#16190F",
        // Los PNG salen de scripts/iconos.js. Android necesita 192 y 512;
        // el maskable trae margen porque cada marca lo recorta distinto.
        icons: [
          { src: "/icono-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icono-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/icono-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        navigateFallback: "/index.html",
        // /api nunca se responde con la app guardada: si no hay red, que falle
        // como falla, para que la operación vaya a la cola.
        navigateFallbackDenylist: [/^\/api\//]
      }
    })
  ],
  server: {
    port: 5173,
    // La API no tiene prefijo /api: se quita aquí. Sin el rewrite, cada
    // petición llegaba como /api/inventario/... y la API respondía 404.
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
        rewrite: (ruta) => ruta.slice("/api".length)
      }
    }
  }
});
