import type { Paginated } from "@brief/common/types";
import { Pagination } from "@mantine/core";
import { useEffect } from "react";
import classes from "./pagination-footer.module.css";

/**
 * A page that no longer exists — the last row of page 3 was just removed, or
 * the URL was hand-edited — sends the reader to the last page rather than to an
 * empty list. It sits outside `PaginationFooter` because a list that shrank to
 * a single page shows no footer at all, and still has to clamp.
 */
export function usePageClamp(
	result: Pick<Paginated<unknown>, "page" | "pageCount"> | undefined,
	onPageChange: (page: number) => void,
) {
	useEffect(() => {
		if (result && result.page > result.pageCount) {
			onPageChange(result.pageCount);
		}
	}, [result, onPageChange]);
}

/**
 * The page picker and its "Page 2 of 7" position, under a paginated list.
 * Nothing is rendered while there is a single page to read.
 */
export function PaginationFooter({
	label,
	page,
	pageCount,
	position,
	onPageChange,
}: {
	label: string;
	page: number;
	pageCount: number | undefined;
	position: (page: number, pageCount: number) => string;
	onPageChange: (page: number) => void;
}) {
	if (!pageCount || pageCount < 2) {
		return null;
	}

	return (
		<nav className={classes.pagination} aria-label={label}>
			<Pagination
				size="sm"
				total={pageCount}
				value={page}
				onChange={onPageChange}
			/>

			<span className={classes.position}>{position(page, pageCount)}</span>
		</nav>
	);
}
