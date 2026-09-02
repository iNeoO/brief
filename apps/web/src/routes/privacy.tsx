import {
	CONTACT_EMAIL,
	LEGAL_PUBLISHER,
	LEGAL_UPDATED_AT,
} from "@brief/common/constants";
import { Anchor } from "@mantine/core";
import { createFileRoute } from "@tanstack/react-router";
import {
	DocumentNote,
	DocumentPage,
	DocumentSection,
} from "#/components/document/document";
import { SiteShell } from "#/components/layout/site-shell";
import { ROUTES } from "#/config/routes";
import { formatDate } from "#/libs/format/date";
import { useI18n } from "#/libs/i18n/context";
import { localeLoader, localisedHead } from "#/libs/i18n/route-head";

export const Route = createFileRoute("/privacy")({
	loader: localeLoader,
	head: localisedHead((t) => ({
		title: t.privacy.title,
		description: t.privacy.lead,
		path: ROUTES.privacy,
	})),
	component: PrivacyPage,
});

function PrivacyPage() {
	const { t, locale } = useI18n();
	const page = t.privacy;

	const contactLink = (
		<Anchor href={`mailto:${CONTACT_EMAIL}`} underline="always">
			{CONTACT_EMAIL}
		</Anchor>
	);

	return (
		<SiteShell>
			<DocumentPage
				title={page.title}
				lead={page.lead}
				updated={page.updated(formatDate(new Date(LEGAL_UPDATED_AT), locale))}
			>
				<DocumentSection
					title={page.controller.title}
					body={page.controller.body(LEGAL_PUBLISHER)}
				>
					<DocumentNote>{contactLink}</DocumentNote>
				</DocumentSection>

				<DocumentSection {...page.collected} />
				<DocumentSection {...page.purposes} />
				<DocumentSection {...page.ai} />
				<DocumentSection {...page.recipients} />
				<DocumentSection {...page.retention} />

				<DocumentSection
					title={page.cookies.title}
					body={page.cookies.body}
					items={page.cookies.items}
				>
					<DocumentNote>{page.cookies.note}</DocumentNote>
				</DocumentSection>

				<DocumentSection
					title={page.rights.title}
					body={page.rights.body}
					items={page.rights.items}
				>
					<DocumentNote>
						{page.rights.note} {contactLink}
					</DocumentNote>
				</DocumentSection>

				<DocumentSection {...page.complaint} />
				<DocumentSection {...page.changes} />
			</DocumentPage>
		</SiteShell>
	);
}
