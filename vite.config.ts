/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts', 'src/**/__tests__/**/*.test.tsx'],
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8888',
        changeOrigin: true,
      },
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react/jsx-runtime'],
    // Monaco ships its own AMD-style bundle and pre-bundling explodes both
    // dev startup and the cache size; let `@monaco-editor/react` lazy-load it.
    exclude: ['monaco-editor'],
  },
  build: {
    target: 'esnext',
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Split node_modules into vendor chunks
          if (id.includes('node_modules')) {
            // Monaco is ~3-4 MB; keep it isolated so the rest of `vendor`
            // stays small and Monaco only loads when CodeEditor/CodeViewer
            // are first rendered (they are React.lazy-loaded).
            if (id.includes('monaco-editor') || id.includes('@monaco-editor')) {
              return 'vendor-monaco';
            }
            if (id.includes('react-dom')) {
              return 'vendor-react-dom';
            }
            if (id.includes('react/') || id.includes('react\\')) {
              return 'vendor-react';
            }
            if (id.includes('recharts')) {
              return 'vendor-recharts';
            }
            if (id.includes('date-fns') || id.includes('react-day-picker')) {
              return 'vendor-dates';
            }
            if (id.includes('embla-carousel')) {
              return 'vendor-embla';
            }
            if (id.includes('vaul')) {
              return 'vendor-vaul';
            }
            if (id.includes('input-otp')) {
              return 'vendor-input-otp';
            }
            if (id.includes('react-hook-form') || id.includes('zod') || id.includes('@hookform')) {
              return 'vendor-forms';
            }
            if (id.includes('@radix-ui')) {
              return 'vendor-radix';
            }
            if (id.includes('lodash')) {
              return 'vendor-lodash';
            }
            return 'vendor';
          }

          // Split framework and react packages into separate chunk
          if (id.includes('@cyberfabric/framework') || id.includes('@cyberfabric/react')) {
            return 'frontx-core';
          }
        },
      },
    },
    chunkSizeWarningLimit: 500,
  },
});
