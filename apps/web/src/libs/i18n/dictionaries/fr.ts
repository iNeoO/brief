import type { Dictionary } from "./en";

export const fr: Dictionary = {
	meta: {
		title: "L'essentiel de la journée, en quelques minutes",
		description:
			"Un résumé court par sujet suivi, chaque matin. À lire ou à écouter en quelques minutes.",
	},
	a11y: {
		skipToContent: "Aller au contenu",
		mainNavigation: "Navigation principale",
		siteActions: "Préférences et compte",
		homeLink: "Accueil",
	},
	nav: {
		topics: "Sujets",
		howItWorks: "Comment ça marche",
		signIn: "Se connecter",
		signUp: "S'inscrire",
	},
	colorScheme: {
		toDark: "Passer en mode sombre",
		toLight: "Passer en mode clair",
	},
	language: {
		label: "Langue",
		current: (label: string) => `Langue : ${label}`,
	},
	hero: {
		title: "L'essentiel, sans le bruit.",
		lead: "Un résumé court par sujet suivi, qui vous attend chaque matin.",
		cta: "Commencer à lire",
		rhythm: "Un envoi par matin, à 7 h. Rien d'autre.",
	},
	method: {
		title: "Comment ça marche",
		steps: [
			{
				title: "Vous choisissez vos sujets",
				body: "Vous gardez ceux qui vous intéressent, et laissez les autres de côté.",
			},
			{
				title: "Nous lisons la presse pour vous",
				body: "Chaque sujet est suivi dans plusieurs sources, puis résumé.",
			},
			{
				title: "Vous recevez votre brief",
				body: "Un résumé clair et factuel chaque matin. À lire ou à écouter.",
			},
		],
	},
	brief: {
		title: "Le brief du jour",
		readTime: (minutes: number) => `${minutes} min`,
		readTimeLabel: (minutes: number) => `${minutes} minutes de lecture`,
		listen: "Écouter",
		listenLabel: (headline: string) => `Écouter le brief : ${headline}`,
		read: "Lire le brief",
		items: [
			{
				topic: "Économie",
				minutes: 3,
				headline: "La banque centrale maintient ses taux directeurs",
				body: "Pour la première fois en dix réunions consécutives, la Banque centrale européenne interrompt son resserrement monétaire, en raison d'une inflation qui ralentit mais reste au-dessus de sa cible. Le taux de dépôt ne bouge pas. La décision était largement attendue, et les valeurs bancaires ont fini en légère hausse.",
			},
			{
				topic: "Technologie",
				minutes: 4,
				headline: "L'Europe fixe un cadre pour l'intelligence artificielle",
				body: "Les législateurs européens sont parvenus à un accord provisoire sur l'AI Act, qui classe les systèmes selon leur niveau de risque. Les usages jugés les plus sensibles devront faire l'objet d'une évaluation avant leur mise sur le marché. Le texte doit encore être approuvé formellement par chaque État membre.",
			},
			{
				topic: "International",
				minutes: 5,
				headline: "Les céréales repartent par le corridor de la mer Noire",
				body: "Trois cargos ont quitté Odessa mardi dans le cadre d'un arrangement négocié à Ankara, les premiers départs depuis l'été. Kiev estime que le corridor peut acheminer quatre millions de tonnes par mois si l'accord sur la navigation tient jusqu'à l'automne.",
			},
			{
				topic: "Sciences",
				minutes: 3,
				headline:
					"Les premières traces de vie vieillissent de 200 millions d'années",
				body: "À partir d'échantillons de roches d'Australie-Occidentale, une équipe date des structures microbiennes de 3,7 milliards d'années, soit environ 200 millions d'années avant le chiffre retenu jusqu'ici. Deux laboratoires indépendants tentent de reproduire la mesure.",
			},
		],
		unpublished: {
			title: "Le brief du jour n'est pas encore paru",
			body: "Il est en préparation et sera là avant 7 h. Le brief d'hier reste disponible.",
			cta: "Lire le brief d'hier",
		},
		moreTopics: {
			body: "Vous n'avez pas sélectionné d'autres sujets.",
			cta: "Gérer mes sujets",
		},
	},
	topics: {
		title: "Sujets couverts",
		lead: "Suivez-en un, ou suivez-les tous. Vous pouvez changer d'avis chaque matin.",
		items: [
			"Technologie",
			"Économie",
			"International",
			"Sciences",
			"Culture",
			"Sport",
		],
	},
	closing: {
		title: "Commencez demain matin.",
		body: "Choisissez vos sujets, et votre premier brief arrive à 7 h.",
		cta: "Créer mon compte",
		note: "Un envoi par jour. Désinscription en un clic.",
	},
	footer: {
		about: "À propos",
		legal: "Mentions légales",
		privacy: "Confidentialité",
		contact: "Contact",
		rights: (year: number, brand: string) => `© ${year} ${brand}`,
	},
	auth: {
		backToSite: "Retour au site",
		fields: {
			name: "Nom",
			email: "Adresse e-mail",
			password: "Mot de passe",
			newPassword: "Nouveau mot de passe",
			confirmPassword: "Confirmer le nouveau mot de passe",
			passwordHint: "Au moins 8 caractères.",
		},
		validation: {
			nameRequired: "Indiquez votre nom.",
			emailRequired: "Indiquez votre adresse e-mail.",
			emailInvalid: "Indiquez une adresse e-mail valide.",
			passwordRequired: "Indiquez votre mot de passe.",
			passwordTooShort: "Utilisez au moins 8 caractères.",
			passwordMismatch: "Les deux mots de passe ne correspondent pas.",
		},
		genericError: "Une erreur est survenue. Veuillez réessayer.",
		tooManyRequests: "Trop de tentatives. Réessayez dans quelques minutes.",
		signIn: {
			title: "Se connecter",
			lead: "Reprenez où vous en étiez.",
			submit: "Se connecter",
			rememberMe: "Rester connecté",
			forgotPassword: "Mot de passe oublié ?",
			noAccount: "Pas encore de compte ?",
			createAccount: "Créer un compte",
			invalidCredentials: "Cet e-mail et ce mot de passe ne correspondent pas.",
			emailNotVerified:
				"Confirmez votre adresse e-mail avant de vous connecter. Le lien est dans votre boîte de réception.",
			resend: "Renvoyer le lien",
			resent: "Lien envoyé. Consultez votre boîte de réception.",
		},
		signUp: {
			title: "Créer votre compte",
			lead: "Choisissez vos sujets et recevez votre premier brief demain à 7 h.",
			submit: "Créer mon compte",
			hasAccount: "Vous avez déjà un compte ?",
			signIn: "Se connecter",
			emailTaken: "Un compte existe déjà avec cette adresse e-mail.",
			checkInbox: {
				title: "Confirmez votre adresse e-mail",
				body: (email: string) =>
					`Nous avons envoyé un lien à ${email}. Ouvrez-le pour activer votre compte, puis connectez-vous.`,
				resend: "Renvoyer le lien",
				resent: "Lien envoyé. Consultez votre boîte de réception.",
			},
		},
		forgotPassword: {
			title: "Réinitialiser votre mot de passe",
			lead: "Indiquez votre adresse e-mail et nous vous envoyons un lien.",
			submit: "Envoyer le lien",
			backToSignIn: "Retour à la connexion",
			// Ne dit rien sur l'existence du compte, volontairement.
			sent: {
				title: "Consultez votre boîte de réception",
				body: "Si un compte existe pour cette adresse, un lien de réinitialisation est en route.",
			},
		},
		resetPassword: {
			title: "Choisir un nouveau mot de passe",
			lead: "Choisissez-en un que vous n'avez pas déjà utilisé ici.",
			submit: "Enregistrer mon nouveau mot de passe",
			invalidToken:
				"Ce lien n'est plus valable. Les liens expirent — demandez-en un nouveau.",
			requestNew: "Demander un nouveau lien",
			missingToken: {
				title: "Ce lien est incomplet",
				body: "Ouvrez le lien de votre e-mail tel qu'il a été envoyé, ou demandez-en un nouveau.",
			},
			done: {
				title: "Mot de passe modifié",
				body: "Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.",
				cta: "Se connecter",
			},
		},
		validateEmail: {
			pageTitle: "Confirmation de l'adresse e-mail",
			pending: "Confirmation de votre adresse e-mail…",
			done: {
				title: "Adresse e-mail confirmée",
				body: "Votre compte est actif. Connectez-vous pour lire votre premier brief.",
				cta: "Se connecter",
			},
			failed: {
				title: "Nous n'avons pas pu confirmer ce lien",
				body: "Les liens de vérification expirent. Connectez-vous pour en recevoir un nouveau.",
				cta: "Aller à la connexion",
			},
			missingToken: {
				title: "Ce lien est incomplet",
				body: "Ouvrez le lien de votre e-mail tel qu'il a été envoyé.",
			},
		},
		home: {
			title: "Vos briefs",
			greeting: (name: string) => `Connecté en tant que ${name}`,
			placeholder:
				"C'est ici que votre brief quotidien apparaîtra. La mise en page de lecture arrive ensuite.",
			manageTopics: "Gérer mes sujets",
			adminArea: "Espace admin",
			signOut: "Se déconnecter",
		},
		admin: {
			title: "Administration",
			lead: "Réservé aux administrateurs.",
			nav: {
				label: "Sections admin",
				toggle: "Afficher ou masquer la navigation",
				categories: "Catégories",
				backToBriefs: "Retour à mes briefs",
			},
			categories: {
				title: "Catégories",
				lead: "Toutes les catégories, leurs briefs et leurs abonnés.",
				search: {
					label: "Rechercher une catégorie",
					placeholder: "Rechercher un nom ou une description",
					clear: "Effacer la recherche",
				},
				columns: {
					name: "Nom",
					description: "Description",
					state: "État",
					createdAt: "Création",
					briefsCount: "Briefs",
					subscribersCount: "Abonnés",
					lastBrief: "Dernier brief",
				},
				state: {
					active: "Active",
					inactive: "Inactive",
				},
				// Libellés des statuts de job, affichés sur le dernier brief.
				jobStatus: {
					waiting_for_providers: "En attente des sources",
					pending: "En file",
					running: "En cours",
					finished: "Terminé",
					failed: "Échec",
				},
				// Affiché quand la catégorie n'a encore produit aucun brief.
				noBrief: "Aucun",
				sort: {
					ascending: "Trier par ordre croissant",
					descending: "Trier par ordre décroissant",
				},
				empty: {
					title: "Aucune catégorie",
					body: "Les catégories créées pour le pipeline quotidien apparaissent ici.",
				},
				noResults: {
					title: "Aucun résultat",
					body: (term: string) => `Rien ne correspond à « ${term} ».`,
					clear: "Effacer la recherche",
				},
				pagination: {
					range: (from: number, to: number, total: number) =>
						`${from}–${to} sur ${total}`,
					pageSize: "Lignes par page",
				},
				error: "Les catégories n'ont pas pu être chargées.",
				actions: {
					column: "Actions",
					open: (name: string) => `Actions pour ${name}`,
					edit: "Modifier",
					enable: "Activer",
					disable: "Désactiver",
					delete: "Supprimer",
				},
				form: {
					create: "Nouvelle catégorie",
					createTitle: "Nouvelle catégorie",
					editTitle: "Modifier la catégorie",
					name: "Nom",
					namePlaceholder: "Tech",
					description: "Description",
					descriptionPlaceholder: "Ce que couvre cette catégorie.",
					language: "Langue",
					languageHelp:
						"Tous les briefs de cette catégorie sont écrits et lus dans cette langue.",
					providers: "Sources",
					providersPlaceholder: "Choisissez les sources à dépouiller",
					// Une catégorie sans source produit un brief vide, sans rien signaler.
					providersEmpty:
						"Aucune source rattachée : cette catégorie ne produira rien.",
					providersDisabled: (name: string) => `${name} (désactivée)`,
					isEnable: "Active",
					isEnableHelp: "Une catégorie désactivée ne produit aucun brief.",
					submitCreate: "Créer",
					submitEdit: "Enregistrer",
					cancel: "Annuler",
					loadError: "Cette catégorie n'a pas pu être chargée.",
				},
				validation: {
					nameRequired: "Le nom est obligatoire.",
					nameTooLong: (max: number) => `${max} caractères maximum.`,
					descriptionRequired: "La description est obligatoire.",
					descriptionTooLong: (max: number) => `${max} caractères maximum.`,
				},
				confirmDelete: {
					title: "Supprimer cette catégorie ?",
					body: (name: string) =>
						`« ${name} », ses briefs et leurs fichiers audio seront supprimés. Cette action est irréversible.`,
					confirm: "Supprimer",
					cancel: "Annuler",
				},
				notifications: {
					created: (name: string) => `Catégorie « ${name} » créée.`,
					updated: (name: string) => `Catégorie « ${name} » enregistrée.`,
					enabled: (name: string) => `« ${name} » est maintenant active.`,
					disabled: (name: string) => `« ${name} » est maintenant inactive.`,
					deleted: (name: string) => `Catégorie « ${name} » supprimée.`,
				},
			},
		},
	},
};
