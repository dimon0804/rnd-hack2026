import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

const proxyTarget =
  process.env.DEV_PROXY_TARGET ?? "http://127.0.0.1:8000";

/** Доп. хосты для dev (туннели CloudPub и т.п.): `VITE_DEV_ALLOWED_HOSTS=a.ru,b.ru` */
const extraAllowedHosts = process.env.VITE_DEV_ALLOWED_HOSTS
  ? process.env.VITE_DEV_ALLOWED_HOSTS.split(/[\s,]+/).map((h) => h.trim()).filter(Boolean)
  : [];

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: null,
      includeAssets: ["icon.svg"],
      manifest: {
        name: "AI platform",
        short_name: "AI platform",
        description:
          "Вопросы к вашим материалам. Офлайн доступна змейка после первого визита.",
        theme_color: "#124238",
        background_color: "#f3efe6",
        display: "standalone",
        scope: "/",
        start_url: "/",
        lang: "ru",
        icons: [
          {
            src: "/icon.svg",
            sizes: "512x512",
            type: "image/svg+xml",
            purpose: "any",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2,webmanifest}"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-stylesheets",
              expiration: {
                maxEntries: 8,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-webfonts",
              expiration: {
                maxEntries: 16,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  optimizeDeps: {
    include: ["pptxgenjs"],
  },
  server: {
    port: 3000,
    host: true,
    allowedHosts: [
      "localhost",
      "127.0.0.1",
      "fearfully-momentous-basilisk.cloudpub.ru",
      "rnd-hack.clv-digital.tech",
      ...extraAllowedHosts,
    ],
    proxy: {
      "/api": {
        target: proxyTarget,
        changeOrigin: true,
      },
    },
  },
});
