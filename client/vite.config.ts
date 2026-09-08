import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      // 将前端请求代理到后端服务，与 CRA 的 package.json proxy 等价
      '/api': 'http://127.0.0.1:5000',
    },
  },
  build: {
    // 保持与后端静态服务/部署脚本一致的输出目录
    outDir: 'build',
  },
});
