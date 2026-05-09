import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig, type PluginOption } from "vite";
import { visualizer } from "rollup-plugin-visualizer";

export default defineConfig(({ mode }) => {
	const isAnalyze = process.env.ANALYZE === "true";

	return {
		plugins: [
			react(),
			tailwindcss(),
			isAnalyze &&
				visualizer({
					open: true,
					gzipSize: true,
					brotliSize: true,
					filename: "dist/stats.html",
				}) as PluginOption,
		].filter(Boolean),
		build: {
			target: "es2020",
			cssCodeSplit: true,
			chunkSizeWarningLimit: 500,
			minify: "terser",
			sourcemap: false,
			terserOptions: {
				compress: {
					drop_console: mode === "production",
					drop_debugger: mode === "production",
					pure_funcs: mode === "production" ? ["console.log", "console.info"] : [],
					reduce_vars: false,
					collapse_vars: false,
				},
				format: {
					comments: false,
					wrap_iife: true,
				},
				mangle: {
				},
			},
			rollupOptions: {
				onwarn(warning) {
					if (warning.code === 'CIRCULAR_DEPENDENCY') return;
					if (warning.message?.includes('Circular chunk')) return;
					console.warn(warning.message || warning);
				},
				output: {
					manualChunks(id) {
						if (id.includes("/src/pages/")) {
							if (id.includes("/pages/Admin")) return "page-admin";
							if (id.includes("/pages/Forum")) return "page-forum";
							if (id.includes("/pages/Music")) return "page-music";
							if (id.includes("/pages/Gallery")) return "page-gallery";
							if (id.includes("/pages/Search")) return "page-search";
							if (id.includes("GalleryDetail")) return "page-gallery-detail";
							if (id.includes("MusicDetail")) return "page-music-detail";
							if (id.includes("AlbumDetail")) return "page-album-detail";
							if (id.includes("MusicLinks")) return "page-music-links";
						}

						if (!id.includes("node_modules")) return;

						const pkgMatch = id.match(
							/node_modules[\/\\](@[^\/\\]+[\/\\][^\/\\]+|[^\/\\]+)/,
						);
						const pkg = pkgMatch ? pkgMatch[1] : "";

						if (!pkg) return;

						switch (pkg) {
							case "react":
							case "react-dom":
							case "scheduler":
							case "react-router":
							case "react-router-dom":
							case "@babel/runtime":
								return "react-core";

							case "express":
							case "compression":
							case "cookie-parser":
							case "helmet":
							case "cors":
							case "multer":
							case "express-rate-limit":
								return "express-vendor";

							case "@prisma/client":
								return "prisma-vendor";

							case "@uiw/react-md-editor":
							case "@uiw/react-markdown-preview":
							case "@uiw/md-editor":
							case "react-markdown":
							case "remark-gfm":
							case "rehype-highlight":
							case "remark-parse":
							case "remark-rehype":
							case "rehype-stringify":
							case "rehype-raw":
							case "unist-util-visit":
							case "unist-util-is":
							case "unist-util-position":
							case "unist-util-from-selectors":
							case "mdast-util-to-hast":
							case "hast-util-to-jsx-runtime":
							case "hast-util-whitespace":
							case "hastscript":
							case "property-information":
							case "comma-separated-tokens":
							case "space-separated-tokens":
							case "web-namespaces":
							case "character-entities":
							case "bail":
							case "extend":
							case "tslib":
							case "prismjs":
							case "prismjs-components":
								return "markdown-vendor";

							case "motion":
							case "motion-dom":
							case "motion-utils":
							case "motion-server":
							case "framesync":
								return "motion-vendor";

							case "framer-motion":
								return "framer-vendor";

							case "lucide-react":
							case "lucide":
								return "icons-vendor";

							case "@tanstack/react-virtual":
							case "@tanstack/virtual-core":
								return "virtual-vendor";

							case "echarts":
							case "zrender":
								return "echarts-vendor";

							case "vis-data":
							case "vis-network":
							case "vis-util":
							case "vis-configuration":
							case "vis-date-i18n":
							case "vis-timeline-graph2d":
								return "vis-vendor";

							case "@aws-sdk/client-s3":
							case "@aws-sdk/s3-request-presigner":
							case "@aws-sdk/smithy-client":
							case "@aws-sdk/middleware-stack":
							case "@aws-sdk/middleware-user-agent":
							case "@aws-sdk/middleware-retry":
							case "@aws-sdk/util-base64":
							case "@aws-sdk/util-body-length-browser":
							case "@aws-sdk/util-buffer-from":
							case "@aws-sdk/util-defaults-mode-browser":
							case "@aws-sdk/util-defaults-mode-node":
							case "@aws-sdk/util-endpoints":
							case "@aws-sdk/util-endpoints-v2":
							case "@aws-sdk/format-url":
							case "@aws-sdk/hash-node":
							case "@aws-sdk/invalid-dependency":
							case "@aws-sdk/is-array-buffer":
							case "@aws-sdk/middleware-content-length":
							case "@aws-sdk/middleware-host-header":
							case "@aws-sdk/middleware-logger":
							case "@aws-sdk/middleware-recursion-detection":
							case "@aws-sdk/middleware-signing":
							case "@aws-sdk/node-http-handler":
							case "@aws-sdk/protocol-http":
							case "@aws-sdk/querystring-builder":
							case "@aws-sdk/response-metadata-extractor":
							case "@aws-sdk/url-parser":
							case "@aws-sdk/util-base64-browser":
							case "@aws-sdk/util-create-request":
							case "@aws-sdk/util-dsm":
							case "@aws-sdk/util-format-url":
							case "@aws-sdk/util-hex-encoding":
							case "@aws-sdk/util-locate-window":
							case "@aws-sdk/util-middleware":
							case "@aws-sdk/util-retry":
							case "@aws-sdk/util-stream-browser":
							case "@aws-sdk/util-stream-node":
							case "@aws-sdk/util-uri-escape":
							case "@aws-sdk/util-utf8-browser":
							case "@aws-sdk/util-utf8-node":
							case "@aws-sdk/util-waiter":
							case "@aws-sdk/xml-builder":
							case "@aws-sdk/types":
							case "@smithy/smithy-client":
							case "@smithy/eventstream-codec":
							case "@smithy/eventstream-serde-config-provider":
							case "@smithy/eventstream-serde-universal":
							case "@smithy/protocol-http":
							case "@smithy/types":
							case "@smithy/util-base64":
							case "@smithy/util-body-length-browser":
							case "@smithy/util-buffer-from":
							case "@smithy/util-defaults-mode-browser":
							case "@smithy/util-endpoints":
							case "@smithy/util-endpoints-v2":
							case "@smithy/util-retry":
							case "@smithy/util-stream":
							case "@smithy/util-utf8":
							case "@smithy/middleware-retry":
							case "@smithy/middleware-stack":
							case "@aws-crypto":
							case "@aws-crypto/sha256-browser":
							case "@aws-crypto/sha256-js":
							case "@aws-crypto/supports-webcrypto":
							case "@aws-crypto/util":
							case "@aws-sdk/signature-v4":
							case "@aws-sdk/eventstream-codec":
							case "@aws-sdk/eventstream-serde-config-provider":
							case "@aws-sdk/eventstream-serde-universal":
							case "@aws-sdk/lib-storage":
							case "@aws-sdk/control-plane-client":
							case "@aws-sdk/credential-provider-cognito-identity":
							case "@aws-sdk/credential-provider-env":
							case "@aws-sdk/credential-provider-http":
							case "@aws-sdk/credential-provider-ini":
							case "@aws-sdk/credential-provider-process":
							case "@aws-sdk/credential-provider-sso":
							case "@aws-sdk/credential-provider-web-identity":
							case "@aws-sdk/token-providers":
							case "@aws-sdk/util-waiter":
								return "aws-vendor";

							case "@google/genai":
							case "@google/generative-ai":
								return "google-ai-vendor";

							case "@huggingface/transformers":
							case "@huggingface/jni":
								return "huggingface-vendor";

							case "@tensorflow/tfjs":
							case "@tensorflow/tfjs-backend-webgl":
							case "@tensorflow/tfjs-converter":
							case "@tensorflow/tfjs-core":
							case "@tensorflow/tfjs-data":
							case "@tensorflow/tfjs-layers":
							case "@tensorflow/tfjs-backend-cpu":
							case "@tensorflow/tfjs-backend-wasm":
							case "@tensorflow/tfjs-converter-webcodecs-worker":
							case "@tensorflow/tfjs-env":
							case "@tensorflow/tfjs-io":
							case "@tensorflow/tfjs-layers/dist":
							case "@tensorflow/tfjs-node":
							case "@tensorflow/tfjs-backend-common":
							case "@tensorflow/tfjs-dist":
							case "@tensorflow/tfjs-vis":
							case "long":
								return "tensorflow-vendor";

							case "@qdrant/js-client-rest":
								return "qdrant-vendor";

							case "date-fns":
								return "date-fns-vendor";

							case "exifreader":
								return "exif-vendor";

							case "react-image-crop":
								return "crop-vendor";

							case "spark-md5":
								return "hash-vendor";

							case "blurhash":
							case "react-blurhash":
								return "blurhash-vendor";

							case "axios":
								return "axios-vendor";

							case "cheerio":
							case "htmlparser2":
							case "domhandler":
							case "domutils":
							case "entities":
							case "domelementtype":
							case "parse5":
							case "css-selector-parser":
							case "css-what":
							case "nth-check":
							case "boolbase":
							case "dom-serializer":
							case "dom-serializer/lib":
								return "cheerio-vendor";

							case "clsx":
								return "clsx-vendor";

							case "tailwind-merge":
								return "tailwind-merge-vendor";

							case "zod":
								return "zod-vendor";

							case "jsonwebtoken":
							case "jws":
							case "buffer-alloc":
							case "buffer-from":
							case "safe-buffer":
							case "jwa":
							case "ecdsa-sig-formatter":
							case "base64url":
							case "lodash.isequal":
								return "jwt-vendor";

							case "bcryptjs":
							case "blakejs":
								return "bcrypt-vendor";

							case "dotenv":
							case "dotenv-expand":
								return "dotenv-vendor";

							case "node-cache":
								return "cache-vendor";

							case "@meting/core":
							case "@meting/utils":
							case "@meting/types":
							case "@meting/parser":
							case "@meting/provider":
								return "meting-vendor";

							case "adm-zip":
							case "archiver":
							case "zip-stream":
							case "compress-commons":
							case "crc32":
							case "crc32-stream":
							case "readable-stream":
							case "lodash":
							case "lodash-es":
								return "archive-vendor";

							case "@emnapi/runtime":
							case "@emnapi/core":
							case "@emnapi/api":
							case "@emnapi/wasi-threads":
							case "@node-rs/wasm-bindgen":
							case "@aspect-build/wasm-bindgen":
								return "emnapi-vendor";

							case "sharp":
							case "sharp/internal":
							case "@img/sharp-libvips-darwin-arm64":
							case "@img/sharp-libvips-darwin-x64":
							case "@img/sharp-libvips-linux-arm":
							case "@img/sharp-libvips-linux-arm64":
							case "@img/sharp-libvips-linux-x64":
							case "@img/sharp-libvips-win32-ia32":
							case "@img/sharp-libvips-win32-x64":
							case "@img/sharp-win32-x64":
							case "@img/sharp-linux-x64":
							case "@img/sharp-linux-arm64":
							case "@img/sharp-libvips-custom-linux-x64":
							case "color":
								return "sharp-vendor";

							case "iconv-lite":
							case "whatwg-url":
							case "tr46":
							case "punycode":
							case "data-uri-to-buffer":
							case "fetch-blob":
							case "formdata-polyfill":
							case "node-domexception":
							case "web-streams-polyfill":
							case "node-fetch":
							case "cross-fetch":
							case "undici":
								return "polyfill-vendor";

							default:
								if (pkg.startsWith("@aws-sdk/") || pkg.startsWith("@smithy/") || pkg.startsWith("@aws-crypto/")) {
									return "aws-vendor";
								}
								if (pkg.startsWith("@tensorflow/")) {
									return "tensorflow-vendor";
								}
								if (pkg.startsWith("@huggingface/")) {
									return "huggingface-vendor";
								}
								if (pkg.startsWith("@emnapi/")) {
									return "emnapi-vendor";
								}
								if (pkg.startsWith("@img/")) {
									return "sharp-vendor";
								}
								if (pkg.startsWith("sharp-")) {
									return "sharp-vendor";
								}

								return `misc-${pkg.replace(/[@\/]/g, '_')}`;
						}
					},
					entryFileNames: `assets/v4-[name]-[hash].js`,
					chunkFileNames: `assets/v4-[name]-[hash].js`,
					assetFileNames: (assetInfo) => {
						const info = assetInfo.name || "";
						if (/\.(png|jpe?g|gif|svg|webp|ico)$/i.test(info)) {
							return "assets/images/[name]-[hash][extname]";
						}
						if (/\.(woff2?|ttf|otf|eot)$/i.test(info)) {
							return "assets/fonts/[name]-[hash][extname]";
						}
						if (/\.css$/i.test(info)) {
							return "assets/css/[name]-[hash][extname]";
						}
						return "assets/[name]-[hash][extname]";
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
	};
});
