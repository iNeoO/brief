// Reproduces RssConnector.fetchLatest + fetchText + extractArticle against a live
// feed, using the SAME feedsmith / Readability / linkedom the workspace resolves.
// Usage: node verify-feed.mjs <feedUrl> [label] [limit]
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const findRepoRoot = () => {
	let dir = dirname(fileURLToPath(import.meta.url));
	while (dir !== "/") {
		if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
		dir = dirname(dir);
	}
	throw new Error("repo root not found (no pnpm-workspace.yaml above this script)");
};

const require = createRequire(join(findRepoRoot(), "packages/services/package.json"));
const { parseRssFeed } = await import(require.resolve("feedsmith"));
const { Readability } = await import(require.resolve("@mozilla/readability"));
const { parseHTML } = await import(require.resolve("linkedom"));

const MAX_ARTICLE_CONTENT_CHARS = 20_000; // @brief/common/constants
const USEFUL_CONTENT_FLOOR = 500; // below this, the body is boilerplate

const fetchText = async (url, timeoutMs = 5000) => {
	const ac = new AbortController();
	const timeout = setTimeout(() => ac.abort(), timeoutMs);
	try {
		const res = await fetch(url, { signal: ac.signal });
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		// Mirrors the connector: res.text() always decodes UTF-8, whatever the
		// declared charset. A latin-1 source shows up as U+FFFD here too.
		return await res.text();
	} finally {
		clearTimeout(timeout);
	}
};

const tidy = (s) => s.replace(/[\t ]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();

const extractArticle = (html) => {
	let text = "";
	try {
		const { document } = parseHTML(html);
		text = tidy(new Readability(document).parse()?.textContent ?? "");
	} catch {}
	if (!text) {
		text = tidy(
			html
				.replace(/<script[\s\S]*?<\/script>/gi, " ")
				.replace(/<style[\s\S]*?<\/style>/gi, " ")
				.replace(/<[^>]+>/g, " "),
		);
	}
	return text.length > MAX_ARTICLE_CONTENT_CHARS
		? `${text.slice(0, MAX_ARTICLE_CONTENT_CHARS)}…`
		: text;
};

const [, , url, label = "feed", rawLimit = "5"] = process.argv;
if (!url) {
	console.error("usage: node verify-feed.mjs <feedUrl> [label] [limit]");
	process.exit(2);
}
const limit = Number(rawLimit);
const out = { label, url, limit };

try {
	const rss = await fetchText(url);
	out.feedBytes = rss.length;

	let parsed;
	try {
		parsed = await parseRssFeed(rss);
	} catch (err) {
		out.verdict = "PARSE_FAIL";
		out.detail = `${err.message} — Atom feed? The connector is RSS-only.`;
		out.rootTag = rss.slice(rss.indexOf("<"), rss.indexOf("<") + 60);
		console.log(JSON.stringify(out, null, 2));
		process.exit(0);
	}
	if (!parsed?.items?.length) {
		out.verdict = "PARSE_FAIL";
		out.detail = "no items — the connector throws CONNECTOR_PARSE_ERROR here";
		console.log(JSON.stringify(out, null, 2));
		process.exit(0);
	}

	out.totalItems = parsed.items.length;
	const usable = parsed.items.filter((i) => i.link && i.title);
	out.itemsWithLinkAndTitle = usable.length;

	// Same fallback as the connector: SPIP dates with Dublin Core.
	const dateOf = (i) => i.pubDate ?? i.dc?.dates?.[0];
	out.dateSource = usable[0]?.pubDate ? "pubDate" : dateOf(usable[0]) ? "dc:dates" : "NONE";

	// Chronological order matters: at fetchLimit the connector takes the FIRST n
	// items, so an unsorted feed silently ingests years-old articles.
	const dates = usable.map(dateOf).filter(Boolean).map((d) => new Date(d));
	out.newestItem = dates.length ? new Date(Math.max(...dates)).toISOString() : null;
	out.oldestItem = dates.length ? new Date(Math.min(...dates)).toISOString() : null;
	out.chronological = dates.every((d, i) => i === 0 || dates[i - 1] >= d);

	// Path mix: a feed that is half TV listings or deals burns the fetch budget.
	const mix = {};
	for (const i of usable) {
		const seg = (i.link.split("/")[3] ?? "").split("?")[0] || "(root)";
		mix[seg] = (mix[seg] ?? 0) + 1;
	}
	// Only meaningful when the site groups articles under section paths; on flat
	// slug URLs every item looks like its own section, which says nothing.
	out.pathMix =
		Object.keys(mix).length > usable.length / 2
			? "(flat URLs — no section signal)"
			: Object.fromEntries(
					Object.entries(mix).sort((a, b) => b[1] - a[1]).slice(0, 6),
				);

	out.articles = [];
	for (const item of usable.slice(0, limit)) {
		const raw = dateOf(item);
		const d = raw ? new Date(raw) : null;
		const a = {
			title: String(item.title).slice(0, 70),
			url: item.link,
			hasDescription: Boolean(item.description),
			publishedAtValid: Boolean(d && !Number.isNaN(d.getTime())),
		};
		try {
			const html = await fetchText(item.link);
			const content = extractArticle(html);
			a.contentChars = content.length;
			a.replacementChars = (content.match(/�/g) ?? []).length;
			a.contentHead = content.replace(/\s+/g, " ").slice(0, 140);
		} catch (err) {
			a.error = String(err.message ?? err);
		}
		out.articles.push(a);
	}

	const ok = out.articles.filter(
		(a) => !a.error && a.contentChars > USEFUL_CONTENT_FLOOR && !a.replacementChars,
	);
	out.usableArticles = `${ok.length}/${out.articles.length}`;
	out.allHavePublishedAt = out.articles.every((a) => a.publishedAtValid);
	out.verdict =
		ok.length === out.articles.length && out.allHavePublishedAt
			? "PASS"
			: ok.length > 0
				? "PARTIAL"
				: "FAIL";
} catch (err) {
	out.verdict = "FEED_FETCH_FAIL";
	out.detail = String(err.message ?? err);
}

console.log(JSON.stringify(out, null, 2));
