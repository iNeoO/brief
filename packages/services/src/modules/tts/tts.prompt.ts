import { LANGUAGE } from "@brief/common/constants";
import type { Language } from "@brief/common/types";

/**
 * Delivery instructions, one per language the brief is written in.
 *
 * The voices are English natives. Told nothing, they read French with an
 * English accent and at a storyteller's pace; naming the language and the
 * register is what turns them into a newsreader.
 */
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
