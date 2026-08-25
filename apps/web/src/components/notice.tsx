import classes from "./notice.module.css";

/**
 * `panel` is a status the reader asked for — "check your inbox" — next to the
 * form that produced it. `empty` is a list with nothing in it, or one that
 * failed to load. `bare` is either of those inside a container that already
 * draws its own edge, so the notice does not draw a second one.
 */
export type NoticeVariant = "panel" | "empty" | "bare";

const VARIANT_CLASS = {
	panel: classes.panel,
	empty: classes.empty,
	bare: classes.bare,
} satisfies Record<NoticeVariant, string>;

/**
 * The one short panel this app uses to say why there is nothing to read: an
 * empty list, a failed request, a sign-up waiting on an email. `children` are
 * the actions that get the reader out of it. `className` is for the spacing
 * the surrounding page owes it, never for its own look.
 */
export function Notice({
	title,
	body,
	variant = "empty",
	className,
	children,
}: {
	title: string;
	body?: string;
	variant?: NoticeVariant;
	className?: string;
	children?: React.ReactNode;
}) {
	return (
		<div
			className={`${classes.notice} ${VARIANT_CLASS[variant]}${className ? ` ${className}` : ""}`}
		>
			<p className={classes.title}>{title}</p>

			{body ? <p className={classes.body}>{body}</p> : null}

			{children ? <div className={classes.actions}>{children}</div> : null}
		</div>
	);
}
