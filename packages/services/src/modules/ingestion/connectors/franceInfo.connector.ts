import type { ArticleConnector } from "../connector.port.js";

export class FranceInfoConnector implements ArticleConnector {
	readonly slug = "france-info";

	async fetchLatest(input: { url: string; limit: number }) {
		return [
			{
				url: "",
				title: "",
				description: null,
				content: "",
				publishedAt: new Date(),
			},
		];
	}
}
