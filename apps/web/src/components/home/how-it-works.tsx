import { Title } from "@mantine/core";
import { Link } from "@tanstack/react-router";
import { ROUTES } from "#/config/routes";
import { useI18n } from "#/libs/i18n/context";
import classes from "./home.module.css";

export function HowItWorks() {
	const { t } = useI18n();

	return (
		<section
			id="how-it-works"
			className={`${classes.section} ${classes.sectionBordered}`}
		>
			<div className="brief-shell">
				<Title order={2} className={classes.sectionTitle}>
					{t.method.title}
				</Title>

				<div className={classes.steps}>
					{t.method.steps.map((step, index) => (
						<div key={step.title} className={classes.step}>
							<span className={classes.stepNumber} aria-hidden="true">
								{String(index + 1).padStart(2, "0")}
							</span>
							<h3 className={classes.stepTitle}>{step.title}</h3>
							<p className={classes.stepBody}>{step.body}</p>
						</div>
					))}
				</div>

				<p className={classes.sectionMore}>
					<Link to={ROUTES.howItWorks} className={classes.sectionLink}>
						{t.method.seeMore}
					</Link>
				</p>
			</div>
		</section>
	);
}
