import { Title } from "@mantine/core";
import type { ReactNode } from "react";
import classes from "./document.module.css";

type DocumentPageProps = {
	title: string;
	lead: string;
	/** Already formatted for the reader's locale; omitted on pages that do not date. */
	updated?: string;
	children: ReactNode;
};

/**
 * The shell the legal notice, the privacy policy and the about page share: a
 * lead, then a single column of titled sections. They are long, seldom read
 * end to end, and the one thing a reader wants is to find the section they
 * came for — hence the fixed two-column rhythm rather than a prose flow.
 */
export function DocumentPage({
	title,
	lead,
	updated,
	children,
}: DocumentPageProps) {
	return (
		<div className={`brief-shell ${classes.page}`}>
			<header className={classes.header}>
				<Title order={1} className={classes.title}>
					{title}
				</Title>
				<p className={classes.lead}>{lead}</p>
				{updated ? <p className={classes.updated}>{updated}</p> : null}
			</header>

			<div className={classes.body}>{children}</div>
		</div>
	);
}

type DocumentSectionProps = {
	title: string;
	body?: string;
	items?: readonly string[];
	children?: ReactNode;
};

/**
 * One titled section. `body` is the prose, `items` the list some sections end
 * on, and `children` the escape hatch for the few that hold something else —
 * the identity rows of the legal notice, a link out to the privacy policy.
 */
export function DocumentSection({
	title,
	body,
	items,
	children,
}: DocumentSectionProps) {
	return (
		<section className={classes.section}>
			<h2 className={classes.sectionTitle}>{title}</h2>

			<div>
				{body ? <p className={classes.sectionBody}>{body}</p> : null}

				{items?.length ? (
					<ul className={classes.items}>
						{items.map((item) => (
							<li key={item} className={classes.item}>
								{item}
							</li>
						))}
					</ul>
				) : null}

				{children}
			</div>
		</section>
	);
}

type DocumentDefinitionsProps = {
	entries: readonly { label: string; value: ReactNode }[];
};

/** Label/value rows — who publishes the site, and who hosts it. */
export function DocumentDefinitions({ entries }: DocumentDefinitionsProps) {
	return (
		<dl className={classes.definitions}>
			{entries.map((entry) => (
				<div key={entry.label} style={{ display: "contents" }}>
					<dt className={classes.definitionLabel}>{entry.label}</dt>
					<dd className={classes.definitionValue}>{entry.value}</dd>
				</div>
			))}
		</dl>
	);
}

/** A closing aside: which language prevails, where to write about the rest. */
export function DocumentNote({ children }: { children: ReactNode }) {
	return <p className={classes.note}>{children}</p>;
}
