import { SEED_PROVIDERS } from "@brief/common/constants";
import { env } from "../config/env.js";
import { createDb, schema } from "../index.js";

const db = createDb(env.PG_URL);

/**
 * Installs the supported media as providers. Idempotent through the unique
 * slug: re-running it adds the media that appeared since, and leaves the rows
 * already there alone — including a provider an admin has disabled by hand.
 */
const main = async () => {
	const inserted = await db
		.insert(schema.providers)
		.values([...SEED_PROVIDERS])
		.onConflictDoNothing({ target: schema.providers.slug })
		.returning({ name: schema.providers.name });

	console.log(
		inserted.length === 0
			? `No provider added, the ${SEED_PROVIDERS.length} supported media are already there.`
			: `Added ${inserted.length} provider(s): ${inserted.map(({ name }) => name).join(", ")}.`,
	);
};

await main();
await db.$client.end();
