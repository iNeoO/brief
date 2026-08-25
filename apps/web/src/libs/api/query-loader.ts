import type {
	DefaultError,
	EnsureQueryDataOptions,
	QueryClient,
} from "@tanstack/react-query";
import { readStoredLocale } from "#/libs/i18n/locale-cookie";

/**
 * A page query with its data and key erased: a loader only warms the cache, it
 * never reads the result back. The erasure has to be `any` — both appear in
 * contravariant position (`queryFn` reads the key, `staleTime` reads the whole
 * `Query`), so `unknown` rejects every concrete options object, and dropping
 * the offending property only moves the rejection to the next one. The error
 * type stays honest: nothing here erases it.
 */
// biome-ignore lint/suspicious/noExplicitAny: see above
type WarmableQuery = EnsureQueryDataOptions<any, DefaultError, any, any>;

/**
 * Server rendering has to hold the response until the data is in the cache —
 * it is the markup. A client transition only warms it, so the navigation lands
 * immediately and the list fills in.
 */
export const prefetchQueries = async (
	queryClient: QueryClient,
	options: WarmableQuery[],
) => {
	if (import.meta.env.SSR) {
		await Promise.all(
			options.map((option) => queryClient.ensureQueryData(option)),
		);

		return;
	}

	for (const option of options) {
		void queryClient.prefetchQuery(option);
	}
};

/**
 * A loader whose whole job is warming the queries its page reads, keyed by the
 * search params. A page whose `head` needs more than the locale — the archive
 * reads its page number — writes its loader out and calls `prefetchQueries`.
 */
export const queryLoader =
	<TDeps>(...toOptions: Array<(deps: TDeps) => WarmableQuery>) =>
	async ({
		context,
		deps,
	}: {
		context: { queryClient: QueryClient };
		deps: TDeps;
	}) => {
		await prefetchQueries(
			context.queryClient,
			toOptions.map((toOption) => toOption(deps)),
		);

		return { locale: readStoredLocale() };
	};
