# AI Act — Transparency

## Scope

`brief` is a generative AI system: a language model selects the day's articles and
writes the summary, a speech model voices it, and the result is published on the
web and delivered on Telegram. This document records which obligations of
Regulation (EU) 2024/1689 apply to it, what was verified, and what was
deliberately not built.

It is an engineering record, not legal advice.

## What applies, and what does not

| Obligation | Applies | Since |
| --- | --- | --- |
| Art. 5 — prohibited practices | No | 2 Feb 2025 |
| Art. 4 — AI literacy | Yes, as a deployer | 2 Feb 2025 |
| Chapter V — GPAI provider duties | No, we train no model | 2 Aug 2025 |
| Art. 50(2) — machine-readable marking | Yes, as a downstream provider | 2 Aug 2026 |
| Art. 50(4) — disclosure of AI-generated public-interest text | Yes, as a deployer | 2 Aug 2026 |
| Annex III — high-risk | No | deferred to 2 Dec 2027 |

Nothing here is high-risk: summarising press articles appears in no Annex III
category. The two live obligations are both in Article 50.

Art. 50(4) applies because the briefs are **published**, not sent privately:
`/briefs/$id` has no authentication, the page emits `NewsArticle` JSON-LD, and the
briefs are listed in `sitemap.xml`. That is AI-generated text published to inform
the public on matters of public interest, with no human editorial review — the
exact case the second subparagraph describes.

## Art. 50(2) — marking: nothing to build

Verified on 2026-09-04 against a production file
(`/api/briefs/audio/01a06acb-5109-719e-abe4-c48ff1e006bb`, 426 s, MP3 128 kbps):

- **No C2PA, no ID3.** The file opens on a bare MPEG frame sync, contains zero
  occurrences of `ID3`, `c2pa` or `jumbf`, and `ffprobe` reports no format tag.
- **SynthID present.** OpenAI's verification tool identifies the generating model
  (`gpt-4o-mini-tts-api-ev3`) and the generation timestamp from a file carrying no
  metadata at all, so the signal is in the waveform.
- **The delivered copy is marked too.** The same check on a second brief pulled
  back out of Telegram detects the same model and timestamp. Telegram does not
  transcode: the file arrives as 128 kbps / 24 kHz / mono, the parameters the
  speech API returns, with no ID3 tag added.

OpenAI has applied SynthID to audio generated through the API since 31 July 2026.
The mark therefore arrives already made, and it survives our whole chain:
`TTS_CHUNK_SAFE_CHARS` splitting, the `Buffer.concat` in `tts.helper.ts`, S3
storage, HTTP delivery, and lossless `ffmpeg -c copy` slicing.

A downstream provider does not shed its own obligation by relying on an upstream
solution, but here the obligation reduces to **preserving the mark and being able
to show it**, which the verification above does. So:

- we add no C2PA manifest and no watermark of our own;
- any change to the TTS path that re-encodes, normalises or mixes the audio must
  be re-verified with the same tool before it ships.

One known gap, accepted: SynthID is detectable only through OpenAI's tool, which
is a fair question under the "interoperable" criterion. That one is contractual
rather than technical — it rests on the provider's provenance warranty, not on
anything this repository can do.

The **text** is marked by nobody, upstream or here. Machine-readable marking of
text has no credible state of the art at this scale, which Article 50(2)'s
feasibility and cost clause accommodates. What we do instead is state it
explicitly in the page metadata (see below).

## Art. 50(4) — disclosure: implemented

The disclosure has to be clear, distinguishable, and given no later than the first
exposure. It was previously only in the terms, under *Responsabilité éditoriale* —
present, but not where a reader meets the content. It now sits in three places:

- **The brief page** — `apps/web/src/routes/briefs/$id.tsx`, above the player and
  above the script, since both are generated. Copy in
  `briefs.detail.aiDisclosure`.
- **The Telegram caption** — `AI_DISCLOSURE[language]`, appended by `buildCaption`
  to the caption that opens the reader's day, alongside the announcement line. One
  disclosure per day rather than one per topic: the day's later captions carry the
  topic alone, and the reader who opens only those meets the statement on the
  file itself (below) rather than in the chat.
- **The page metadata** — an `aiGenerated` `PropertyValue` in the `NewsArticle`
  JSON-LD. schema.org has no field for "written by a model"; `additionalProperty`
  is the one place that takes the claim without inventing a type. `author` stays
  the organisation, which does take responsibility for publishing.
- **The audio file itself** — an ID3v2.3 `COMM` frame written by `tts.tags.ts`.
  A brief that has been forwarded out of Telegram twice has left every one of the
  three carriers above; the file is what is left. The tag is prepended to the
  frames and never interleaved with them, so the SynthID signal is untouched — the
  audio bytes are the ones the speech API returned.

All four read from `AI_DISCLOSURE`, keyed by the brief's language rather than the
reader's: the statement rides on the content.

## Art. 4 — AI literacy

A one-person project. The obligation is to ensure a sufficient level of AI
literacy among the people operating the system; this document is part of
discharging it.
