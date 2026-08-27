/**
 * The product name as users read it. Lives here rather than in the web app
 * because the transactional emails render it too, and a name that is copied
 * in two places is a name that only gets renamed in one.
 */
export const BRAND_NAME = "Daily Briefs";

/**
 * Where a reader writes when the site cannot help them — today, to ask for the
 * account they cannot open themselves. Here rather than in a dictionary so the
 * two locales cannot drift, for the same reason as the name above.
 */
export const CONTACT_EMAIL = "contact@dailybriefs.fr";
