---
name: add-rss-provider
description: Adds a news medium to the brief ingestion pipeline as an RSS provider — feed discovery, a robots.txt legality gate, a harness that runs the real connector against the live feed, the SEED_PROVIDERS entry and the smoke test. Use when the user names a media outlet to support, pastes a feed URL, asks to add/replace/drop a news source, or when an existing provider stops producing articles.
---

# Add an RSS Provider

## Purpose

A provider is one row in `SEED_PROVIDERS`
(`packages/common/src/constants/providers.constant.ts`) — name, slug, url, kind.
`RssConnector` handles every RSS feed, so adding a medium is **verification work,
not implementation work**: a four-line entry plus the evidence it belongs there.
That one list feeds two consumers, so it can never drift:

| Consumer | File |
| --- | --- |
| Seed (idempotent on slug) | `db/drizzle/src/scripts/seedProviders.ts` |
| Network smoke test | `packages/services/.../rss.connector.smoke.test.ts` |

## Gate order — legality first

Run the robots.txt gate **before** any technical work. A blocked medium is
dropped whatever its feed quality, so verifying it first is wasted effort.

**What binds us.** The pipeline is an ordinary crawler — an application a human
configures, running Node's `fetch` under its default user-agent. It is **not**
`ClaudeBot` or `anthropic-ai`; those tokens address Anthropic's own bots, and
robots.txt is a per-user-agent protocol. Code written with Claude does not make the
process ClaudeBot. Only two things bind us: the **`User-agent: *` group** and
**unscoped prose**.

Verdict **BLOCKED** if either:

1. **A prose prohibition** — scraping, TDM, AI training *or inference*, RAG, or
   commercial reuse. Comments bind everyone. Read them against what the pipeline
   does: it fetches bodies and feeds them to an LLM **at inference time**, and
   trains nothing. A clause banning only *training*, or only *commercial* use of a
   non-commercial deployment, does not bite — surface it, do not drop reflexively.
2. **The wildcard group disallows the feed or the article paths** —
   `Disallow: /*.rss`, or the exact feed path. If the only feed the site advertises
   is disallowed, reaching it through an alias is circumvention. DROP. A
   *different*, genuinely permitted feed is fine.

Verdict **OK** otherwise. A blocklist naming `ClaudeBot` is a **stance signal, not
a block** — quote it, never drop on it alone. `Content-Signal:` is machine-readable
prose: `ai-input` covers RAG/grounding (us), `ai-train` covers training (not us) —
read the file's own definitions before ruling.

If robots.txt is unreadable (bot mitigation), the gate is **unresolved** → drop.
Never work around a wall to reach it.

See [REFERENCE.md](REFERENCE.md) for the worked verdicts and the RFC 9309 trap.

## Workflow

1. **Find the feed.** Grep the homepage for
   `<link rel="alternate" type="application/rss+xml">`. No autodiscovery is common
   — probe `/feed`, `/rss`, `?page=backend` (SPIP), or a `rss.<host>` subdomain.
2. **robots.txt gate.** `curl -s https://<host>/robots.txt` and read it *in full*,
   comments and trailing groups included. Quote the decisive lines verbatim.
3. **Run the harness** — it executes the real connector logic against the live feed:
   ```sh
   node .claude/skills/add-rss-provider/scripts/verify-feed.mjs "<feedUrl>" "<Label>"
   ```
   It parses RSS. `PARSE_FAIL` with an Atom `rootTag` means use the Atom kind,
   not that the medium is unusable.
   Read `verdict`, then `dateSource`, `chronological`, `pathMix`,
   `replacementChars` and each `contentHead`. [REFERENCE.md](REFERENCE.md) maps
   every failure signal to its cause.
4. **Add the entry** to `SEED_PROVIDERS`. Slug is lowercase kebab-case and is the
   provider's identity — pick it once.
5. **Rebuild `@brief/common`, then smoke-test.** The test reads `dist`:
   ```sh
   pnpm --filter @brief/common build
   pnpm --filter @brief/services test:smoke
   ```
   Skipping the build silently tests the *old* list and still reports green.
6. **Report** each medium ADD or DROP with its evidence. Never soften a DROP.

## Rules

- **Pick the right `kind`.** RSS and Atom each have a connector; set
  `kind: CONNECTOR_KIND.ATOM` on an Atom feed rather than dropping it. A format
  with no connector (RDF, JSON Feed) is a DROP for this task — feedsmith parses
  them, but a new kind means a `pgEnum` migration and is its own commit.
- **Every item needs a date.** `pubDate`, or `dc:dates` for SPIP feeds — the
  connector falls back. The smoke test asserts `publishedAt instanceof Date`.
- **`fetchLimit` is 5, and the connector takes the first 5 items.** So feed
  *order* and feed *mix* decide what actually gets ingested. An unsorted feed or
  one that is half TV listings will starve the brief while reporting PASS.
- **Check freshness before anything else in the output.** A feed can be abandoned
  while the site keeps publishing — compare `newestItem` to today. Brut's feeds
  scored PASS with content 14 months old.
- **Judge the article body, not the feed.** A feed can parse perfectly while every
  page behind it returns a paywall, a cookie wall or a JS stub.
- **Do not add a connector variant, a link filter or a charset fix** to make one
  medium fit. That is a separate change with its own commit — say so and move on.
- **Seeding is `onConflictDoNothing` on slug** — changing a URL after seeding needs
  a manual `UPDATE providers SET url = … WHERE slug = …`.
- **A provider on no enabled category is never fetched** — the scheduler collects
  provider ids from enabled categories only. Admins wire that in the UI.
- Use parallel subagents past three media; give each the gate rules and the harness
  path, and forbid repo edits.
