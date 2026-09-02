import {
	BRAND_NAME,
	CONTACT_EMAIL,
	LEGAL_HOST,
	LEGAL_PUBLISHER,
	LEGAL_UPDATED_AT,
} from "@brief/common/constants";
import { Anchor } from "@mantine/core";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
	DocumentDefinitions,
	DocumentNote,
	DocumentPage,
	DocumentSection,
} from "#/components/document/document";
import { SiteShell } from "#/components/layout/site-shell";
import { ROUTES } from "#/config/routes";
import { formatDate } from "#/libs/format/date";
import { useI18n } from "#/libs/i18n/context";
import { localeLoader, localisedHead } from "#/libs/i18n/route-head";

export const Route = createFileRoute("/legal")({
	loader: localeLoader,
	head: localisedHead((t) => ({
		title: t.legal.title,
		description: t.legal.lead,
		path: ROUTES.legal,
	})),
	component: LegalPage,
});

function LegalPage() {
	const { t, locale } = useI18n();
	const page = t.legal;
	const identity = page.identity;

	return (
		<SiteShell>
			<DocumentPage
				title={page.title}
				lead={page.lead}
				updated={page.updated(formatDate(new Date(LEGAL_UPDATED_AT), locale))}
			>
				<DocumentSection title={identity.title}>
					<DocumentDefinitions
						entries={[
							{
								label: identity.publisherLabel,
								value: identity.publisherValue(BRAND_NAME, LEGAL_PUBLISHER),
							},
							{ label: identity.statusLabel, value: identity.statusValue },
							{
								label: identity.contactLabel,
								value: (
									<Anchor href={`mailto:${CONTACT_EMAIL}`} underline="always">
										{CONTACT_EMAIL}
									</Anchor>
								),
							},
							{ label: identity.directorLabel, value: LEGAL_PUBLISHER },
							{
								label: identity.hostLabel,
								value: `${LEGAL_HOST.name}, ${LEGAL_HOST.address}`,
							},
							{
								label: identity.hostRegistrationLabel,
								value: identity.hostRegistrationValue(
									LEGAL_HOST.capital,
									LEGAL_HOST.registration,
									LEGAL_HOST.vat,
								),
							},
						]}
					/>
				</DocumentSection>

				<DocumentSection {...page.purpose} />
				<DocumentSection {...page.account} />
				<DocumentSection {...page.prohibited} />
				<DocumentSection {...page.suspension} />
				<DocumentSection {...page.availability} />
				<DocumentSection {...page.liability} />
				<DocumentSection {...page.intellectualProperty} />

				<DocumentSection title={page.data.title} body={page.data.body}>
					<DocumentNote>
						<Anchor component={Link} to={ROUTES.privacy} underline="always">
							{page.data.link}
						</Anchor>
					</DocumentNote>
				</DocumentSection>

				<DocumentSection {...page.changes} />
				<DocumentSection {...page.law} />
			</DocumentPage>

			<div className="brief-shell">
				<DocumentNote>{page.prevails}</DocumentNote>
			</div>
		</SiteShell>
	);
}
