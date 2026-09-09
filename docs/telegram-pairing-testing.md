# Setting up and testing the Telegram pairing

What to set up, in what order, to exercise the pairing end to end. The feature
replaced the WhatsApp pairing described in
`docs/plans/2026-08-24-001-feat-whatsapp-pairing-plan.md` — that plan is kept as
the historical record of the design, not as a description of the code.

Nothing sends a brief. What is testable here is: a reader authorises Telegram, a
proven `chat_id` and its consent land in `telegram_pairings`, and the reader can
withdraw it.

## 1. The bot

In Telegram, talk to [@BotFather](https://t.me/BotFather):

- `/newbot` — it asks for a display name, then a username ending in `bot`. It
  answers with the token: `123456789:AA...`. That is `TELEGRAM_BOT_TOKEN`, and it
  is the only credential Telegram needs.
- The username, **without** the leading `@`, is `TELEGRAM_BOT_USERNAME`.
- `/setcommands` — paste the two the bot answers, so they appear in the client's
  command menu:
  ```
  start - Authorise Brief to send you your briefs
  stop - Stop receiving briefs
  ```
- `/setdescription` and `/setabouttext` are worth filling in: they are what a
  reader sees on the bot's profile before pressing Start.

Nothing else. No phone number, no company, no display-name review, no per-message
fee — that is the whole reason the channel changed.

## 2. Environment

Three variables in `.env`, all described in `.env.example`. `apps/web` refuses to
boot without them, which is the house convention.

```
TELEGRAM_BOT_TOKEN=       # from @BotFather
TELEGRAM_BOT_USERNAME=    # no leading @, 5-32 chars
TELEGRAM_WEBHOOK_SECRET=  # ours, min 16 chars: openssl rand -hex 24
```

The token is read from the environment and never logged. Keep it out of shell
history that gets committed, and out of this file.

## 3. Database

```sh
pnpm run drizzle:migrate
```

Verify:

```sh
psql "$PG_URL" -c '\d telegram_pairings'
```

Expect `user_id` as primary key, `chat_id` unique, and the CHECK
`telegram_pairings_opted_out_at_matches_status`.

## 4. A public HTTPS URL

Telegram calls the webhook, so localhost is not reachable. It also accepts **only
ports 443, 80, 88 and 8443** and requires a valid certificate, so a plain
`http://localhost:3000` cannot be registered at all — a tunnel is mandatory, not a
convenience.

```sh
pnpm run dev          # apps/web on :3000
cloudflared tunnel --url http://localhost:3000     # or: ngrok http 3000
```

Both hand out an `https://…` URL on 443 with a real certificate. `vite.config.ts`
allows their hostnames through Vite's anti-DNS-rebinding check by suffix, since
the subdomain changes on every restart.

## 5. Register the webhook

One `setWebhook` call per environment. There is a Makefile target so nobody has to
remember the curl:

```sh
TELEGRAM_WEBHOOK_URL=https://<your-tunnel>/api/telegram/webhook make telegram-webhook
```

It reads `TELEGRAM_BOT_TOKEN` and `TELEGRAM_WEBHOOK_SECRET` from `.env` and asks
Telegram for exactly the two update types the pairing handles:

- `message` — carries `/start <code>` and `/stop`
- `my_chat_member` — carries the block, which is how people actually opt out

Check it:

```sh
make telegram-webhook-info
```

`url` should be yours, `pending_update_count` should settle at 0, and
`last_error_message` should be absent. A `Wrong response from the webhook: 403`
there means the secret does not match, or Vite rejected the tunnel hostname.

Restarting the tunnel changes the URL, so `setWebhook` has to be run again. Set
`SITE_URL` and `BETTER_AUTH_URL` to the tunnel URL too if you want to click
through the UI from your phone; the webhook itself does not read them.

To take the webhook down again (Telegram allows only one per bot, so two
developers cannot share one):

```sh
make telegram-webhook-delete
```

## 6. The happy path

1. Sign in, go to `/profile`. The Telegram section shows the unpaired state, with
   the consent wording next to the button.
2. Press the button. It calls `createTelegramPairingLink`, which mints a
   10-character code into Redis under `brief:telegram:pairing:<code>` with a
   **15 minute** TTL, and returns `https://t.me/<bot>?start=<code>`.
3. Confirm the code exists:
   ```sh
   redis-cli --scan --pattern 'brief:telegram:pairing:*'
   redis-cli get 'brief:telegram:pairing:<code>'
   # {"userId":"...","locale":"en","consentText":"By pressing this button, …"}
   redis-cli ttl 'brief:telegram:pairing:<code>'    # <= 900
   ```
   The consent wording is in the payload because that is the evidence: `/start
   CODE` proves the account, not the agreement, so what the page displayed has to
   travel with the code.
4. The page tries to open Telegram and also renders the link — on a desktop
   without Telegram the link opens the web client, or you can search the bot on
   your phone and send `/start <code>` by hand.
5. Press **Start**. Telegram sends `/start <code>` as an ordinary message.
6. The page polls every **3 s** for a **2 minute** window after the link is handed
   out. Past that window it stops, and a reload picks the state up.
7. Expect a reply in Telegram: *"Thank you, it is noted…"*.
8. Verify the row:
   ```sh
   psql "$PG_URL" -c 'select user_id, chat_id, status, opt_in_at, opt_in_update_id, opt_in_text from telegram_pairings;'
   ```
   `status` is `verified`, `chat_id` is your chat, and `opt_in_text` is the consent
   wording the page showed you — **not** `/start CODE`.
9. The code is consumed: the Redis key is gone.

## 7. What else to check

**Opt-out with `/stop`.** Send `/stop` to the bot. The row flips to `opted_out`
with `opted_out_at` set. Matching is on the whole message, so `/stop the audio
one` must **not** opt you out.

**Opt-out by blocking.** Block the bot from its profile. Telegram sends a
`my_chat_member` update with `new_chat_member.status == "kicked"` and the row flips
the same way. This is the branch that matters most — blocking is what readers
actually do, and after it every `sendMessage` fails.

**Opt-out from the site.** The profile section's withdraw button deletes the row
outright, consent evidence included. Confirm the table is empty afterwards.

**Pairing again after `/stop`.** Unblock the bot if you blocked it, start a new
pairing and press Start. The row comes back to `verified` and `opted_out_at`
returns to NULL — the CHECK constraint would reject any other combination.

**Chat transfer.** Pair from account A, then pair the same Telegram account to
account B. B gets the row, A loses it. Refusing instead would leave B permanently
unpairable, since a `/start` proves present control of the chat.

**A bare `/start`.** Every new chat opens with one, and the client's menu button
sends one. Expect 200, no row, and no log line: that is a conversation.

**Secret rejection.** The one check that needs no bot at all:

```sh
curl -i -X POST http://localhost:3000/api/telegram/webhook \
  -H 'content-type: application/json' \
  -d '{"update_id":1}'
```

Expect **403** and a `Rejected a Telegram webhook carrying an invalid secret
token` log line. Same with a wrong `X-Telegram-Bot-Api-Secret-Token`.

**Unknown code.** Send `/start ABCDEFGH23` — a code that was never minted. Expect
200, no row, and a log line saying a code could not be used.

## 8. Driving the webhook without Telegram

Useful for the branches that are tedious to reach by phone. There is no body
signature to compute — Telegram authenticates with a header — so a curl is all it
takes:

```sh
curl -i -X POST http://localhost:3000/api/telegram/webhook \
  -H 'content-type: application/json' \
  -H "X-Telegram-Bot-Api-Secret-Token: $TELEGRAM_WEBHOOK_SECRET" \
  -d '{"update_id":1001,"message":{"date":1756000000,"chat":{"id":123456789},"text":"/start REPLACE-ME"}}'
```

Replace `REPLACE-ME` with a code you just minted from `/profile` (read it out of
Redis). Expect **200** and a `verified` row. Send the identical payload twice: the
second call is recognised as a Telegram redelivery through `opt_in_update_id` and
changes nothing.

The block, which is otherwise a phone-only gesture:

```sh
curl -i -X POST http://localhost:3000/api/telegram/webhook \
  -H 'content-type: application/json' \
  -H "X-Telegram-Bot-Api-Secret-Token: $TELEGRAM_WEBHOOK_SECRET" \
  -d '{"update_id":1002,"my_chat_member":{"chat":{"id":123456789},"new_chat_member":{"status":"kicked"}}}'
```

`chat.id` is the one field a real call could not have forged; locally it is just a
number. Note that `sendMessage` will fail for a chat that never started the bot, so
the acknowledgement is expected to warn when you drive the webhook by hand.

## Known gaps

- **No brief is ever sent.** Per-recipient fan-out needs its own migration
  (`message_jobs.category_job_id` is unique) and brief templates need their own
  plan. The site copy already names Telegram as the delivery channel, so it
  currently promises something nothing delivers on.
- **Delivery failures are not recorded.** `sendMessage` warns and returns; nothing
  reads those warnings, and a chat that has blocked the bot is only discovered
  through `my_chat_member`.
- **`apps/web` has no automated tests.** The tests covering this feature are the
  pairing-code helper in `packages/services`; the webhook's secret check and the
  server functions are untested, and the checks above are manual.
