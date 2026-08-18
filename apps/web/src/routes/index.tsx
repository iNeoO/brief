import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Closing } from "#/components/home/closing";
import { Hero } from "#/components/home/hero";
import { HowItWorks } from "#/components/home/how-it-works";
import { LatestBriefs } from "#/components/home/latest-briefs";
import { Topics } from "#/components/home/topics";
import { SiteShell } from "#/components/layout/site-shell";
import { latestBriefsQueryOptions } from "#/libs/api/briefs";

export const Route = createFileRoute("/")({
	// Awaited even on the client: the briefs are the point of the page, and a
	// section that pops in after the fold reads as a layout bug.
	loader: ({ context }) =>
		context.queryClient.ensureQueryData(latestBriefsQueryOptions()),
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
