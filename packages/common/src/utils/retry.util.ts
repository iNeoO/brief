/**
 * The delay for the attempt that just failed, read from a list of tiers.
 *
 * `attempt` counts the attempts that have already failed, so it is 1 when the
 * first one just did. Past the last tier the longest delay repeats, which
 * `MAX_JOB_RETRY` keeps out of reach in practice.
 */
export const retryDelayFromTiers = (
	tiers: readonly number[],
	attempt: number,
) => tiers[attempt - 1] ?? tiers[tiers.length - 1] ?? 0;
