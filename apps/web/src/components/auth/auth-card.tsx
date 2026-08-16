import { Title } from "@mantine/core";
import { PlainBar } from "#/components/shell/plain-bar";
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
		<div className={classes.page}>
			<PlainBar />

			<main id="main" className={`brief-shell ${classes.centered}`}>
				<div className={classes.card}>
					<Title order={1} className={classes.cardTitle}>
						{title}
					</Title>

					{lead ? <p className={classes.cardLead}>{lead}</p> : null}

					{children}

					{footer ? <p className={classes.cardFooter}>{footer}</p> : null}
				</div>
			</main>
		</div>
	);
}

export function AuthNotice({
	title,
	body,
	children,
}: {
	title: string;
	body: string;
	children?: React.ReactNode;
}) {
	return (
		<div className={classes.notice}>
			<p className={classes.noticeTitle}>{title}</p>
			<p className={classes.noticeBody}>{body}</p>
			{children ? (
				<div className={classes.noticeActions}>{children}</div>
			) : null}
		</div>
	);
}
