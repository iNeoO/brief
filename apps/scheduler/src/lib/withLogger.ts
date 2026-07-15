import { type PinoLogger, wrapWithLogger } from "@brief/infra/libs";
import { Effect, Runtime } from "effect";

export const withLogger =
	(logger: PinoLogger) =>
	<A, E, R>(self: Effect.Effect<A, E, R>) =>
		Effect.gen(function* () {
			const runtime = yield* Effect.runtime<R>();

			const exit = yield* Effect.promise(() =>
				wrapWithLogger(logger, () => Runtime.runPromiseExit(runtime)(self)),
			);

			return yield* exit;
		});
