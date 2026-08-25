import type { Paginated } from "@brief/common/types";
import type { BriefCard } from "@brief/services";
import { Box, LoadingOverlay } from "@mantine/core";
import { Link } from "@tanstack/react-router";
import { Notice } from "#/components/notice";
import { PaginationFooter, usePageClamp } from "#/components/pagination-footer";
import { ROUTES } from "#/config/routes";
import { formatCalendarDate } from "#/libs/format/date";
import { useI18n } from "#/libs/i18n/context";
import classes from "./briefs.module.css";

export type BriefsListEmpty = {
	title: string;
	body: string;
	action?: React.ReactNode;
};

export function BriefsList({
	label,
	result,
	isFetching,
	isError,
	page,
	onPageChange,
	empty,
}: {
	label: string;
	result: Paginated<BriefCard> | undefined;
	isFetching: boolean;
	isError: boolean;
	page: number;
	onPageChange: (page: number) => void;
	empty: BriefsListEmpty;
}) {
	const { t } = useI18n();

	usePageClamp(result, onPageChange);

	if (isError) {
		return <Notice title={t.briefs.loadError} />;
	}

	if (result && result.items.length === 0) {
		return (
			<Notice title={empty.title} body={empty.body}>
				{empty.action}
			</Notice>
		);
	}

	return (
		<>
			<Box pos="relative">
				<LoadingOverlay
					visible={isFetching}
					zIndex={1}
					overlayProps={{ blur: 1 }}
				/>

				<ul className={classes.list}>
					{(result?.items ?? []).map((brief) => (
						<BriefRow key={brief.id} brief={brief} />
					))}
				</ul>
			</Box>

			<PaginationFooter
				label={label}
				page={page}
				pageCount={result?.pageCount}
				position={t.briefs.pagination.position}
				onPageChange={onPageChange}
			/>
		</>
	);
}

function BriefRow({ brief }: { brief: BriefCard }) {
	const { locale, t } = useI18n();

	return (
		<li className={classes.item}>
			<div className={classes.itemMeta}>
				<span className={classes.topic}>{brief.categoryName}</span>
				<span className={classes.date}>
					{formatCalendarDate(brief.targetDate, locale, "long")}
				</span>
				<span className={classes.date}>
					{t.brief.readTime(brief.readingMinutes)}
				</span>
			</div>

			<p className={classes.itemExcerpt}>{brief.excerpt}</p>

			<div className={classes.itemActions}>
				<Link to={ROUTES.brief} params={{ id: String(brief.id) }}>
					{t.brief.read}
				</Link>
			</div>
		</li>
	);
}
