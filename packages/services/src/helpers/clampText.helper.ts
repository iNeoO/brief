/**
 * Cuts `text` to `maxChars` and marks the cut with an ellipsis, so a reader —
 * the model included — can tell a truncated passage from a complete one.
 *
 * Every figure it guards comes from a third-party feed, which is free to send a
 * whole page where a title or a summary was expected. Clamping at the ingestion
 * boundary keeps that out of the database, out of the prompt, and off the bill.
 */
export const clampText = (text: string, maxChars: number) =>
	text.length > maxChars ? `${text.slice(0, maxChars)}…` : text;
