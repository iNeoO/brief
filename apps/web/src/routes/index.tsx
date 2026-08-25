import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Closing } from "#/components/home/closing";
import { Hero } from "#/components/home/hero";
import { HowItWorks } from "#/components/home/how-it-works";
import { LatestBriefs } from "#/components/home/latest-briefs";
import { Topics } from "#/components/home/topics";
import { SiteShell } from "#/components/layout/site-shell";
import { ROUTES } from "#/config/routes";
import { latestBriefsQueryOptions } from "#/libs/api/briefs";
import { readStoredLocale } from "#/libs/i18n/locale-cookie";
import { localisedHead } from "#/libs/i18n/route-head";

export const Route = createFileRoute("/")({
	// Awaited even on the client: the briefs are the point of the page, and a
	// section that pops in after the fold reads as a layout bug.
	loader: async ({ context }) => {
		await context.queryClient.ensureQueryData(latestBriefsQueryOptions());

		return { locale: readStoredLocale() };
	},
	// The one page that leads with the brand: a search result for "daily briefs"
	// should read as the name of the site, not as a sentence about it.
	head: localisedHead((t) => ({
		title: t.meta.title,
		description: t.meta.description,
		path: ROUTES.landing,
		brandFirst: true,
	})),
	component: Landing,
});

function Landing() {
	const briefs = useQuery(latestBriefsQueryOptions());

	return (
		<SiteShell>
			<Hero />
			<HowItWorks />
			<LatestBriefs briefs={briefs.data ?? []} failed={briefs.isError} />
			<Topics />
			<Closing />
		</SiteShell>
	);
}
