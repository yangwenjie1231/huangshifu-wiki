import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'csp-header',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          res.setHeader(
            'Content-Security-Policy',
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://webapi.amap.com; connect-src 'self' https://restapi.amap.com https://webapi.amap.com; img-src 'self' data: blob: https://*.amap.com https://*.gaode.com http://p1.music.126.net http://p2.music.126.net http://p3.music.126.net https://picsum.photos; style-src 'self' 'unsafe-inline';"
          );
          next();
        });
      },
    },
  ],
  build: {
    target: 'esnext',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  server: {
    hmr: process.env.DISABLE_HMR !== 'true',
  },
});
