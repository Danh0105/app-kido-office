import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { VitePWA } from 'vite-plugin-pwa'
export default defineConfig(({ mode }) => ({
  // ❌ bỏ root
  // root: "./src",

  base: "./",

  plugins: [
    react(),

    VitePWA({
      registerType: 'autoUpdate',

      includeAssets: [
        'favicon.ico',
        'apple-touch-icon.png',
      ],
      workbox: {
        maximumFileSizeToCacheInBytes:
          5 * 1024 * 1024,
      },
      manifest: {
        name: 'Sales App',
        short_name: 'Sales',

        description: 'Sales Management',

        theme_color: '#ffffff',
        background_color: '#ffffff',

        display: 'standalone',

        start_url: '/',

        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },

  build: {
    // `--mode development` (build:dev) build ra thư mục riêng "dist-dev" —
    // không ghi đè "dist" của bản production, để giám đốc test bản dev song
    // song mà không ảnh hưởng bản đang chạy thật.
    outDir: mode === "production" ? "dist" : "dist-dev",
    emptyOutDir: true,
    rollupOptions: {
      input: "index.html",
    },
  },
}));