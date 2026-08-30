import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/**
 * `vite preview` serves the production build in the container, and applies the
 * same anti-DNS-rebinding check as the dev server: a request whose Host is not
 * on this list gets a 403. Behind the reverse proxy that Host is the public
 * hostname, which SITE_URL names.
 */
const previewAllowedHosts = () => {
	const hosts = ["localhost", "127.0.0.1"];

	const siteUrl = process.env.SITE_URL;
	if (siteUrl) {
		try {
			hosts.push(new URL(siteUrl).hostname);
		} catch {
			console.warn(`Ignoring invalid SITE_URL for preview hosts: ${siteUrl}`);
		}
	}

	hosts.push(
		...(process.env.WEB_ALLOWED_HOSTS ?? "")
			.split(",")
			.map((host) => host.trim())
			.filter(Boolean),
	);

	return [...new Set(hosts)];
};

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
	preview: {
		host: "0.0.0.0",
		port: 3000,
		allowedHosts: previewAllowedHosts(),
	},
});

export default config;
