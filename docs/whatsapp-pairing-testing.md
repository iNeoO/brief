# Testing the WhatsApp pairing

What to set up, in what order, to exercise the pairing end to end. The feature is
`docs/plans/2026-08-24-001-feat-whatsapp-pairing-plan.md`; this file is only the
runbook.

Nothing sends a brief. What is testable here is: a reader authorises WhatsApp, a
proven number and its consent land in `whatsapp_pairings`, and the reader can
withdraw it.

## Test the blocking assumption first

**A Meta test number's five-recipient allowlist is documented for outbound
messages. Whether a test number accepts an _inbound_ message is what this whole
mechanism rests on, and it is unverified.**

Do this before wiring anything else, because a negative answer changes the plan
rather than the code:

1. Meta dashboard → WhatsApp → API Setup. Note the test number Meta gave you.
2. Add your own phone to **"To"** — the recipient allowlist, five numbers maximum.
3. From that phone, open WhatsApp and send `hello` to the test number.
4. Watch the webhook (step 4 below must already be registered to observe this), or
   check Meta dashboard → WhatsApp → Webhooks for a delivered `messages` event.

If no inbound event ever arrives, the `wa.me` mechanism cannot be tested on a test
number and you need a real number on a verified business — which is days to weeks
of Meta review, and the project's critical path. Find that out now.

## 1. Meta app

- Meta app of type **Business**, with the **WhatsApp** product added.
- **App secret**: App settings → Basic → App secret → `WHATSAPP_APP_SECRET`. This
  is what signs the webhook; without the right value every call is rejected 403.
- **Access token**: the one on the API Setup page expires in 24 hours. For anything
  beyond a single session create a **System User** token (Business settings → Users
  → System users) with `whatsapp_business_messaging` and
  `whatsapp_business_management`.
- **Phone number ID** and **WhatsApp Business Account ID**: both on API Setup.
- **Verify token**: yours to invent, echoed back once when the callback URL is
  registered. `openssl rand -hex 24`.

## 2. Environment

Seven variables in `.env`, all described in `.env.example`. `apps/web` refuses to
boot without them, which is the house convention — `WHATSAPP_API_VERSION` is the
only optional one (defaults to `v23.0`).

```
WHATSAPP_SENDER_NUMBER=          # E.164 digits, NO leading +. This is the wa.me target.
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_BUSINESS_ACCOUNT_ID=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_APP_SECRET=
WHATSAPP_WEBHOOK_VERIFY_TOKEN=   # min 16 chars
WHATSAPP_API_VERSION=
```

`WHATSAPP_SENDER_NUMBER` is validated as `^\d{8,15}$`. A leading `+` fails the
parse at boot, which is deliberate: `wa.me` and Cloud API both use the bare form.

## 3. Database

The table is additive, no backfill.

```sh
pnpm run drizzle:migrate
```

Verify:

```sh
psql "$PG_URL" -c '\d whatsapp_pairings'
```

Expect `user_id` as primary key, `phone_number` unique, and the CHECK
`whatsapp_pairings_opted_out_at_matches_status`.

## 4. A public HTTPS URL

Meta calls the webhook, so localhost is not reachable. In dev, tunnel port 3000:

```sh
pnpm run dev          # apps/web on :3000
cloudflared tunnel --url http://localhost:3000     # or: ngrok http 3000
```

Then register the callback in Meta dashboard → WhatsApp → Configuration:

- **Callback URL**: `https://<your-tunnel>/api/whatsapp/webhook`
- **Verify token**: the `WHATSAPP_WEBHOOK_VERIFY_TOKEN` value
- Press **Verify and save**. This fires the `GET`, which compares the token in
  constant time and echoes `hub.challenge`. A 403 here means the token does not
  match.
- **Subscribe to the `messages` field.** Without this subscription no inbound
  message is ever delivered and the pairing silently never completes.

Restarting the tunnel changes the URL and the callback has to be re-registered.

Set `SITE_URL` and `BETTER_AUTH_URL` to the tunnel URL too if you want to click
through the UI from your phone; the webhook itself does not read them.

## 5. The happy path

1. Sign in, go to `/profile`. The WhatsApp section shows the unpaired state.
2. Press the pairing button. It calls `createWhatsappPairingLink`, which mints a
   10-character code into Redis under `brief:whatsapp:pairing:<code>` with a
   **15 minute** TTL, and returns a `wa.me` URL whose prefilled text is the
   localised consent sentence plus the code.
3. Confirm the code exists:
   ```sh
   redis-cli --scan --pattern 'brief:whatsapp:pairing:*'
   redis-cli get 'brief:whatsapp:pairing:<code>'    # {"userId":"...","locale":"en"}
   redis-cli ttl 'brief:whatsapp:pairing:<code>'    # <= 900
   ```
4. The page tries to open WhatsApp and also renders the link and the message —
   on a desktop without WhatsApp the link leads nowhere, so copy the message and
   send it from your phone instead.
5. Send it. Do not worry about editing the wording: extraction looks for the code
   alone, never the sentence.
6. The page polls every **3 s** for a **2 minute** window after the link is
   handed out. Past that window it stops, and a reload picks the state up.
7. Expect a reply in WhatsApp: *"Thank you, it is noted…"* — free-form text inside
   the 24h window the inbound message opened, so no template approval is involved.
8. Verify the row:
   ```sh
   psql "$PG_URL" -c 'select user_id, phone_number, status, opt_in_at, opt_in_message_id, opt_in_text from whatsapp_pairings;'
   ```
   `status` is `verified`, `phone_number` is your number in E.164 without `+`, and
   `opt_in_text` is what you actually sent — not the sentence that was prefilled.
9. The code is consumed: the Redis key is gone.

## 6. What else to check

**Opt-out from WhatsApp.** Send `STOP` (or `ARRET`, `ARRÊT`, `UNSUBSCRIBE`) to the
number. The row flips to `opted_out` with `opted_out_at` set. Matching is on the
whole message, so `stop sending the audio one` must **not** opt you out — worth
testing, it is the reason the check is strict.

**Opt-out from the site.** The profile section's withdraw button deletes the row
outright, consent evidence included. Confirm the table is empty afterwards.

**Pairing again after STOP.** Start a new pairing and send the message. The row
comes back to `verified` and `opted_out_at` returns to NULL — the CHECK constraint
would reject any other combination.

**Number transfer.** Pair from account A, then pair the same phone from account B.
B gets the row, A loses it. Refusing instead would leave B permanently unpairable,
since sending the message proves present control of the number.

**Signature rejection.** The one check that does not need Meta at all:

```sh
curl -i -X POST https://<your-tunnel>/api/whatsapp/webhook \
  -H 'content-type: application/json' \
  -d '{"entry":[]}'
```

Expect **403** and a `Rejected a WhatsApp webhook carrying an invalid signature`
log line. Same with a wrong `X-Hub-Signature-256`.

**Unknown code.** Send a message containing a code that was never minted, e.g.
`ABCDEFGH23`. Expect 200, no row, and a log line saying a code could not be used.
Anyone can write to the number without ever having asked for a link; that is a
conversation, not a failure.

## 7. Driving the webhook without Meta

Useful for the branches that are tedious to reach by phone. Sign the exact bytes
you send, since the HMAC is computed over the raw body:

```sh
BODY='{"entry":[{"changes":[{"value":{"messages":[{"id":"wamid.TEST1","from":"33600000000","timestamp":"1756000000","text":{"body":"I authorise Brief to send me my daily briefs on WhatsApp. Code: REPLACE-ME"}}]}}]}]}'
SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$WHATSAPP_APP_SECRET" -hex | sed 's/^.*= //')

curl -i -X POST http://localhost:3000/api/whatsapp/webhook \
  -H 'content-type: application/json' \
  -H "X-Hub-Signature-256: sha256=$SIG" \
  --data-raw "$BODY"
```

Replace `REPLACE-ME` with a code you just minted from `/profile` (read it out of
Redis), and `from` with any number — the whole point is that in a real call this
field is the one thing we could not have forged, but locally it is just a string.

Expect **200** and a `verified` row. Send the identical payload twice: the second
call is recognised as a Meta redelivery through `opt_in_message_id` and changes
nothing. Note `printf '%s'` rather than `echo`, and `--data-raw`, so no trailing
newline slips between the signature and the body.

## Known gaps

- **No brief is ever sent.** Per-recipient fan-out needs its own migration
  (`message_jobs.category_job_id` is unique) and brief templates need their own
  plan. The site copy already names WhatsApp as the delivery channel, so it
  currently promises something nothing delivers on.
- **Delivery statuses** (`sent`/`delivered`/`read`) are not stored. Only `failed`
  is logged.
- **`apps/web` has no automated tests.** The 11 tests covering this feature are
  the pairing-code helper in `packages/services`; the webhook's signature check
  and the server functions are untested, and the checks above are manual.
