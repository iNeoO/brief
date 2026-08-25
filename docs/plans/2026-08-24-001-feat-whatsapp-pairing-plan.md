---
title: "feat: Pair a reader's WhatsApp number by having them message us"
type: feat
status: implemented
date: 2026-08-24
origin: grill session with the user (no requirements document — see Sources & References)
---

# feat: Pair a reader's WhatsApp number by having them message us

## Overview

`brief` intends to deliver briefs over WhatsApp. Before anything can be sent, Meta requires an explicit opt-in that names the business and states what will be sent, and we need a phone number whose validity is proven.

This plan builds the pairing and nothing else: collecting the consent and the number, storing them with their evidence, and asking for them at the moment a reader has a reason to give them. No brief is sent.

The mechanism is inverted from what a settings form suggests. The reader does not type a number — they send us one message from WhatsApp, through a `wa.me` link carrying a consent sentence and a short code. The inbound webhook receives it, and the message's `from` field is a number we could not have forged.

## Problem Frame

**There is no delivery at all.** `message_jobs` is a scaffold (`docs/plans/2026-08-05-001`), `apps/message-worker/src/consumer.ts` and `ProcessingService.sendMessage` both log `"message delivery is not implemented, skipping"`, and nothing reads `subscriptions` from the pipeline. WhatsApp is therefore not an additional channel — it is the first one.

**An unverified number is a liability, not a minor defect.** A number typed by hand with one wrong digit means a daily brief sent to a stranger, who blocks or reports us; the sending number's quality rating falls until it is restricted. This is why a phone field plus a checkbox is not sufficient, and it is the whole reason the pairing exists.

**There is no consent dialogue to defer to.** Meta provides no OAuth-style authorisation screen. Opt-in is the business's own responsibility to collect, timestamp, and be able to produce.

## Requirements Trace

- **R1.** A reader can authorise WhatsApp from `/profile`, and see whether they have.
- **R2.** The stored number is proven to belong to the reader and to be reachable on WhatsApp.
- **R3.** The stored consent names Brief and says what will be sent, and its evidence is retrievable.
- **R4.** A reader is asked to pair at the moment it becomes meaningful, and is never blocked from acting.
- **R5.** A reader can withdraw the authorisation, from the site or from WhatsApp.
- **R6.** No message is sent to anyone who has not consented.
- **R7.** The webhook accepts nothing that is not signed by Meta.

## Scope Boundaries

Out of scope, deliberately:

- Sending briefs. `message_jobs.categoryJobId` is `unique`, so per-recipient fan-out needs a migration of its own — deferred in `docs/daily-pipeline-workflow.md` step 6, and still deferred here.
- Brief templates. Outside the 24h window a pushed brief is a pre-approved template, most likely `MARKETING`, whose variables accept neither newlines nor tabs. That constrains how a brief can be rendered and deserves its own plan.
- Delivery statuses (`sent`/`delivered`/`read`) and an event table.
- An email channel for briefs.

## Key Technical Decisions

| Decision | Choice | Reason |
|---|---|---|
| Provider | Meta Cloud API, directly | the only durable path; the pairing itself uses no template |
| Mechanism | `wa.me` click-to-chat | consent and a proven number arrive in one action, with no template to get approved and no outbound message before consent |
| Where state lives | own table `whatsapp_pairings` | `AGENT.md`: `user`/`account`/`verification` are "the library's tables, not domain entities". Avoids `additionalFields` on betterAuth, and avoids `session.cookieCache.maxAge` (5 min) serving a stale pairing state right after pairing |
| Pairing code | Redis, 15 min TTL | `createRedis()` already exists and Redis is already a hard dependency; expiry is free and no row needs cleaning up |
| Waiting state | none | no row means not paired. The state being waited on is the code, and it lives in Redis |
| Webhook | required | it is the mechanism, not an accessory |
| Ask trigger | after a **first** subscription | subscribing is never refused; the ask arrives with an immediate reason |
| Language | consent sentence localised FR/EN | it is a string in our own i18n dictionary, so it costs nothing. Unlike the emails-in-English decision, no `user.language` column is implied: the locale is carried through Redis with the code |
| Number validation | none | the reader never types a number, so there is nothing to normalise or validate |

## High-Level Technical Design

1. `/profile` calls `createWhatsappPairingLink`, which mints a code (`whatsapp:pairing:{code}` → `{userId, locale}`, TTL 15 min) and returns a `wa.me` URL whose prefilled text is the localised consent sentence plus the code.
2. WhatsApp opens with the message ready; the reader sends it.
3. `POST /api/whatsapp/webhook` verifies `X-Hub-Signature-256` against the raw body, extracts the code from the text, resolves it, and writes a `verified` row carrying `phoneNumber`, `optInAt`, `optInMessageId` and `optInText`.
4. It answers in WhatsApp with free-form text — the inbound message opened a 24h window, so no template is involved.
5. The page polls while waiting and flips to the paired state.

Two properties worth naming. The prefill is **editable**, so extraction matches the code alone and never the wording; every code contains a digit and extraction requires one, which is what stops a ten-letter word being read as a code. And `phoneNumber` is **unique**: a number that pairs again from another account is transferred rather than refused, because sending the message proves present control of it — refusing would leave the second account permanently unpairable.

## Implementation Units

**Phase A — schema.** `packages/common/src/constants/whatsapp.constant.ts`; `whatsapp_pairing_status` enum and `whatsapp_pairings` in `db/drizzle/src/db/schema.ts`, with a CHECK tying `opted_out_at` to the status; migration `20260824151212_oval_iceman`.

**Phase B — service.** `packages/services/src/modules/whatsapp/`: `whatsapp.helper.ts` (code generation and tolerant extraction, 11 unit tests), `whatsapp.service.ts` (`WhatsAppPairingService`: `startPairing`, `buildPairingUrl`, `findPairing`, `confirmPairing`, `optOut`, `deletePairing`, `sendPairingConfirmation`), `whatsapp.type.ts`. Exported from the barrel — the module loads neither better-auth nor resend.

**Phase C — webhook.** `apps/web/src/routes/api/whatsapp.webhook.ts`: `GET` answers `hub.challenge` after a constant-time token comparison; `POST` verifies the HMAC over the raw bytes, then handles inbound messages (pairing, and `STOP`/`ARRET`/`ARRÊT`/`UNSUBSCRIBE` as opt-out) and logs `failed` statuses. Always 200 once the signature checks out, since Meta retries anything else. The first HMAC verification in this repo. WhatsApp env block added to `apps/web/src/config/env.ts` — never to `packages/infra`, which parses at import for every worker.

**Phase D — profile.** `apps/web/src/libs/api/whatsapp.ts` (three server functions behind `authedMiddleware`), a `createWhatsappPairingLink` rule in `rate-limit.ts`, `apps/web/src/components/profile/whatsapp-section.tsx` as a fourth section of `/profile`, and `auth.profile.whatsapp.*` in both dictionaries.

**Phase E — the ask.** `topics.tsx` captures "was this their first subscription?" in `onMutate`, and on success redirects an unpaired reader to `/profile?redirect=/topics`. `profile.tsx` validates `redirect` and offers the way back through the existing `safeRedirectPath`.

**Phase F — copy and documentation.** The landing, method, closing and topics copy named email as the delivery channel; it now names WhatsApp, in both dictionaries. The profile identity lead no longer claims the account address is where briefs are sent — it is the sign-in address and nothing more. `AGENT.md` boundaries updated.

## System-Wide Impact

- One new table, additive; no backfill.
- `apps/web` gains seven required environment variables. It will refuse to boot without them, which is the house convention.
- The first public route in this repo that a third party calls, and the first that needs raw-body access.
- The site copy was rewritten to name WhatsApp as the delivery channel (`hero.rhythm`, `closing.note`, `method.page.details`, `nav`/`seo` sign-up description, `auth.topics.lead`, and the profile identity lead, which no longer claims briefs are sent to the account address). It now promises something nothing delivers on yet.

## Risks & Dependencies

- **A public HTTPS URL** is required in dev and in production. Unresolved.
- **Test numbers may not accept inbound messages from numbers outside the five-recipient allowlist.** Unverified, and the whole mechanism rests on it. First thing to test.
- **Production needs a verified business** and a dedicated number. Meta's verification takes days to weeks and is the project's critical path, not the code.
- The token shown on the API Setup page lasts 24 h; continuous development needs a System User token.

## Sources & References

- `docs/daily-pipeline-workflow.md` step 6 — why `message_jobs` has no retry column and no per-recipient fan-out.
- `docs/plans/2026-08-05-001-feat-message-job-base-plan.md` — the scaffold this plan still does not fill.
- `docs/design-prompt-v1.md` — the copy constraints the new UI follows.
- `.claude/skills/create-server-function/SKILL.md` — the server-function conventions used in Phase D.
