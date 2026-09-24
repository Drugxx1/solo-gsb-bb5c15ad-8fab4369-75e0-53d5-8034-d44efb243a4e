import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // 开发时把 API 请求转发给后端（默认 8080，可用 BACKEND_PORT 覆盖）
      '/api': `http://localhost:${process.env.BACKEND_PORT || 8080}`,
    },
  },
});
