// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    plugins: [
      ...VitePWA({
        registerType: "autoUpdate",
        injectRegister: false,
        outDir: ".output/public",
        includeAssets: ["favicon.ico", "stockbear-logo.png"],
        manifest: {
          name: "stockbear — Yapay Zeka Destekli Hisse Analizi",
          short_name: "stockbear",
          id: "/",
          description:
            "Yapay zeka gücüyle hisse analizi, piyasa özeti, portföy takibi ve AI önerileri.",
          categories: ["finance", "business"],
          theme_color: "#6d28d9",
          background_color: "#0f172a",
          display: "standalone",
          orientation: "portrait-primary",
          start_url: "/",
          icons: [
            {
              src: "/stockbear-logo.png",
              sizes: "192x192",
              type: "image/png",
            },
            {
              src: "/stockbear-logo.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any maskable",
            },
          ],
        },
        workbox: {
          globDirectory: ".output/public",
          inlineWorkboxRuntime: true,
          clientsClaim: true,
          skipWaiting: true,
          navigateFallback: null,
          globPatterns: [
            "**/*.{js,css,html,ico,png,svg,woff,woff2}",
          ],
          runtimeCaching: [
            {
              urlPattern: ({ request }) => request.mode === "navigate",
              handler: "NetworkOnly",
              options: { precacheFallback: { fallbackURL: "/offline.html" } },
            },
          ],
        },
      }).map(plugin => ({
        ...plugin,
        // SSR/Nitro must not rewrite a worker after its asset metadata is built.
        applyToEnvironment: (environment: { name: string }) => environment.name === "client",
      })),
    ],
  },
});
