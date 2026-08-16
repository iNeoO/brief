import { Button, Title } from "@mantine/core";
import { ROUTES } from "#/config/routes";
import { useI18n } from "#/libs/i18n/context";
import classes from "./home.module.css";

export function Hero() {
	const { t } = useI18n();

	return (
		<section className={`brief-shell ${classes.hero}`}>
			<Title order={1} className={classes.heroTitle}>
				{t.hero.title}
			</Title>

			<p className={classes.heroLead}>{t.hero.lead}</p>

			<div className={classes.heroActions}>
				<Button component="a" href={ROUTES.signUp} size="md" radius="sm">
					{t.hero.cta}
				</Button>

				<p className={classes.heroRhythm}>{t.hero.rhythm}</p>
			</div>
		</section>
	);
}
