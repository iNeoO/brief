import { CONNECTOR_KIND } from "./connectors.constant.js";

/**
 * The media the RSS connector is known to ingest. It is not a hard whitelist —
 * any RSS feed works — but it is the list the seed installs and the one the
 * connector's network smoke test runs against, so the two never drift.
 */
export const SEED_PROVIDERS = [
	{
		name: "France Info",
		slug: "france-info",
		url: "https://www.franceinfo.fr/titres.rss",
		kind: CONNECTOR_KIND.RSS,
	},
	{
		name: "France 24",
		slug: "france-24",
		url: "https://www.france24.com/fr/france/rss",
		kind: CONNECTOR_KIND.RSS,
	},
	{
		name: "Huffpost",
		slug: "huffpost",
		url: "https://www.huffingtonpost.fr/rss/all_full.xml",
		kind: CONNECTOR_KIND.RSS,
	},
	{
		name: "RFI",
		slug: "rfi",
		url: "https://www.rfi.fr/fr/france/rss",
		kind: CONNECTOR_KIND.RSS,
	},
	{
		name: "20 Minutes",
		slug: "20-minutes",
		url: "https://www.20minutes.fr/feeds/rss-une.xml",
		kind: CONNECTOR_KIND.RSS,
	},
	{
		name: "Public Sénat",
		slug: "public-senat",
		url: "https://www.publicsenat.fr/feed",
		kind: CONNECTOR_KIND.RSS,
	},
	{
		name: "Radio-Canada Info",
		slug: "radio-canada",
		url: "https://ici.radio-canada.ca/rss/4159",
		kind: CONNECTOR_KIND.RSS,
	},
	{
		name: "RTBF Info",
		slug: "rtbf",
		url: "https://rss.rtbf.be/article/rss/highlight_rtbf_info.xml",
		kind: CONNECTOR_KIND.RSS,
	},
	{
		name: "Global Voices FR",
		slug: "global-voices-fr",
		url: "https://fr.globalvoices.org/feed/",
		kind: CONNECTOR_KIND.RSS,
	},
	{
		name: "Frandroid",
		slug: "frandroid",
		url: "https://www.frandroid.com/feed",
		kind: CONNECTOR_KIND.RSS,
	},
	{
		name: "Slate",
		slug: "slate",
		url: "https://slate.com/feeds/news-and-politics.rss",
		kind: CONNECTOR_KIND.RSS,
	},
	{
		name: "Futura",
		slug: "futura",
		url: "https://www.futura-sciences.com/rss/actualites.xml",
		kind: CONNECTOR_KIND.RSS,
	},
	{
		name: "The Conversation FR",
		slug: "the-conversation-fr",
		url: "https://theconversation.com/fr/articles.atom",
		kind: CONNECTOR_KIND.ATOM,
	},
] as const;
