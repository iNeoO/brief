/**
 * How long a run took, as an operator reads it: seconds below a minute, then
 * minutes and seconds, then hours and minutes.
 *
 * Written out rather than left to `Intl.DurationFormat`, which is too recent
 * to count on in every browser this app serves — and a formatter the server
 * has and the client does not would break hydration on the first render.
 */
export const formatDuration = (seconds: number) => {
	// A clock that stepped backwards during the run must not print `-3s`.
	const total = Math.max(0, Math.round(seconds));

	if (total < 60) {
		return `${total}s`;
	}

	const minutes = Math.floor(total / 60);
	const pad = (value: number) => String(value).padStart(2, "0");

	return minutes < 60
		? `${minutes}m ${pad(total % 60)}s`
		: `${Math.floor(minutes / 60)}h ${pad(minutes % 60)}m`;
};
