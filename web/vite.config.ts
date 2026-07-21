import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base 使用相對路徑 './'，同時支援：
//   1. GitHub Pages 專案站台（https://<user>.github.io/<repo>/）
//   2. 本機 vite preview 與直接開啟檔案
// 搭配 HashRouter，重新整理不會 404。
export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        // 將較大的第三方套件切成獨立 chunk，改善瀏覽器快取
        manualChunks: {
          echarts: ['echarts', 'echarts-for-react'],
          react: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
});
