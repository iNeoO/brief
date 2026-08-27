import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const config = defineConfig({
	resolve: { tsconfigPaths: true },
	plugins: [tanstackStart(), viteReact()],
	server: {
		/**
		 * Meta calls the WhatsApp webhook, so dev goes through a tunnel. Vite's
		 * anti-DNS-rebinding check rejects the tunnel hostname with a 403 that Meta
		 * reports as an invalid verify token. Named by suffix rather than in full
		 * because the subdomain changes every time the tunnel restarts.
		 */
		allowedHosts: [".trycloudflare.com", ".ngrok-free.app", ".ngrok.io"],
	},
});

export default config;
