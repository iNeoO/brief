import { Title } from "@mantine/core";
import { SiteShell } from "#/components/layout/site-shell";
import classes from "#/components/shell/shell.module.css";

export function AuthCard({
	title,
	lead,
	children,
	footer,
}: {
	title: string;
	lead?: string;
	children: React.ReactNode;
	footer?: React.ReactNode;
}) {
	return (
		<SiteShell>
			<div className={`brief-shell ${classes.centered}`}>
				<div className={classes.card}>
					<Title order={1} className={classes.cardTitle}>
						{title}
					</Title>

					{lead ? <p className={classes.cardLead}>{lead}</p> : null}

					{children}

					{footer ? <p className={classes.cardFooter}>{footer}</p> : null}
				</div>
			</div>
		</SiteShell>
	);
}
