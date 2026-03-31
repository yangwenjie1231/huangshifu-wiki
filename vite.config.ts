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
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://webapi.amap.com https://jsapi.amap.com https://jsapi-service.amap.com https://restapi.amap.com https://mapplugin.amap.com; connect-src 'self' https://restapi.amap.com https://webapi.amap.com https://jsapi.amap.com https://o4.amap.com https://mapplugin.amap.com https://jsapi-data1.amap.com https://jsapi-data2.amap.com https://jsapi-data3.amap.com https://jsapi-data4.amap.com https://jsapi-data5.amap.com; worker-src 'self' blob:; img-src 'self' data: blob: https://*.amap.com https://*.gaode.com http://*.music.126.net https://*.music.126.net https://picsum.photos; style-src 'self' 'unsafe-inline';"
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
