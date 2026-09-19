import {
	BRAND_NAME,
	MESSAGE_RETRY_DELAYS_MS,
	TELEGRAM_MESSAGE_COPY,
} from "@brief/common/constants";
import type { Locale } from "@brief/common/types";
import { retryDelayFromTiers } from "@brief/common/utils";

/**
 * A brief's target date is a calendar day stored without a time zone. Read it in
 * UTC, exactly as the site does: any other zone shows a reader west of Greenwich
 * the day before.
 */
export const formatBriefDate = (targetDate: Date, locale: Locale) =>
	new Intl.DateTimeFormat(locale, {
		dateStyle: "long",
		timeZone: "UTC",
	}).format(targetDate);

/**
 * The text under the audio. The day's opening line rides on whichever topic
 * finishes first and is never sent on its own — a separate announcement message
 * would need a guarantee that it lands before that first audio, which two workers
 * cannot give.
 */
export const buildCaption = ({
	locale,
	categoryName,
	targetDate,
	isFirst,
}: {
	locale: Locale;
	categoryName: string;
	targetDate: Date;
	isFirst: boolean;
}) => {
	const copy = TELEGRAM_MESSAGE_COPY[locale];
	const topic = copy.topic(categoryName);

	return isFirst
		? `${copy.announcement(formatBriefDate(targetDate, locale))}\n\n${topic}`
		: topic;
};

/** What Telegram's native player shows instead of a file name. */
export const buildAudioTitle = ({
	categoryName,
	targetDate,
	locale,
}: {
	categoryName: string;
	targetDate: Date;
	locale: Locale;
}) => `${categoryName} — ${formatBriefDate(targetDate, locale)}`;

export const AUDIO_PERFORMER = BRAND_NAME;

/**
 * The public endpoint Telegram fetches the file from. It only serves a brief
 * whose category job is `finished`, which is why delivery is published after
 * `markFinished` and never from inside the pipeline step.
 */
export const buildAudioUrl = (siteUrl: string, fileId: string) =>
	`${siteUrl}/api/briefs/audio/${fileId}`;

/**
 * How long this job waits before Telegram is tried again. A 429 carries its own
 * figure and it wins — arguing with a rate limiter by retrying sooner only
 * lengthens the ban.
 *
 * `attempt` counts the attempts that have already failed, so it is 1 when the
 * first one just did.
 */
export const retryDelayMs = (attempt: number, retryAfterMs?: number) =>
	retryAfterMs ?? retryDelayFromTiers(MESSAGE_RETRY_DELAYS_MS, attempt);
