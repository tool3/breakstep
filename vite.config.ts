/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  css: {
    modules: {
      // Keep the source file and local name in the generated class. Vite's
      // production default is an opaque hash, which makes both DevTools and the
      // end-to-end selectors in `scripts/smoke.mjs` guesswork.
      generateScopedName: '[name]__[local]___[hash:base64:5]',
    },
    preprocessorOptions: {
      scss: {
        api: 'modern-compiler',
        additionalData: `@use "@/styles/abstracts" as *;\n`,
      },
    },
  },
  build: {
    target: 'es2022',
    // Monaco is ~3 MB before gzip and that is simply its size. It is lazily
    // loaded behind a Suspense boundary, so it never blocks first paint.
    chunkSizeWarningLimit: 3500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('monaco-editor')) return 'monaco';
          if (id.includes('/antd/') || id.includes('@ant-design')) return 'antd';
          if (id.includes('/react-dom/') || id.includes('/react/')) return 'react';
          return undefined;
        },
      },
    },
  },
  worker: {
    format: 'es',
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**'],
    },
  },
});
