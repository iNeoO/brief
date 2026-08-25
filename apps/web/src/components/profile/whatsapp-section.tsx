import { WHATSAPP_PAIRING_STATUS } from "@brief/common/constants";
import { Anchor, Badge, Button, Code, Group, Stack } from "@mantine/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import classes from "#/components/profile/profile.module.css";
import {
	createWhatsappPairingLink,
	deleteWhatsappPairing,
	refreshWhatsappPairing,
	whatsappPairingQueryOptions,
} from "#/libs/api/whatsapp";
import { resolveErrorMessage } from "#/libs/auth/error-message";
import { formatDate } from "#/libs/format/date";
import { useI18n } from "#/libs/i18n/context";
import { notifyError, notifySuccess } from "#/libs/notify";

const POLL_INTERVAL_MS = 3_000;

/**
 * How long we keep watching for the user's message after handing out a link.
 * Long enough to switch apps and come back, short enough that a page left open
 * all afternoon stops polling.
 */
const WAITING_WINDOW_MS = 2 * 60 * 1_000;

type PendingLink = {
	url: string;
	message: string;
	senderNumber: string;
	until: number;
};

/**
 * Pairing runs the other way round from what a form would suggest: the user does
 * not type a number, they send us a message from WhatsApp. What comes back proves
 * the number and carries the consent, so there is nothing here to validate.
 */
export function WhatsappSection({ returnTo }: { returnTo?: string }) {
	const { locale, t } = useI18n();
	const labels = t.auth.profile.whatsapp;
	const queryClient = useQueryClient();
	const [pending, setPending] = useState<PendingLink | null>(null);

	const { data } = useQuery({
		...whatsappPairingQueryOptions(),
		// The pairing lands through the webhook, not through this page, so polling
		// is the only way it can notice. Bounded, and only while we are waiting.
		refetchInterval: () =>
			pending && Date.now() < pending.until ? POLL_INTERVAL_MS : false,
	});

	const pairing = data?.pairing ?? null;

	const start = useMutation({
		mutationFn: () => createWhatsappPairingLink({ data: { locale } }),
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
		mutationFn: () => deleteWhatsappPairing(),
		onSuccess: async () => {
			setPending(null);
			await refreshWhatsappPairing(queryClient);
			notifySuccess(labels.verified.removed);
		},
		onError: (error) => {
			notifyError(resolveErrorMessage(error, {}, t.auth.genericError));
		},
	});

	const isVerified = pairing?.status === WHATSAPP_PAIRING_STATUS.VERIFIED;

	return (
		<section className={classes.section}>
			<h2 className={classes.sectionTitle}>{labels.title}</h2>
			<p className={classes.sectionLead}>{labels.lead}</p>

			{pairing ? (
				<Stack gap="md">
					<dl className={classes.details}>
						<div className={classes.detail}>
							<dt className={classes.detailLabel}>{labels.verified.number}</dt>
							<dd className={classes.detailValue}>
								{`+${pairing.phoneNumber}`}
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

					{isVerified ? null : <p>{labels.optedOut.body}</p>}

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

							{/* The desktop fallback: without WhatsApp installed the link
							    leads nowhere, and the message can be sent by hand. */}
							<p className={classes.sectionLead}>
								{labels.waiting.manual(`+${pending.senderNumber}`)}
							</p>
							<Code block>{pending.message}</Code>
						</Stack>
					) : null}

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
			)}
		</section>
	);
}
