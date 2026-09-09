import { TELEGRAM_PAIRING_STATUS } from "@brief/common/constants";
import { Anchor, Badge, Button, Code, Group, Stack } from "@mantine/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import classes from "#/components/profile/profile.module.css";
import {
	createTelegramPairingLink,
	deleteTelegramPairing,
	refreshTelegramPairing,
	telegramPairingQueryOptions,
} from "#/libs/api/telegram";
import { resolveErrorMessage } from "#/libs/auth/error-message";
import { formatDate } from "#/libs/format/date";
import { useI18n } from "#/libs/i18n/context";
import { notifyError, notifySuccess } from "#/libs/notify";

const POLL_INTERVAL_MS = 3_000;

/**
 * How long we keep watching for the user's `/start` after handing out a link.
 * Long enough to switch apps and come back, short enough that a page left open
 * all afternoon stops polling.
 */
const WAITING_WINDOW_MS = 2 * 60 * 1_000;

type PendingLink = {
	url: string;
	botUsername: string;
	code: string;
	until: number;
};

/**
 * Pairing runs the other way round from what a form would suggest: the user does
 * not type an address, they open the bot and tap Start. What comes back proves the
 * chat, so there is nothing here to validate.
 *
 * The consent is given here rather than in the message: `/start` proves control of
 * the account and nothing else. The wording rendered next to the button is what
 * gets stored as the opt-in record, so it has to say what the user is agreeing to
 * and how to stop.
 */
export function TelegramSection({ returnTo }: { returnTo?: string }) {
	const { locale, t } = useI18n();
	const labels = t.auth.profile.telegram;
	const queryClient = useQueryClient();
	const [pending, setPending] = useState<PendingLink | null>(null);

	const { data } = useQuery({
		...telegramPairingQueryOptions(),
		// The pairing lands through the webhook, not through this page, so polling
		// is the only way it can notice. Bounded, and only while we are waiting.
		refetchInterval: () =>
			pending && Date.now() < pending.until ? POLL_INTERVAL_MS : false,
	});

	const pairing = data?.pairing ?? null;

	const start = useMutation({
		mutationFn: () => createTelegramPairingLink({ data: { locale } }),
		onSuccess: (link) => {
			setPending({ ...link, until: Date.now() + WAITING_WINDOW_MS });

			// Attempted, not relied on: a window opened from an async callback is
			// what popup blockers exist to stop. The link is rendered as well, and
			// that copy is the one that always works.
			window.open(link.url, "_blank", "noopener,noreferrer");
		},
		onError: (error) => {
			notifyError(
				resolveErrorMessage(
					error,
					{ 429: t.auth.tooManyRequests },
					labels.error,
				),
			);
		},
	});

	const remove = useMutation({
		mutationFn: () => deleteTelegramPairing(),
		onSuccess: async () => {
			setPending(null);
			await refreshTelegramPairing(queryClient);
			notifySuccess(labels.verified.removed);
		},
		onError: (error) => {
			notifyError(resolveErrorMessage(error, {}, t.auth.genericError));
		},
	});

	const isVerified = pairing?.status === TELEGRAM_PAIRING_STATUS.VERIFIED;

	return (
		<section className={classes.section}>
			<h2 className={classes.sectionTitle}>{labels.title}</h2>
			<p className={classes.sectionLead}>{labels.lead}</p>

			{pairing ? (
				<Stack gap="md">
					<dl className={classes.details}>
						<div className={classes.detail}>
							<dt className={classes.detailLabel}>{labels.verified.state}</dt>
							<dd className={classes.detailValue}>
								<Badge
									size="sm"
									variant="light"
									color={isVerified ? "teal" : "gray"}
								>
									{isVerified ? labels.verified.badge : labels.optedOut.badge}
								</Badge>
							</dd>
						</div>

						<div className={classes.detail}>
							<dt className={classes.detailLabel}>{labels.verified.since}</dt>
							<dd className={classes.detailValue}>
								{formatDate(new Date(pairing.optInAt), locale, "long")}
							</dd>
						</div>
					</dl>

					{isVerified ? null : (
						<>
							<p>{labels.optedOut.body}</p>
							{/* Authorising again mints a new code, so the wording that will
							    be stored has to be on screen again too. */}
							<p className={classes.sectionLead}>{labels.consent}</p>
						</>
					)}

					<Group>
						{isVerified ? null : (
							<Button
								size="sm"
								onClick={() => start.mutate()}
								loading={start.isPending}
							>
								{labels.idle.action}
							</Button>
						)}

						<Button
							size="sm"
							variant="subtle"
							color="red"
							onClick={() => remove.mutate()}
							loading={remove.isPending}
						>
							{labels.verified.remove}
						</Button>

						{/* A plain href: the target is a validated path, not one of the
						    route ids Link is typed against. */}
						{isVerified && returnTo ? (
							<Anchor href={returnTo}>{labels.verified.continue}</Anchor>
						) : null}
					</Group>
				</Stack>
			) : (
				<Stack gap="md">
					<p>{pending ? labels.waiting.body : labels.idle.body}</p>

					{pending ? (
						<Stack gap="xs">
							<Anchor
								href={pending.url}
								target="_blank"
								rel="noopener noreferrer"
							>
								{labels.waiting.open}
							</Anchor>

							{/* The desktop fallback: without Telegram installed the deep
							    link leads nowhere, and the command can be typed by hand. */}
							<p className={classes.sectionLead}>
								{labels.waiting.manual(`@${pending.botUsername}`)}
							</p>
							<Code block>{`/start ${pending.code}`}</Code>
						</Stack>
					) : null}

					<Stack gap="xs">
						{/* This wording, not the `/start` command, is the opt-in record:
						    it is stored verbatim when the pairing completes. Rendered next
						    to the button so agreeing and pressing are one gesture. */}
						<p className={classes.sectionLead}>{labels.consent}</p>

						<Group>
							<Button
								size="sm"
								onClick={() => start.mutate()}
								loading={start.isPending}
							>
								{pending ? labels.waiting.restart : labels.idle.action}
							</Button>
						</Group>
					</Stack>
				</Stack>
			)}
		</section>
	);
}
