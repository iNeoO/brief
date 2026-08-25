import { InternalError } from "@brief/infra/errors";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchText } from "./fetchText.helper.js";

const URL = "https://example.test/rss";

const fetchMock = vi.fn();

const read = (overrides: Partial<Parameters<typeof fetchText>[0]> = {}) =>
	fetchText({ url: URL, context: "the Example feed", ...overrides });

/** Rejects only once the caller's own timeout aborts the request. */
const hangUntilAborted = () =>
	fetchMock.mockImplementation(
		(_url: string, init: { signal: AbortSignal }) =>
			new Promise((_resolve, reject) => {
				init.signal.addEventListener("abort", () => {
					const abortError = new Error("The operation was aborted");
					abortError.name = "AbortError";
					reject(abortError);
				});
			}),
	);

beforeEach(() => {
	fetchMock.mockReset();
	vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.useRealTimers();
});

describe("fetchText", () => {
	it("returns the body of a successful response", async () => {
		fetchMock.mockResolvedValue(new Response("<rss />", { status: 200 }));

		await expect(read()).resolves.toBe("<rss />");
	});

	it("names the context and the status when the server refuses", async () => {
		fetchMock.mockResolvedValue(new Response("nope", { status: 503 }));

		await expect(read()).rejects.toMatchObject({
			code: "CONNECTOR_FETCH_ERROR",
			message: "Request to the Example feed failed with status 503",
		});
	});

	it("treats a redirect the client did not follow as a failure", async () => {
		fetchMock.mockResolvedValue(new Response(null, { status: 304 }));

		await expect(read()).rejects.toBeInstanceOf(InternalError);
	});

	it("reports a network failure under the fetch error code", async () => {
		fetchMock.mockRejectedValue(new TypeError("fetch failed"));

		await expect(read()).rejects.toMatchObject({
			code: "CONNECTOR_FETCH_ERROR",
			message: "Request to the Example feed failed",
		});
	});

	it("lets the caller pick the codes the failures are reported under", async () => {
		fetchMock.mockRejectedValue(new TypeError("fetch failed"));

		await expect(
			read({ fetchErrorCode: "FILE_DOWNLOAD_FAILED" }),
		).rejects.toMatchObject({ code: "FILE_DOWNLOAD_FAILED" });
	});

	it("gives up on a provider that never answers", async () => {
		vi.useFakeTimers();
		hangUntilAborted();

		const pending = read({ timeoutMs: 5_000 });
		const assertion = expect(pending).rejects.toMatchObject({
			code: "CONNECTOR_TIMEOUT",
			message: "Request to the Example feed timed out (5000ms)",
		});

		await vi.advanceTimersByTimeAsync(5_000);
		await assertion;
	});

	it("does not leave its timer running once the response is in", async () => {
		vi.useFakeTimers();
		fetchMock.mockResolvedValue(new Response("<rss />", { status: 200 }));

		await read();

		// A worker fetches every provider in a row: a timer left pending per call
		// would keep the process alive after the job is done.
		expect(vi.getTimerCount()).toBe(0);
	});
});
