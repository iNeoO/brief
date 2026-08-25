import { Title } from "@mantine/core";
import { createFileRoute } from "@tanstack/react-router";
import { Closing } from "#/components/home/closing";
import { FlowDiagram } from "#/components/how-it-works/flow-diagram";
import classes from "#/components/how-it-works/how-it-works.module.css";
import { SiteShell } from "#/components/layout/site-shell";
import { ROUTES } from "#/config/routes";
import { useI18n } from "#/libs/i18n/context";
import { localeLoader, localisedHead } from "#/libs/i18n/route-head";

export const Route = createFileRoute("/how-it-works")({
	loader: localeLoader,
	head: localisedHead((t) => ({
		...t.seo.howItWorks,
		path: ROUTES.howItWorks,
	})),
	component: HowItWorksPage,
});

function HowItWorksPage() {
	const { t } = useI18n();
	const page = t.method.page;

	return (
		<SiteShell>
			<div className={`brief-shell ${classes.page}`}>
				<header className={classes.header}>
					<Title order={1} className={classes.title}>
						{page.title}
					</Title>
					<p className={classes.lead}>{page.lead}</p>
				</header>

				<FlowDiagram />

				<ol className={classes.details}>
					{page.details.map((detail, index) => (
						<li key={detail.title} className={classes.detail}>
							<h2 className={classes.detailTitle}>
								<span className={classes.detailNumber} aria-hidden="true">
									{String(index + 1).padStart(2, "0")}
								</span>
								{detail.title}
							</h2>
							<p className={classes.detailBody}>{detail.body}</p>
						</li>
					))}
				</ol>
			</div>

			<Closing />
		</SiteShell>
	);
}
