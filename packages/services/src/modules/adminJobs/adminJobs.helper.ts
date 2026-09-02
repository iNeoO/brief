import {
	CATEGORY_JOB_SORT,
	CATEGORY_JOB_STATUS,
	DEFAULT_CATEGORY_JOB_SORT,
	DEFAULT_FETCH_JOB_SORT,
	DEFAULT_JOB_SORT_ORDER,
	FETCH_JOB_SORT,
	JOB_SEARCH_MAX_LENGTH,
	JOB_STATUS,
} from "@brief/common/constants";
import type {
	CategoryJobSort,
	CategoryJobStatus,
	FetchJobSort,
	JobStatus,
} from "@brief/common/types";
import {
	normalizePage,
	normalizeSort,
	toSearchPattern,
} from "../../helpers/listQuery.helper.js";
import type {
	ListAdminCategoryJobsInput,
	ListAdminFetchJobsInput,
	ListJobsInput,
	NormalizedListJobsInput,
} from "./adminJobs.type.js";

const CATEGORY_JOB_SORT_VALUES: readonly CategoryJobSort[] =
	Object.values(CATEGORY_JOB_SORT);

const FETCH_JOB_SORT_VALUES: readonly FetchJobSort[] =
	Object.values(FETCH_JOB_SORT);

const CATEGORY_JOB_STATUS_VALUES: readonly CategoryJobStatus[] =
	Object.values(CATEGORY_JOB_STATUS);

const JOB_STATUS_VALUES: readonly JobStatus[] = Object.values(JOB_STATUS);

/**
 * The status filter, checked against the statuses this list can show. A value
 * from the other list's enum — or from a hand-edited URL — widens the list to
 * everything rather than throwing: it is the same bargain as a page number out
 * of range.
 */
const normalizeStatus = <TStatus extends string>(
	status: string | undefined,
	values: readonly TStatus[],
): TStatus | undefined =>
	status && (values as readonly string[]).includes(status)
		? (status as TStatus)
		: undefined;

const normalizeListJobsInput = <TSort extends string, TStatus extends string>(
	{
		page,
		pageSize,
		sort,
		order,
		search,
		status,
	}: ListJobsInput<TSort, TStatus>,
	{
		sortValues,
		defaultSort,
		statusValues,
	}: {
		sortValues: readonly TSort[];
		defaultSort: TSort;
		statusValues: readonly TStatus[];
	},
): NormalizedListJobsInput<TSort, TStatus> => ({
	...normalizePage({ page, pageSize }),
	...normalizeSort(
		{ sort, order },
		{
			values: sortValues,
			defaultSort,
			defaultOrder: DEFAULT_JOB_SORT_ORDER,
		},
	),
	searchPattern: toSearchPattern(search, JOB_SEARCH_MAX_LENGTH),
	status: normalizeStatus(status, statusValues),
});

/** Settles every input of the admin category job list. */
export const normalizeListAdminCategoryJobsInput = (
	input: ListAdminCategoryJobsInput,
) =>
	normalizeListJobsInput(input, {
		sortValues: CATEGORY_JOB_SORT_VALUES,
		defaultSort: DEFAULT_CATEGORY_JOB_SORT,
		statusValues: CATEGORY_JOB_STATUS_VALUES,
	});

/** Settles every input of the admin provider fetch job list. */
export const normalizeListAdminFetchJobsInput = (
	input: ListAdminFetchJobsInput,
) =>
	normalizeListJobsInput(input, {
		sortValues: FETCH_JOB_SORT_VALUES,
		defaultSort: DEFAULT_FETCH_JOB_SORT,
		statusValues: JOB_STATUS_VALUES,
	});
