# Add an RSS Provider — Reference

Every example below was observed on a live feed, not inferred.

## robots.txt — worked verdicts

| Medium | Verdict | Why |
| --- | --- | --- |
| ZDNET | BLOCKED | Unscoped prose header bans TDM, *"development or operation of artificial intelligence … including … retrieval-augmented generation"* and *"any commercial purposes"*. The wildcard group allowed `/article/`; the prose still binds. |
| La Presse | BLOCKED | Unscoped prose: *"Toute autre utilisation n'est pas autorisée … pour les grands modèles de langage (LLM), l'apprentissage automatique"*. Covers inference, not just training. |
| Le Devoir | BLOCKED | Same wording and dual mechanism as La Presse — a Québec-press template. The prose is what binds; the four `Claude*` groups are stance only. |
| Actu.fr | BLOCKED *(conditional)* | Unscoped CGU prose — but every limb is qualified: extraction and TDM *"à des fins commerciales"*, AI only *"afin de développer ou d'entraîner"*. We do not train. Whether it bites depends on whether the deployment is commercial — **surface it, let the owner rule**. |
| Sciences et Avenir | BLOCKED | `User-agent: *` carries `Disallow: /*.rss` and `Disallow: /*.atom`. Every feed on the host is off-limits to everyone. Its three `Claude*` groups are irrelevant to the verdict. |
| Basta! | BLOCKED | `User-agent: *` carries `Disallow: /spip.php?page=backend*` — the site's only advertised feed. `/?page=backend` is the identical SPIP resource under a spelling the pattern misses; using it is circumvention. |
| Futura | **OK** | Initially misjudged as blocked on its `ClaudeBot` group. The binding group is the wildcard, and it carries `Content-Signal: ai-train=no, search=yes, **ai-input=yes**` — and the file defines `ai-input` as *"real-time content for AI (RAG, grounding)"*. It expressly permits our use and forbids only training. Section 2 is headed *"BOTS IA DE RECHERCHE ET ASSISTANCE (AUTORISÉS)"*. |
| The Conversation FR | **OK** | No comment lines at all, so no prose; the wildcard group leaves articles reachable. Seeded with `kind: ATOM`. |
| Frandroid | OK, with a catch | `User-agent: *` disallows `/actualites/feed` — that news-only feed is off-limits. The general `/feed` is a different, permitted resource. Read the wildcard group before picking a feed URL. |
| Euractiv | OK | `User-agent: *` disallows `/feed/`, but matching is anchored at the path start, so `/fr/feed/` is untouched — and it is a genuinely different resource, not an alias. No AI blocklist of any kind. |
| Radio-Canada, RTBF, Slate | OK | Long named-AI-bot blocklists (incl. `anthropic-ai`), wildcard group untouched, no prose. Stance signal only — not a block. |

**Named Claude bots are never the verdict.** `ClaudeBot`, `anthropic-ai`,
`Claude-Web`, `Claude-User` and `Claude-Code` address Anthropic's crawlers. This
pipeline is a separate application under its own user-agent, so those groups do not
apply to it. Quote them as a stance signal; rule on the wildcard group and unscoped
prose. Futura was wrongly dropped on this before the rule was fixed.

**Read a prose clause against what we actually do.** We fetch bodies and pass them
to an LLM at inference time. We do not train, fine-tune, embed for a corpus, or
build a dataset. Clauses that ban only training, or only commercial use, may not
bite — say which limb applies and let the owner decide.

**Disallowed feed vs. a second permitted feed.** Frandroid and Euractiv each
disallow one feed and leave another reachable — pick the permitted one. Basta!
disallows its *only* feed; an alias to the same resource does not make it allowed.
The test is whether the reachable URL serves *different content*, not whether it
dodges the pattern.

**`Claude-User` allowed, `ClaudeBot` denied.** Futura permits user-initiated Claude
fetches and bans the crawler. The scheduler runs unattended at 07:00, so the
crawler rule is the one that binds us. Never resolve this in our favour.

**Machine-readable reservations.** `Content-Signal: ai-train=no` and explicit
Art. 4 (EU 2019/790) reservations are appearing in wildcard groups. Treat them as
prose prohibitions: they bind everyone.

**RFC 9309 trap.** Blank lines do not close a group. Orient XXI trails ~800
`Disallow:` lines after a `User-agent: Yandex` group — they bind to Yandex, not to
`*`. Attribute a rule to the last `User-agent:` line above it, not to proximity.

**Licence ≠ permission.** CC BY (Global Voices) or CC BY-SA (LinuxFr) is a positive
signal worth reporting, but it does not answer the robots gate, and a robots
refusal is not cured by a permissive content licence.

## Harness output → cause

| Signal | Means |
| --- | --- |
| `verdict: PARSE_FAIL` + `rootTag: <feed xmlns=…Atom>` | Atom feed. **Not a DROP** — seed it with `kind: CONNECTOR_KIND.ATOM`. The harness only parses RSS; `AtomConnector` handles these in production. |
| `dateSource: "dc:dates"` | SPIP feed. Fine — the connector falls back to Dublin Core. |
| `dateSource: "NONE"` | No date anywhere. DROP: `publishedAt` is null and the smoke test fails. |
| `chronological: false` | Feed sorted by modification, not publication. At `fetchLimit` 5 the connector ingests whatever sits on top — Orient XXI serves a 2014 article in position 4. Unfixable from our side. DROP. |
| `pathMix: {emission: 30, actualites: 30}` | Half the feed is not articles. Public Sénat bulk-publishes 30 TV-schedule stubs in 30 seconds, which then occupy the whole top of the feed. Works, but starves intermittently. |
| `replacementChars > 0` | Source is not UTF-8. `fetchText` uses `res.text()`, which always decodes UTF-8. Developpez serves `charset=iso-8859-1` → 381 U+FFFD per article, every French accent destroyed. DROP. |
| `contentChars` < 500 | Body is boilerplate. Check `contentHead`: a cookie notice, an anti-adblock message, a replay placeholder, or `"This website requires JS enabled and cookies"` (Vie-publique's 357-byte stub, served even to a full Chrome UA). |
| `contentHead` mid-sentence, ends on a subscription pitch | Paywall truncation — only the free prefix was captured. |
| `newestItem` months in the past | **Abandoned feed.** Brut's three feeds score PASS with clean bodies and valid dates, but `lastBuildDate` is Oct 2024 – Apr 2025 and the newest item is June 2025 — while brut.media still publishes daily and no longer advertises any feed. Check `newestItem` against today before reading anything else. |
| `verdict: PASS`, few items, wide `newestItem`/`oldestItem` spread | Low cadence. Afrique XXI ≈ 2.3 articles/week, Global Voices went 12 days silent. Day-based selection finds nothing most days. Report it; the admin decides. |

`PARTIAL` is normal for a mixed feed and not automatically a DROP — Slate's quiz
and podcast posts extract as boilerplate while its real articles reach 12k chars.
Downstream, `RESUME_SYSTEM_PROMPT` falls back to title+description then skips
silently. The cost is the fetch budget, not correctness.

## Known-good regression cases for the harness

```sh
S=.claude/skills/add-rss-provider/scripts/verify-feed.mjs
node $S "https://www.franceinfo.fr/titres.rss" "France Info"      # PASS, pubDate
node $S "https://orientxxi.info/?page=backend&lang=fr" "OrientXXI" # dc:dates, chronological false
node $S "https://www.publicsenat.fr/feed" "Public Senat"           # pathMix 30/30
node $S "https://linuxfr.org/news.atom" "LinuxFr"                  # PARSE_FAIL
```

## Delivery checklist

- [ ] robots.txt read in full and decisive lines quoted verbatim
- [ ] Harness run on the live feed; `verdict`, `chronological`, `dateSource`,
      `replacementChars` and every `contentHead` inspected
- [ ] Entry added to `SEED_PROVIDERS`, slug lowercase kebab-case and unique
- [ ] `pnpm --filter @brief/common build` **before** the smoke test
- [ ] `pnpm --filter @brief/services test:smoke` green, and the test count rose by
      the number of media added
- [ ] `pnpm --filter @brief/common lint` and `typecheck` clean
- [ ] Each medium reported ADD or DROP with its evidence; drops stated plainly
- [ ] Told the user that seeding is `onConflictDoNothing`, and that an admin must
      attach the provider to an enabled category before anything is fetched
