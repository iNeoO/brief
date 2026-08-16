import { Button, Title } from "@mantine/core";
import { ROUTES } from "#/config/routes";
import { useI18n } from "#/libs/i18n/context";
import classes from "./home.module.css";

export function Closing() {
	const { t } = useI18n();

	return (
		<section
			className={`${classes.section} ${classes.sectionBordered} ${classes.closing}`}
		>
			<div className="brief-shell">
				<Title order={2} className={classes.sectionTitle}>
					{t.closing.title}
				</Title>

				<p className={classes.sectionLead}>{t.closing.body}</p>

				<div className={classes.closingActions}>
					<Button component="a" href={ROUTES.signUp} size="md" radius="sm">
						{t.closing.cta}
					</Button>

					<p className={classes.closingNote}>{t.closing.note}</p>
				</div>
			</div>
		</section>
	);
}
