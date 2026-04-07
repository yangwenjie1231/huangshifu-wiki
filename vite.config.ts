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
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;

          // Extract the npm package name from the resolved path.
          // Handles both scoped (@scope/pkg) and regular (pkg) packages.
          const pkgMatch = id.match(/node_modules[\/\\](@[^\/\\]+[\/\\][^\/\\]+|[^\/\\]+)/);
          const pkg = pkgMatch ? pkgMatch[1] : '';

          // React core + scheduler (avoids circular deps)
          if (pkg === 'react' || pkg === 'react-dom' || pkg === 'scheduler'
            || pkg === 'react-router' || pkg === 'react-router-dom') {
            return 'react-core';
          }

          // Markdown / editor — heavy, only Wiki & Forum
          if (pkg === 'react-markdown' || pkg === 'react-markdown-editor-lite'
            || pkg === 'markdown-it' || pkg.startsWith('rehype-') || pkg.startsWith('remark-')) {
            return 'markdown-vendor';
          }

          // Motion / animation (motion v12 split into multiple packages)
          if (pkg === 'motion' || pkg === 'motion-dom' || pkg === 'motion-utils'
            || pkg === 'framer-motion') {
            return 'motion-vendor';
          }

          // Icons
          if (pkg === 'lucide-react') return 'icons-vendor';

          // Google GenAI — large, only Wiki AI features
          if (pkg === '@google/genai') return 'ai-vendor';

          // Date utilities
          if (pkg === 'date-fns') return 'date-vendor';

          // Image processing
          if (pkg === 'exifreader' || pkg === 'react-image-crop' || pkg === 'spark-md5') {
            return 'image-vendor';
          }

          // Remaining small utilities (clsx, tailwind-merge, etc.)
          return 'vendor-misc';
        },
      },
    },
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
