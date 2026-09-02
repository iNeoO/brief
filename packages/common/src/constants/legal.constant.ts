/**
 * The facts the legal notice must state, kept out of the dictionaries on
 * purpose: a company number that exists in a French copy and an English one is
 * a number that gets corrected in a single copy. Only the labels around these
 * values are translated.
 */
export const LEGAL_PUBLISHER = "ineoo";

/**
 * The host, as published on its own legal notice
 * (https://www.scaleway.com/fr/mentions-legales/). Naming the host is what the
 * LCEN asks of a non-professional publisher in exchange for not publishing a
 * home address. Scaleway publishes no telephone number; its postal address is
 * the contact route it offers.
 */
export const LEGAL_HOST = {
	name: "SCALEWAY SAS",
	address: "8 rue de la Ville-l'Évêque, 75008 Paris, France",
	capital: "142 050 €",
	registration: "RCS Paris 433 115 904",
	vat: "FR 35 433115904",
} as const;

/**
 * When the legal notice and the privacy policy last changed, ISO so both
 * locales can format it their own way. Bump it whenever their wording does —
 * a policy that changed without saying so is the one complaint a reader wins.
 */
export const LEGAL_UPDATED_AT = "2026-09-02";
