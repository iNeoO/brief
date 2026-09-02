import { CATEGORY_JOB_STATUS, JOB_STATUS } from "@brief/common/constants";
import type { CategoryJobStatus } from "@brief/common/types";
import {
	Badge,
	type MantineColor,
	type MantineSize,
	Text,
	Tooltip,
} from "@mantine/core";
import { useI18n } from "#/libs/i18n/context";
import classes from "./admin.module.css";

/**
 * What each outcome reads as at a glance. Only a failure is loud: an admin
 * scrolling a page of runs is looking for the red row, and a page where every
 * status shouts has none.
 */
const STATUS_COLOR: Record<CategoryJobStatus, MantineColor> = {
	[CATEGORY_JOB_STATUS.WAITING_FOR_PROVIDERS]: "gray",
	[JOB_STATUS.PENDING]: "gray",
	[JOB_STATUS.RUNNING]: "blue",
	[JOB_STATUS.FINISHED]: "teal",
	[JOB_STATUS.FAILED]: "red",
	// A quiet news day, not an incident — hence not red.
	[CATEGORY_JOB_STATUS.NO_ARTICLES_SELECTED]: "yellow",
};

/**
 * One job status, labelled and coloured. Takes the widest of the two status
 * enums: a plain job's statuses are a subset of a category job's.
 */
export function JobStatusBadge({
	status,
	size = "sm",
}: {
	status: CategoryJobStatus;
	size?: MantineSize;
}) {
	const { t } = useI18n();

	return (
		<Badge size={size} variant="light" color={STATUS_COLOR[status]}>
			{t.auth.admin.jobStatus[status]}
		</Badge>
	);
}

/** A cell with nothing to show: an em dash rather than an empty box. */
export function NoValue() {
	return <Text c="dimmed">—</Text>;
}

/**
 * Why a run failed, clamped to two lines with the whole message in a tooltip —
 * the same treatment as a category description. Cutting it server-side would
 * hide the half that says what broke.
 */
export function ErrorCell({ error }: { error: string | null }) {
	if (!error) {
		return <NoValue />;
	}

	return (
		<Tooltip label={error} multiline w={360} withArrow openDelay={300}>
			<Text component="span" size="sm" className={classes.errorText}>
				{error}
			</Text>
		</Tooltip>
	);
}
