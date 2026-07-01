import { defineConfig } from 'vite';

import react from '@vitejs/plugin-react';

export default defineConfig({
	plugins: [
		react({
			babel: {
				plugins: [['babel-plugin-react-compiler', {}]],
			},
		}),
	],
	root: "src/mainview",
	base: "",
	build: {
		outDir: "../../dist",
		emptyOutDir: true,
		cssMinify: "lightningcss",
		cssCodeSplit: false,
		rollupOptions: {
			output: {
				codeSplitting: false,
			},
		},
	},
	server: {
		port: 5173,
		strictPort: true,
	},
});
