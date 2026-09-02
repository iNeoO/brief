import { LEGAL_PUBLISHER } from "@brief/common/constants";
import { createFileRoute } from "@tanstack/react-router";
import { DocumentPage, DocumentSection } from "#/components/document/document";
import { Closing } from "#/components/home/closing";
import { SiteShell } from "#/components/layout/site-shell";
import { ROUTES } from "#/config/routes";
import { useI18n } from "#/libs/i18n/context";
import { localeLoader, localisedHead } from "#/libs/i18n/route-head";

export const Route = createFileRoute("/about")({
	loader: localeLoader,
	head: localisedHead((t) => ({
		title: t.about.title,
		description: t.about.lead,
		path: ROUTES.about,
	})),
	component: AboutPage,
});

function AboutPage() {
	const { t } = useI18n();
	const page = t.about;

	return (
		<SiteShell>
			<DocumentPage title={page.title} lead={page.lead}>
				<DocumentSection {...page.why} />
				<DocumentSection {...page.how} />
				<DocumentSection {...page.not} />
				<DocumentSection
					title={page.who.title}
					body={page.who.body(LEGAL_PUBLISHER)}
				/>
			</DocumentPage>

			<Closing />
		</SiteShell>
	);
}
