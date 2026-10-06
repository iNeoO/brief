export type CapturedToolCall = { id: string; name: string; arguments: string };

export type Exchange = {
	model: string;
	routedVia: string | null;
	status: number;
	durationMs: number;
	hasTools: boolean;
	hasResponseFormat: boolean;
	toolResultsSent: number;
	content: string;
	toolCalls: CapturedToolCall[];
	finishReason: string | null;
	promptTokens: number;
	completionTokens: number;
	error: string | null;
};

type ChatRequest = {
	model?: string;
	tools?: unknown[];
	response_format?: unknown;
	messages?: { role?: string }[];
};

type ChoiceDelta = {
	content?: string | null;
	tool_calls?: {
		index?: number;
		id?: string;
		function?: { name?: string; arguments?: string };
	}[];
};

export type CompletionChunk = {
	choices?: {
		delta?: ChoiceDelta;
		message?: ChoiceDelta;
		finish_reason?: string | null;
	}[];
	usage?: { prompt_tokens?: number; completion_tokens?: number } | null;
	error?: { message?: string };
};

const parseJson = <T>(text: string): T | undefined => {
	try {
		return JSON.parse(text);
	} catch {
		return undefined;
	}
};

const parseRequest = (body: unknown): ChatRequest =>
	(typeof body === "string" && parseJson<ChatRequest>(body)) || {};

const readChunks = (text: string): CompletionChunk[] => {
	const trimmed = text.trim();
	if (!trimmed.startsWith("data:")) {
		const body = parseJson<CompletionChunk>(trimmed);
		return body ? [body] : [];
	}
	return trimmed
		.split("\n")
		.filter((line) => line.startsWith("data:"))
		.map((line) => line.slice(5).trim())
		.filter((payload) => payload && payload !== "[DONE]")
		.flatMap((payload) => parseJson<CompletionChunk>(payload) ?? []);
};

export const assemble = (chunks: CompletionChunk[]) => {
	let content = "";
	let finishReason: string | null = null;
	let promptTokens = 0;
	let completionTokens = 0;
	let error: string | null = null;
	const calls = new Map<number, CapturedToolCall>();

	for (const chunk of chunks) {
		if (chunk.error?.message) error = chunk.error.message;
		if (chunk.usage) {
			promptTokens = chunk.usage.prompt_tokens ?? promptTokens;
			completionTokens = chunk.usage.completion_tokens ?? completionTokens;
		}
		for (const choice of chunk.choices ?? []) {
			const delta = choice.delta ?? choice.message;
			if (choice.finish_reason) finishReason = choice.finish_reason;
			if (delta?.content) content += delta.content;
			for (const [position, call] of (delta?.tool_calls ?? []).entries()) {
				const index = call.index ?? position;
				const current = calls.get(index) ?? { id: "", name: "", arguments: "" };
				// Some providers repeat the name on every delta; only arguments stream.
				calls.set(index, {
					id: call.id ?? current.id,
					name: call.function?.name || current.name,
					arguments: current.arguments + (call.function?.arguments ?? ""),
				});
			}
		}
	}

	return {
		content,
		finishReason,
		promptTokens,
		completionTokens,
		error,
		toolCalls: [...calls.values()],
	};
};

const errorText = (error: unknown) =>
	error instanceof Error ? error.message : String(error);

// Records what crossed the wire, so a run is judged on that rather than on what the SDK made of it.
export const createCapture = (
	budget: { remaining: number },
	onExchange: (exchange: Exchange) => void = () => undefined,
) => {
	const exchanges: Exchange[] = [];
	const pending: Promise<void>[] = [];
	const watchdog = new AbortController();

	const record = (exchange: Exchange) => {
		exchanges.push(exchange);
		onExchange(exchange);
	};

	const fetch: typeof globalThis.fetch = async (input, init) => {
		watchdog.signal.throwIfAborted();
		if (budget.remaining <= 0) throw new Error("request budget exhausted");
		budget.remaining -= 1;

		const request = parseRequest(init?.body);
		const startedAt = performance.now();
		const base = {
			model: request.model ?? "",
			hasTools: (request.tools?.length ?? 0) > 0,
			hasResponseFormat: request.response_format !== undefined,
			toolResultsSent:
				request.messages?.filter((message) => message.role === "tool").length ??
				0,
			content: "",
			toolCalls: [],
			finishReason: null,
			promptTokens: 0,
			completionTokens: 0,
		};
		const elapsed = () => Math.round(performance.now() - startedAt);
		const signal = init?.signal
			? AbortSignal.any([init.signal, watchdog.signal])
			: watchdog.signal;

		let response: Response;
		try {
			response = await globalThis.fetch(input, { ...init, signal });
		} catch (error) {
			record({
				...base,
				routedVia: null,
				status: 0,
				durationMs: elapsed(),
				error: `request failed: ${errorText(error)}`,
			});
			throw error;
		}

		const routedVia = response.headers.get("x-routed-via");
		const recorded = response
			.clone()
			.text()
			.then((text) => {
				const assembled = assemble(readChunks(text));
				record({
					...base,
					...assembled,
					routedVia,
					status: response.status,
					durationMs: elapsed(),
					error:
						assembled.error ??
						(response.ok
							? null
							: `HTTP ${response.status}: ${text.slice(0, 300)}`),
				});
			})
			.catch((error: unknown) => {
				record({
					...base,
					routedVia,
					status: response.status,
					durationMs: elapsed(),
					error: `body read failed: ${errorText(error)}`,
				});
			});
		pending.push(recorded);

		return response;
	};

	return {
		fetch,
		exchanges,
		abort: () => watchdog.abort(),
		settle: async () => {
			await Promise.all(pending);
		},
	};
};
