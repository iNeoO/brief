import { createFileRoute } from "@tanstack/react-router";
import { Closing } from "#/components/home/closing";
import { DailyBrief } from "#/components/home/daily-brief";
import { Hero } from "#/components/home/hero";
import { HowItWorks } from "#/components/home/how-it-works";
import { Topics } from "#/components/home/topics";
import { SiteShell } from "#/components/layout/site-shell";
import { useI18n } from "#/libs/i18n/context";

export const Route = createFileRoute("/")({ component: Landing });

const SAMPLE_BRIEF_DATE = new Date("2026-08-10T05:00:00.000Z");

function Landing() {
	const { t } = useI18n();

	return (
		<SiteShell>
			<Hero />
			<HowItWorks />
			<DailyBrief date={SAMPLE_BRIEF_DATE} items={t.brief.items} />
			<Topics />
			<Closing />
		</SiteShell>
	);
}
