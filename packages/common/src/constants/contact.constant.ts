/**
 * Bounds for the public contact form. Here rather than in the route so the zod
 * schema that rejects an oversized message and the input that stops the reader
 * from typing one cannot disagree — a form that accepts what the server refuses
 * loses the message it just asked someone to write.
 */
export const CONTACT_SUBJECT_MAX_LENGTH = 120;

export const CONTACT_MESSAGE_MIN_LENGTH = 20;

export const CONTACT_MESSAGE_MAX_LENGTH = 4000;

/**
 * Name of the field no human fills in. It is rendered off-screen and left
 * empty; a bot that fills every input it finds gives itself away, and the
 * submission is dropped without an email.
 */
export const CONTACT_HONEYPOT_FIELD = "website";
