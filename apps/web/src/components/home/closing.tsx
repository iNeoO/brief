import { SIGNUP_ENABLED } from "@brief/common/constants";
import { Button, Title } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ROUTES } from "#/config/routes";
import { sessionQueryOptions } from "#/libs/api/auth";
import { useI18n } from "#/libs/i18n/context";
import classes from "./home.module.css";

export function Closing() {
	const { t } = useI18n();
	const { data: session } = useQuery(sessionQueryOptions());
	const isSignedIn = Boolean(session?.user);

	const copy = isSignedIn ? t.closing.signedIn : t.closing;

	// With sign-up closed, the one door left is the one an invited reader came
	// through, so the call to action stops promising an account.
	const signUpClosed = !isSignedIn && !SIGNUP_ENABLED;
	const to = isSignedIn
		? ROUTES.topics
		: signUpClosed
			? ROUTES.signIn
			: ROUTES.signUp;
	const cta = signUpClosed ? t.nav.signIn : copy.cta;

	return (
		<section
			className={`${classes.section} ${classes.sectionBordered} ${classes.closing}`}
		>
			<div className="brief-shell">
				<Title order={2} className={classes.sectionTitle}>
					{copy.title}
				</Title>

				<p className={classes.sectionLead}>{copy.body}</p>

				<div className={classes.closingActions}>
					<Button component={Link} to={to} size="md" radius="sm">
						{cta}
					</Button>

					<p className={classes.closingNote}>{copy.note}</p>
				</div>
			</div>
		</section>
	);
}
