import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [
		react(),
		tailwindcss(),
		{
			name: "csp-header",
			configureServer(server) {
				server.middlewares.use((req, res, next) => {
					res.setHeader(
						"Content-Security-Policy",
						"default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://webapi.amap.com https://jsapi.amap.com https://jsapi-service.amap.com https://restapi.amap.com https://mapplugin.amap.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com https://cdn.tailwindcss.com; font-src 'self' data: https://fonts.gstatic.com https://fonts.googleapis.com; img-src 'self' data: blob: https://*.amap.com https://*.gaode.com http://*.music.126.net https://*.music.126.net https://picsum.photos https://*.googleusercontent.com; connect-src 'self' https://restapi.amap.com https://webapi.amap.com https://jsapi.amap.com https://jsapi-service.amap.com https://o4.amap.com https://mapplugin.amap.com https://jsapi-data1.amap.com https://jsapi-data2.amap.com https://jsapi-data3.amap.com https://jsapi-data4.amap.com https://jsapi-data5.amap.com https://*.music.126.net https://fonts.googleapis.com https://fonts.gstatic.com https://analysis.chatglm.cn https://gator.volces.com https://picsum.photos https://*.googleusercontent.com https://fonts.gstatic.com; worker-src 'self' blob:; media-src 'self' https://music.163.com https://*.music.163.com https://*.music.126.net;",
					);
					next();
				});
			},
		},
	],
	build: {
		target: "esnext",
		rollupOptions: {
			output: {
				manualChunks(id) {
					if (!id.includes("node_modules")) return;

					const pkgMatch = id.match(
						/node_modules[\/\\](@[^\/\\]+[\/\\][^\/\\]+|[^\/\\]+)/,
					);
					const pkg = pkgMatch ? pkgMatch[1] : "";

					if (
						pkg === "react" ||
						pkg === "react-dom" ||
						pkg === "scheduler" ||
						pkg === "react-router" ||
						pkg === "react-router-dom"
					) {
						return "react-core";
					}

					if (
						pkg === "react-markdown" ||
						pkg === "react-markdown-editor-lite" ||
						pkg === "markdown-it" ||
						pkg.startsWith("rehype-") ||
						pkg.startsWith("remark-")
					) {
						return "markdown-vendor";
					}

					if (
						pkg === "motion" ||
						pkg === "motion-dom" ||
						pkg === "motion-utils" ||
						pkg === "framer-motion"
					) {
						return "motion-vendor";
					}

					if (pkg === "lucide-react") return "icons-vendor";
					if (pkg === "@google/genai") return "ai-vendor";
					if (pkg === "date-fns") return "date-vendor";
					if (
						pkg === "exifreader" ||
						pkg === "react-image-crop" ||
						pkg === "spark-md5"
					)
						return "image-vendor";

					return "vendor-misc";
				},
			},
		},
	},
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "."),
		},
	},
	server: {
		hmr: process.env.DISABLE_HMR !== "true",
	},
});
