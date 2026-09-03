import type { Database } from "@brief/drizzle";

/**
 * Test-only scaffolding for the services that talk to drizzle. Every service
 * takes its `Database` through the constructor, so a test never needs a real
 * pool — it hands over an object literal that answers the handful of builder
 * links the method under test actually chains through.
 *
 * These are deliberately primitives rather than a fake drizzle: a test still
 * writes its own `db` shape, so it stays obvious which queries the method runs,
 * and the clauses it built remain assertable through `calls`.
 */

/** One link of a query builder chain, as the fake recorded it. */
export type BuilderCall = { method: string; args: unknown[] };

/**
 * The links the services chain through, entry points included: a chain doubles
 * as the whole fake `db` for a method that runs a single query. `returning` is
 * handled apart, as it ends the chain with a plain promise the way drizzle does.
 */
const CHAIN_LINKS = [
	"select",
	"insert",
	"update",
	"delete",
	"set",
	"values",
	"from",
	"where",
	"innerJoin",
	"leftJoin",
	"leftJoinLateral",
	"orderBy",
	"groupBy",
	"having",
	"limit",
	"offset",
	"onConflictDoNothing",
	"onConflictDoUpdate",
	"as",
] as const;

type ChainLink = (typeof CHAIN_LINKS)[number] | "returning";

export type RecordingChain<T> = Promise<T[]> &
	Record<
		(typeof CHAIN_LINKS)[number],
		(...args: unknown[]) => RecordingChain<T>
	> & {
		returning: (...args: unknown[]) => Promise<T[]>;
		/** Every link the chain was taken through, in order. */
		calls: BuilderCall[];
		/** The arguments of the last call to `method`, or undefined if never called. */
		args: (method: ChainLink) => unknown[] | undefined;
	};

/**
 * A query builder that resolves to `rows`, records every link it was chained
 * through, and is awaitable on its own as well as through `returning()` —
 * drizzle builders are both, and the services use both forms.
 *
 * A method that runs one query can use the chain as its entire `db`; one that
 * runs several composes a `db` literal handing a distinct chain per query, so
 * each keeps its own rows and its own recorded clauses.
 */
export const recordingChain = <T>(rows: T[] = []): RecordingChain<T> => {
	const calls: BuilderCall[] = [];
	const chain = Promise.resolve(rows) as RecordingChain<T>;

	Object.assign(chain, {
		calls,
		args: (method: ChainLink) =>
			calls.filter((call) => call.method === method).at(-1)?.args,
		returning: (...args: unknown[]) => {
			calls.push({ method: "returning", args });
			return Promise.resolve(rows);
		},
	});

	for (const link of CHAIN_LINKS) {
		Object.assign(chain, {
			[link]: (...args: unknown[]) => {
				calls.push({ method: link, args });
				return chain;
			},
		});
	}

	return chain;
};

/**
 * `db.transaction(cb)` that runs the callback against the `tx` fake and hands
 * back whatever it returned, so a rollback is simply a rejection.
 */
export const fakeTransaction = <T>(tx: T) => ({
	transaction: (run: (t: T) => Promise<unknown>) => run(tx),
});

/**
 * The single type assertion a test needs: a partial fake stands in for the real
 * `Database`, whose builder types are far too wide to satisfy by hand.
 */
export const asDatabase = (fake: object) => fake as unknown as Database;
