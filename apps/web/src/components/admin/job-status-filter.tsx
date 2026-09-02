import type { CategoryJobStatus } from "@brief/common/types";
import { Select } from "@mantine/core";
import { useI18n } from "#/libs/i18n/context";
import classes from "./admin.module.css";

/**
 * The status filter of a job list. Each list passes the statuses it can
 * actually show — a fetch job never waits for its providers — and an empty
 * selection means every status rather than none.
 */
export function JobStatusFilter<TStatus extends CategoryJobStatus>({
	statuses,
	value,
	onChange,
}: {
	statuses: readonly TStatus[];
	value: TStatus | undefined;
	onChange: (status: TStatus | undefined) => void;
}) {
	const { t } = useI18n();
	const labels = t.auth.admin.jobs.statusFilter;

	return (
		<Select
			size="sm"
			className={classes.statusFilter}
			aria-label={labels.label}
			allowDeselect={false}
			value={value ?? ""}
			data={[
				{ value: "", label: labels.all },
				...statuses.map((status) => ({
					value: status,
					label: t.auth.admin.jobStatus[status],
				})),
			]}
			onChange={(next) => onChange(next ? (next as TStatus) : undefined)}
		/>
	);
}
