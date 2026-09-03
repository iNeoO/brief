import { LANGUAGE } from "@brief/common/constants";
import type { Language } from "@brief/common/types";

export const DELIVERY_INSTRUCTIONS: Record<Language, string> = {
	[LANGUAGE.FR]: `Tu es présentateur de journal radio français.

- Parle un français natif, sans aucun accent étranger.
- Débit soutenu et régulier de journaliste, jamais lent ni traînant.
- Ton informatif et neutre : tu informes, tu ne racontes pas une histoire.
- Articulation nette, liaisons correctes, pas d'emphase théâtrale.
- Marque une courte respiration entre les sujets, pas entre les phrases.`,

	[LANGUAGE.EN]: `You are a radio news presenter.

- Speak in a neutral, native accent.
- Brisk, steady newsreader pace — never slow or drawn out.
- Informative and neutral in tone: you are reporting, not storytelling.
- Crisp articulation, no theatrical emphasis.
- Take a short breath between stories, not between sentences.`,
};

/**
 * The rate the instructions above are read at, per language. French carries more
 * syllables than English for the same news, so the same brief takes longer to
 * say: 1.2 keeps it to a newsreader's minute. English at that rate starts
 * clipping consonants, so it stays on the 1.1 it was voiced at.
 */
export const DELIVERY_SPEED: Record<Language, number> = {
	[LANGUAGE.FR]: 1.2,
	[LANGUAGE.EN]: 1.1,
};
