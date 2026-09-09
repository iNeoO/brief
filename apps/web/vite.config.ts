import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const config = defineConfig({
	resolve: { tsconfigPaths: true },
	plugins: [tanstackStart(), viteReact()],
	server: {
		/**
		 * Telegram calls the webhook, so dev goes through a tunnel. Vite's
		 * anti-DNS-rebinding check rejects the tunnel hostname with a 403, which
		 * `getWebhookInfo` then reports as a failing delivery. Named by suffix
		 * rather than in full because the subdomain changes every time the tunnel
		 * restarts.
		 *
		 * Telegram also accepts only ports 443, 80, 88 and 8443 and requires a
		 * valid certificate, so the tunnel is not optional — its 443 is what the
		 * webhook URL points at, and it forwards to this dev server.
		 */
		allowedHosts: [".trycloudflare.com", ".ngrok-free.app", ".ngrok.io"],
	},
});

export default config;
