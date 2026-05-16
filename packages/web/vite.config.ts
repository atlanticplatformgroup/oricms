import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Determine API URL based on environment
// In Docker: use container name (oricms-api)
// Outside Docker: use localhost
const isDocker = process.env.DOCKER_ENV === 'true' || process.env.VITE_API_URL?.includes('oricms-api');
const API_TARGET = isDocker 
  ? 'http://oricms-api:3001' 
  : (process.env.VITE_API_URL || 'http://localhost:3001');

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@ori/shared': path.resolve(__dirname, '../shared/src/index.ts'),
      '../../../../shared': path.resolve(__dirname, '../shared'),
      '../../../../../shared': path.resolve(__dirname, '../shared'),
    },
  },
  build: {
    chunkSizeWarningLimit: 750,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;

          if (
            id.includes('@tiptap/') ||
            id.includes('@mantine/tiptap') ||
            id.includes('@uiw/react-codemirror') ||
            id.includes('@codemirror/') ||
            id.includes('/prosemirror-') ||
            id.includes('/orderedmap/') ||
            id.includes('/rope-sequence/') ||
            id.includes('/w3c-keyname/') ||
            id.includes('/crelt/') ||
            id.includes('turndown') ||
            id.includes('marked')
          ) {
            return 'editor-vendor';
          }

          if (
            id.includes('lucide-react') ||
            id.includes('@heroicons/react')
          ) {
            return 'icons-vendor';
          }

          return 'vendor';
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: API_TARGET,
        changeOrigin: true,
      },
    },
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
  },
});
