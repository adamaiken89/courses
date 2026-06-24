import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
	plugins: [react()],
	root: "src/mainview",
	build: {
		outDir: "../../dist",
		emptyOutDir: true,
		cssMinify: "lightningcss",
		rollupOptions: {
			output: {
				manualChunks(id: string) {
					if (id.includes("node_modules/react-dom") || id.includes("node_modules/react/")) return "vendor";
					if (id.includes("node_modules/zustand")) return "state";
					if (id.includes("node_modules/i18next") || id.includes("node_modules/react-i18next")) return "i18n";
					if (
						id.includes("node_modules/react-markdown") ||
						id.includes("node_modules/rehype-highlight") ||
						id.includes("node_modules/remark-gfm")
					) return "markdown";
				},
			},
		},
	},
	server: {
		port: 5173,
		strictPort: true,
	},
});
