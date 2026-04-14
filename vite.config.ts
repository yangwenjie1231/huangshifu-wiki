import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [
		react(),
		tailwindcss(),
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
