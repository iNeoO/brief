---
title: Scale audio brief word budget and chunk TTS to cover more articles
type: feat
status: implemented
date: 2026-08-05
deepened: 2026-08-05
---

# Scale audio brief word budget and chunk TTS to cover more articles

## Overview

The daily category-job audio brief is currently capped at a fixed `TARGET_SUMMARY_WORDS = 450` regardless of how many articles were selected, which in practice only leaves room for the LLM to develop about two stories. This plan scales that word budget with the number of selected articles (capped near a 5-minute audio ceiling), and makes `TextToSpeechHelper.textToAudio` transparently split oversized text into multiple OpenAI TTS calls, run them in parallel, and reassemble a single mp3 for upload — since OpenAI's speech API hard-rejects any single call over 4096 characters.

## Problem Frame

`ProcessingService.makeSummary` (packages/services/src/modules/processing/processing.service.ts:303-330) asks the LLM to write one continuous spoken-brief script covering the selected articles (up to `MAX_SELECTED_ARTICLES = 10`), aiming for `TARGET_SUMMARY_WORDS = 450` words total. In practice this budget is tight enough that the model develops roughly two stories in depth rather than covering more of the selection.

`TextToSpeechHelper.textToAudio` (packages/services/src/modules/tts/tts.helper.ts:16-50) sends the whole summary text to OpenAI's TTS API in a single call and throws `TTS_INPUT_TOO_LONG` if `text.length > MAX_TTS_INPUT_CHARS` (4096, packages/common/src/constants/files.constant.ts:16). Simply raising the word target without touching the TTS layer will eventually trip this hard limit once the script grows past roughly 2-3 stories' worth of text.

## Requirements Trace

- R1. The LLM should have room to cover more than ~2 articles per audio brief when more were selected, without producing an unbounded/oversized audio file.
- R2. The total audio length should stay bounded (user-specified ceiling: ~5 minutes; today's 450-word/3-minute brief is the known calibration point).
- R3. Text that exceeds OpenAI's single-call TTS character limit must be split into multiple calls and reassembled into one playable mp3, transparently to callers.
- R4. No change to the public shape callers rely on: `ProcessingService.createAudio` keeps calling `TextToSpeechHelper.textToAudio(summary, language)` and getting back `{ body, mimeType }`; `S3Service.uploadFile` keeps receiving exactly one body per job.

## Scope Boundaries

- No change to `RESUME_SYSTEM_PROMPT`'s content or structure rules (opening / headlines / stories / closing) — only the `targetWordCount` value passed into `buildResumeUserPrompt` changes. Explicitly not adding a "must cover every selected article" instruction (decided during grill: raising the budget is the fix being tried first; revisit only if it doesn't work in practice).
- No audio post-processing (no ffmpeg remux/normalize/crossfade) in this iteration. Chunk joins are raw byte concatenation, split at paragraph boundaries (natural speech pauses), accepted as good-enough for v1 and to be revisited only if a real generated brief has an audible glitch.
- No automated tests added for the new chunking/orchestration logic in this iteration — explicit product decision made during planning. Verification is manual: generate a real multi-chunk brief and listen to it.
- No change to `MAX_SELECTED_ARTICLES` (10) or to the article-selection prompt/logic — this plan only changes how much of the selection the summary step is allowed to use, and how the resulting text reaches the TTS API.
- Exact word-budget constants (base words, per-article words, max cap) are a first approximation calibrated from the one known data point (450 words ≈ 3 minutes). The user has explicitly signalled these will be tuned empirically after seeing real output — this plan is not the place to over-fit them.

## Context & Research

### Relevant Code and Patterns

- packages/services/src/modules/processing/processing.service.ts:27-28 — `MAX_SELECTED_ARTICLES` / `TARGET_SUMMARY_WORDS` constants; `makeSummary` (line 303) has `articles.length` available as the natural hook for scaling the word budget.
- packages/services/src/modules/processing/processing.prompt.ts:158-189 — `buildResumeUserPrompt` already takes `targetWordCount` as a parameter; no signature change needed there.
- packages/services/src/modules/tts/tts.helper.ts:16-50 — `TextToSpeechHelper.textToAudio`, the sole OpenAI TTS call site in the repo (confirmed via repo-wide grep). Owns the length check and the OpenAI client construction.
- packages/common/src/constants/files.constant.ts:13-16 — constants file pattern: one `as const` object (or standalone consts) per concern, each with a one-line "why" doc comment above it. `MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024` gives useful headroom context (an audio brief of a few MB is far under this ceiling).
- packages/common/src/constants/internalErrorCode.constant.ts:1-17 — flat `INTERNAL_ERROR_CODE` const object; `TTS_INPUT_TOO_LONG` and `TTS_NO_AUDIO` already exist and are reusable for this feature (no new error codes needed — see Key Technical Decisions).
- packages/services/src/modules/s3/s3.helper.ts:28-31 — `toNodeStream` shows the repo's idiom for normalizing a web `ReadableStream` vs a Node `Readable` (`Readable.fromWeb`). packages/services/src/modules/s3/s3.type.ts defines `FileBody = Readable | ReadableStream<Uint8Array>`, so a concatenated `Buffer` wrapped via `Readable.from(buffer)` satisfies the existing upload contract with zero changes to `S3Service`.
- packages/services/src/modules/s3/s3.helper.test.ts — colocated `*.test.ts`, Vitest, no mocking library, asserts on real streams. Kept here only as a reference in case tests are added later; not used in this iteration per the scope boundary above.
- packages/services/src/modules/ingestion/url.helper.ts and packages/services/src/modules/processing/processing.aiLogger.ts — confirm the repo's real granularity norm is one file per *concern*, not per module: both are small (~15-20 line) pure/single-purpose files split out from their sibling service file. This directly supports Unit 2 splitting the text splitter into its own file rather than folding it into `tts.helper.ts`.
- Verified against the actual installed SDK (`openai@7.3.0`, resolved in the lockfile): `client.audio.speech.create(...)` sets `__binaryResponse: true` internally and resolves to the raw, unwrapped web-standard `Response` object (`resources/audio/speech.ts` / `internal/parse.ts` in the installed package) — so `.arrayBuffer()` is a directly available, idiomatic, fully-safe way to drain it, and calling the same `OpenAI` client instance concurrently from multiple chunks carries no shared-mutable-state risk (each `create()` call is an independent request; pooling is delegated to `fetch`/undici). This removes any doubt about Unit 3's core technical approach.
- docs/daily-pipeline-workflow.md:172-176 (Step 5: create audio) — the worker sends `category_jobs.summary` to the TTS provider and upserts one `files` row per `(categoryJobId, kind, language)`; the unique constraint makes audio generation idempotent at the metadata level. This plan preserves that contract by design: chunking still produces exactly one `uploadFile` call per job/language.

### Institutional Learnings

No `docs/solutions/` directory exists in this repo, so there is no past-incident record for TTS, audio chunking, or mp3 concatenation to cross-reference — this plan establishes first-time patterns here, not avoiding a repeat mistake.

One thing worth surfacing explicitly rather than silently reversing: both `tts.helper.ts`'s docstring ("the response body is streamed straight through to storage, so a long brief never lands in the worker's memory whole") and `s3.service.ts`'s upload comment encode a deliberate zero-buffering design. This plan buffers each TTS chunk's mp3 response in memory before concatenating — see Key Technical Decisions for the explicit rationale, and Unit 3 updates the stale docstring accordingly so a future reader doesn't mistake the new behavior for an oversight.

### External References

None consulted — the OpenAI TTS integration pattern is already established in this codebase (single call site, well understood), and the chunking/concatenation approach was fully resolved during the grill session against this repo's own conventions and constraints (4096-char hard limit, 50MB soft ceiling, existing `FileBody` contract).

## Key Technical Decisions

- **Word budget scales with selection size, capped at an audio-length ceiling**: `targetWordCount = min(BASE_SUMMARY_WORDS + articles.length * WORDS_PER_ARTICLE, MAX_SUMMARY_WORDS)`, calibrated so `targetWordCount(2) ≈ 450` (today's known-good 3-minute baseline) and the cap lands near `MAX_SUMMARY_WORDS = 750` words (~5 minutes at the ~150 words/minute rate implied by the 450-word/3-minute data point). Concrete constants proposed: `BASE_SUMMARY_WORDS = 190`, `WORDS_PER_ARTICLE = 130`, `MAX_SUMMARY_WORDS = 750`. Rationale: a flat bump (e.g. 450 → 900) would either stay tight for a big selection or pad a thin one; scaling with `articles.length` self-adjusts and reuses the one real data point available instead of guessing a single new constant. Per the scope boundary, these three numbers are a starting point to be tuned once real output is heard.
- **TTS chunking is transparent inside `TextToSpeechHelper`, no signature change**: `textToAudio(text, language)` still returns `{ body, mimeType }`. All chunking, parallel calls, and reassembly happen internally. Rationale (resolved in grill): character-limit chunking is an OpenAI API implementation detail, not a job-orchestration concern — `processing.service.ts` should not need to know or care that the TTS layer sometimes makes more than one call.
- **Chunk boundaries follow paragraph structure, not fixed character counts**: the script produced by `RESUME_SYSTEM_PROMPT` already has a clear paragraph structure (opening / headlines / one paragraph per story / closing, blank-line separated — packages/services/src/modules/processing/processing.prompt.ts:123-131). Consecutive paragraphs are packed into a chunk while the running length stays under a safety threshold (`TTS_CHUNK_SAFE_CHARS`, kept below the hard `MAX_TTS_INPUT_CHARS`), and a new chunk starts rather than ever splitting a paragraph mid-way. This means every chunk boundary lands on a natural speech pause.
- **Sentence-level fallback for an oversized single paragraph**: if one paragraph alone exceeds the safety threshold (expected to be rare given the new per-article word budget, but not impossible), it is re-split at sentence boundaries (`. `, `! `, `? `) instead of failing. This is still a natural-language boundary, never a mid-word cut.
- **A global hard cap on total text length is kept, independent of the requested word budget**: reusing the existing `TTS_INPUT_TOO_LONG` error code and check, but redefining what it guards — instead of gating a single TTS call, it now gates the full script length before chunking (`MAX_TTS_TOTAL_CHARS`, sized generously above the expected ~2-chunk case to tolerate normal variance, e.g. 4x `TTS_CHUNK_SAFE_CHARS`). Rationale: if the LLM ignores the word-count guidance and returns something an order of magnitude too long, the system should fail loudly (as it does today) rather than silently generate an unbounded number of chunks and TTS calls.
- **Chunks are generated in parallel and buffered in memory before one upload**: each chunk's OpenAI TTS call runs concurrently (`Promise.all`), each response is fully read into a `Buffer` (via the SDK response's `arrayBuffer()`), the buffers are concatenated in chunk order, and the result is wrapped as a single `Readable` (`Readable.from(buffer)`) passed to the unchanged `S3Service.uploadFile`. Rationale: this reverses the codebase's existing zero-buffering design intent, and that reversal is deliberate — the total audio for a several-minute brief is a few MB, far under the existing `MAX_FILE_SIZE_BYTES` (50MB) ceiling that `countedBody` already enforces on the upload side, so buffering it is bounded and safe. Parallel execution keeps latency at the slowest single chunk rather than the sum of all chunks; in-order concatenation is why buffering (rather than pure streaming) is the pragmatic choice — reassembling a strictly ordered stream from calls that can complete in any order would add real complexity for no benefit at this size.
- **Raw concatenation for chunk joins, no audio post-processing**: accepted for v1 since splits land on paragraph boundaries (natural pauses); to be revisited only if a real generated brief has an audible glitch (grill decision).
- **No new `INTERNAL_ERROR_CODE` entries**: `TTS_INPUT_TOO_LONG` (repurposed to guard total length pre-chunking) and `TTS_NO_AUDIO` (already per-response, reused per-chunk) cover every failure path this feature introduces.

## Open Questions

### Resolved During Planning

- Where the chunking logic lives → entirely inside the `tts` module, `processing.service.ts` unchanged in its call to `createAudio`/`textToAudio`.
- Whether to reinforce the "cover every article" instruction in `RESUME_SYSTEM_PROMPT` → no, out of scope for this iteration (see Scope Boundaries).
- Whether to keep a global safety ceiling independent of the LLM's requested word count → yes, reusing the existing `TTS_INPUT_TOO_LONG` code.
- Whether to add automated tests for the new chunking function → no, explicit product decision for this iteration.

### Deferred to Implementation

- Exact values of `BASE_SUMMARY_WORDS`, `WORDS_PER_ARTICLE`, `MAX_SUMMARY_WORDS`, `TTS_CHUNK_SAFE_CHARS`, and `MAX_TTS_TOTAL_CHARS` are proposed in this plan but explicitly expected to be tuned after listening to real generated briefs — this is a deliberate, user-requested deferral, not an oversight.
- Whether the raw-concatenation joins are actually audible as glitches in practice — to be judged by ear once real multi-chunk audio exists, not decidable from the plan alone.

## High-Level Technical Design

```
processing.service.ts (makeSummary)
  targetWordCount = min(BASE + articles.length * PER_ARTICLE, MAX)
        │
        ▼
  LLM writes script (unchanged prompt structure, longer budget)
        │
        ▼
tts.helper.ts (textToAudio)
  1. guard: total text length <= MAX_TTS_TOTAL_CHARS, else throw TTS_INPUT_TOO_LONG
  2. splitTextForTts(text) -> paragraph-packed chunks (sentence fallback if needed)
  3. Promise.all(chunks.map callOpenAiTts)   // parallel, order preserved by array index
  4. Buffer.concat(chunks[0..n].arrayBuffer) // in chunk order
  5. Readable.from(concatenatedBuffer)
        │
        ▼
S3Service.uploadFile (unchanged) — single body, single upsert row
```

## Implementation Units

- [ ] **Unit 1: Add chunking/safety constants**

**Goal:** Introduce the new constants the chunking logic needs, following the existing `files.constant.ts` pattern.

**Requirements:** R3

**Dependencies:** None

**Files:**
- Modify: `packages/common/src/constants/files.constant.ts`

**Approach:**
- Add `TTS_CHUNK_SAFE_CHARS` (packing threshold used by the splitter, kept comfortably under `MAX_TTS_INPUT_CHARS`) and `MAX_TTS_TOTAL_CHARS` (pre-chunking safety ceiling on the full script, sized as a multiple of `TTS_CHUNK_SAFE_CHARS`), each with a one-line "why" doc comment matching the style already above `MAX_TTS_INPUT_CHARS`.
- Do not change `MAX_TTS_INPUT_CHARS` itself — it remains the true hard per-call ceiling; the new constants sit around it.

**Patterns to follow:**
- packages/common/src/constants/files.constant.ts:9-16 (one-line doc comment per constant, `as const` / plain `export const` style already used there).

**Test scenarios:**
- Test expectation: none — plain constant values, no behavior to assert.

**Verification:**
- New constants export cleanly from `@brief/common/constants` (barrel file already re-exports the whole module).

- [ ] **Unit 2: Paragraph/sentence text splitter**

**Goal:** A pure function that splits an arbitrary script into TTS-safe chunks, preferring paragraph boundaries and falling back to sentence boundaries for an oversized single paragraph.

**Requirements:** R3

**Dependencies:** Unit 1 (constants)

**Files:**
- Create: `packages/services/src/modules/tts/tts.chunk.ts`

**Approach:**
- Export a function (e.g. `splitTextForTts(text: string): string[]`) that: splits `text` on blank-line paragraph breaks, greedily packs consecutive paragraphs into a chunk while the running length stays under `TTS_CHUNK_SAFE_CHARS`, and starts a new chunk rather than splitting a paragraph.
- If a single paragraph alone exceeds `TTS_CHUNK_SAFE_CHARS`, re-split that paragraph at sentence boundaries (`. `, `! `, `? `) and pack those pieces the same greedy way.
- When the whole text already fits in one chunk (the common case today), return a single-element array — this keeps the single-call path behaviorally unchanged for short briefs.
- No I/O, no OpenAI/env dependency in this file — kept pure and self-contained so it can be unit-tested later even though tests are out of scope now.

**Patterns to follow:**
- No existing local pattern for text splitting (confirmed via repo-wide search) — this is new code; keep it a small standalone pure function rather than folding it into `tts.helper.ts`, mirroring how `s3.helper.ts` holds pure helpers separately from the I/O-performing `s3.service.ts`.

**Test scenarios:**
- Test expectation: none — explicit product decision to skip automated tests this iteration. Manual verification instead (see Unit 3's Verification).

**Verification:**
- Feeding a short script (under `TTS_CHUNK_SAFE_CHARS`) returns exactly one chunk equal to the input.
- Feeding a multi-paragraph script long enough to need splitting returns chunks that, concatenated back together (accounting for the paragraph separators), reconstitute the original text with no words lost or duplicated.

- [ ] **Unit 3: Orchestrate parallel TTS calls and reassembly in `TextToSpeechHelper`**

**Goal:** Make `textToAudio` transparently handle text of any length: guard the total against `MAX_TTS_TOTAL_CHARS`, split it via Unit 2's function, call OpenAI TTS for every chunk in parallel, buffer and concatenate the results in order, and return a single body.

**Requirements:** R3, R4

**Dependencies:** Unit 1, Unit 2

**Files:**
- Modify: `packages/services/src/modules/tts/tts.helper.ts`

**Approach:**
- Replace the current `text.length > MAX_TTS_INPUT_CHARS` guard with a `text.length > MAX_TTS_TOTAL_CHARS` guard (same `TTS_INPUT_TOO_LONG` error code, updated message wording since it no longer refers to a single call).
- Call `splitTextForTts(text)` to get an ordered list of chunks.
- For each chunk, call `client.audio.speech.create(...)` exactly as today (same model/voice/speed/instructions handling), in parallel via `Promise.all`; keep the existing `TTS_NO_AUDIO` check per response.
- Read each chunk's response fully via `arrayBuffer()`, wrap in `Buffer.from(...)`, and `Buffer.concat` all of them in chunk order (array order from `Promise.all` already preserves input order regardless of resolution order).
- Wrap the final buffer with `Readable.from(buffer)` as the returned `body`; `mimeType` unchanged (`MIME_TYPE.MP3`).
- Update the stale docstring above `textToAudio` (currently claims the response is "streamed straight through... never lands in the worker's memory whole") to describe the new, intentionally-bounded buffering behavior and why it's safe at this size (see Key Technical Decisions).
- Keep the OpenAI client construction and per-request options (`model`, `voice`, `speed`, conditional `instructions`) exactly as they are today — only the single-call shape becomes a per-chunk shape.
- Log the chunk count via the existing `getLoggerStore()` pattern (alongside the current `TTS_NO_AUDIO` error-path logging) so that a single logical brief fanning out into 1-4 concurrent OpenAI calls is visible in logs, not silently invisible behind the unchanged `textToAudio` signature (confidence-check finding: this boundary is the right one, but needs an observability hook so a future maintainer investigating OpenAI call volume or per-job latency isn't blind to the fan-out).

**Patterns to follow:**
- packages/services/src/modules/s3/s3.helper.ts:28-31 (`toNodeStream`) for the `Readable`-from-buffer idiom, and packages/services/src/modules/s3/s3.type.ts's `FileBody` union confirming a plain `Readable` is an accepted upload body with zero downstream changes.
- Existing error-handling shape in this same file (packages/services/src/modules/tts/tts.helper.ts:38-47) for how to raise `TTS_NO_AUDIO` per response.

**Test scenarios:**
- Test expectation: none — explicit product decision to skip automated tests this iteration.

**Verification:**
- A short summary (single chunk) still produces a valid playable mp3 uploaded and stored exactly as before — no regression on the common case.
- A summary long enough to require 2+ chunks produces one uploaded mp3 file whose total duration and content audibly covers all the chunks in the right order, with no obviously broken join at the paragraph boundaries where chunks were split.
- A summary exceeding `MAX_TTS_TOTAL_CHARS` throws `TTS_INPUT_TOO_LONG` before any OpenAI call is made.

- [ ] **Unit 4: Scale the summary word budget with selection size**

**Goal:** Replace the fixed `TARGET_SUMMARY_WORDS` with a formula that grows with the number of selected articles, capped near the 5-minute ceiling.

**Requirements:** R1, R2

**Dependencies:** Unit 3 (the TTS layer must be ready to handle a script long enough to need chunking before this unit can safely increase how long that script gets)

**Files:**
- Modify: `packages/services/src/modules/processing/processing.service.ts`

**Approach:**
- Replace the `TARGET_SUMMARY_WORDS = 450` constant with `BASE_SUMMARY_WORDS`, `WORDS_PER_ARTICLE`, and `MAX_SUMMARY_WORDS` (proposed values: 190, 130, 750 — see Key Technical Decisions for the calibration).
- In `makeSummary`, compute `targetWordCount = Math.min(BASE_SUMMARY_WORDS + articles.length * WORDS_PER_ARTICLE, MAX_SUMMARY_WORDS)` and pass it to `buildResumeUserPrompt` in place of the old fixed constant.
- No change to `buildResumeUserPrompt`'s signature or to `RESUME_SYSTEM_PROMPT` (scope boundary).

**Patterns to follow:**
- packages/services/src/modules/processing/processing.service.ts:303-330 (`makeSummary`'s existing shape and its call into `buildResumeUserPrompt`).

**Test scenarios:**
- Test expectation: none — explicit product decision to skip automated tests this iteration.

**Verification:**
- A category job with a small selection (e.g. 2 articles) produces a script in the same ballpark as today's ~450-word/3-minute brief.
- A category job with a larger selection (e.g. 6-8 articles) produces a noticeably longer script that covers more of the selected stories, while the resulting audio stays at or under ~5 minutes.

## System-Wide Impact

- **Interaction graph:** Only two call sites change behavior: `ProcessingService.makeSummary` (which `targetWordCount` it computes) and `TextToSpeechHelper.textToAudio` (how it turns text into an audio body). `ProcessingService.createAudio` (processing.service.ts:126-148) and `S3Service.uploadFile` are untouched — both still see exactly one `textToAudio` call and one `uploadFile` call per job/language, so the idempotent-upsert contract described in docs/daily-pipeline-workflow.md:172-176 holds automatically.
- **Error propagation:** If any individual TTS chunk call fails (OpenAI error, network issue, or a chunk response missing a body), `Promise.all` rejects and the whole `createAudio` step throws, exactly as a single-call failure does today — no partial audio is ever uploaded, since concatenation and upload only happen after every chunk has resolved. Confirmed via `categoryJobs.service.ts:145-181` (`completeStep`) and `:251-283` (`incrementRetry`) plus `processing.service.ts:53-66` (`runCategoryJob` resumes at `job.state`): a failure in `creating_audio` only increments retry and keeps `state` at `creating_audio`, so a retry re-enters at `createAudio` and re-runs the whole set of chunk calls — it never re-runs `createReport`/the LLM summary step. This is data-safe (no partial audio), but not cost-neutral: unlike today's single call, a mid-flight chunk failure discards the *successful* sibling chunks' already-incurred TTS work, and each retry regenerates every chunk again — so a flaky failure now wastes more OpenAI calls per retry than the old single-call path did. Not a reason to change the approach (switching to sequential calls or `Promise.allSettled` adds real complexity for a rare failure mode), but worth naming explicitly rather than implying full equivalence with today's failure behavior.
- **State lifecycle risks:** None new. The `files` table upsert key (`categoryJobId`, `kind`, `language`) and the delete-previous-object-on-key-change logic in `S3Service.uploadFile` are unaffected — this feature only changes how the uploaded body is assembled before that call, not the upload/versioning logic itself.
- **API surface parity:** `TextToSpeechHelper.textToAudio` is confirmed (via repo-wide search) to have exactly one call site, so there is no other interface needing the same treatment.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Buffering every chunk fully in memory reverses the codebase's existing zero-buffering design intent for TTS/upload bodies. | Accepted deliberately: total audio for a several-minute brief is a few MB, far under the existing 50MB `MAX_FILE_SIZE_BYTES` ceiling already enforced by `countedBody` on the upload side. Documented explicitly in code comments and in this plan so it reads as an intentional trade-off, not an oversight. |
| Raw byte concatenation of independently-generated mp3 chunks could produce an audible click/gap at chunk joins. | Splits always land on paragraph boundaries (natural speech pauses), which minimizes the chance of an audible glitch. Accepted for v1; revisit with real audio post-processing only if a generated brief actually sounds broken. |
| The LLM ignores the word-budget guidance and returns a script far longer than requested, multiplying TTS calls/cost. | `MAX_TTS_TOTAL_CHARS` hard-fails the request before any OpenAI call is made, preserving today's fail-loud behavior (same `TTS_INPUT_TOO_LONG` code). |
| Parallel TTS calls per job increase concurrent OpenAI API usage, and this compounds with existing cross-job concurrency. Confirmed via `packages/infra/src/amqp/baseConsumer.ts:55`: each `category-worker` process already runs up to 5 category jobs concurrently (AMQP prefetch default, not overridden in `apps/category-worker/src/consumer.ts`). This feature multiplies each in-flight job's OpenAI TTS calls from 1 to up to ~4, so worst case is ~5 × 4 = 20 simultaneous OpenAI TTS calls per worker process — times however many worker replicas run in production (replica count is external to this repo and could not be determined). Category volume is also uncapped in code: one job per enabled `categories` row, once/day (`apps/scheduler/src/index.ts:7-41`), so the real daily job count is data-driven, not bounded by code. | This is a pre-existing concurrency pattern (prefetch=5) that this feature multiplies rather than introduces — not a reason to hold the feature, but a concrete number to watch. If OpenAI rate limits are hit in production, the fix is orthogonal to this plan (lower the AMQP prefetch, or cap concurrent chunk calls within `textToAudio` with a small semaphore) and should be a follow-up informed by real usage, not speculative work now. |
| Proposed word-budget constants (`BASE_SUMMARY_WORDS`, `WORDS_PER_ARTICLE`, `MAX_SUMMARY_WORDS`) are derived from a single historical data point and may not hold up across categories/languages. | Explicitly called out as a deferred-tuning item; the user has already signalled these will be adjusted after listening to real output. |

## Sources & References

- Origin: no upstream requirements document — planned directly from user request, grounded by an interactive design-resolution ("grill") session covering word-budget scaling, chunk boundary strategy, the oversized-paragraph fallback, the global safety ceiling, parallel-vs-sequential TTS calls, buffering vs. streaming, chunk-join quality, code placement, and test scope.
- Related code: packages/services/src/modules/processing/processing.service.ts, packages/services/src/modules/processing/processing.prompt.ts, packages/services/src/modules/tts/tts.helper.ts, packages/services/src/modules/s3/s3.service.ts, packages/services/src/modules/s3/s3.helper.ts, packages/services/src/modules/s3/s3.type.ts, packages/common/src/constants/files.constant.ts, packages/common/src/constants/internalErrorCode.constant.ts.
- Related docs: docs/daily-pipeline-workflow.md (Step 5: create audio).
