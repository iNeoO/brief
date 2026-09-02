import type { Dictionary } from "./en";

export const fr: Dictionary = {
	meta: {
		title: "L'essentiel de la journée, en quelques minutes",
		description:
			"Un résumé court par sujet suivi, chaque matin. À lire ou à écouter en quelques minutes.",
	},
	seo: {
		briefs: {
			title: "Archive des briefs",
			description:
				"Tous les briefs publiés à ce jour : un résumé court et factuel par sujet, du plus récent au plus ancien, avec les articles dont il est tiré.",
		},
		brief: {
			title: (topic: string, date: string) => `${topic} — brief du ${date}`,
			description: (topic: string, date: string) =>
				`Le brief ${topic} du ${date} : un résumé court et factuel des articles du jour, à lire ou à écouter.`,
		},
		howItWorks: {
			title: "Comment votre brief quotidien est fabriqué",
			description:
				"Vous choisissez vos sujets une fois. Chaque matin, nous lisons leurs sources de presse, écrivons un résumé court par sujet et vous le livrons à 7 h — à lire ou à écouter.",
		},
		signUp: {
			title: "Créer votre compte",
			description:
				"Choisissez vos sujets et recevez vos premiers briefs demain à 7 h. Un message Telegram par sujet suivi, et un clic suffit pour se désinscrire.",
		},
		page: (page: number) => `page ${page}`,
	},
	a11y: {
		skipToContent: "Aller au contenu",
		mainNavigation: "Navigation principale",
		siteActions: "Préférences et compte",
		homeLink: "Accueil",
	},
	nav: {
		myTopics: "Mes sujets",
		myBriefs: "Mes briefs",
		howItWorks: "Comment ça marche",
		signIn: "Se connecter",
		signUp: "S'inscrire",
		account: {
			trigger: (name: string) => `Compte : ${name}`,
			profile: "Mon profil",
			admin: "Espace admin",
			signOut: "Se déconnecter",
		},
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
		rhythm:
			"Un message Telegram par sujet suivi, chaque matin à 7 h. Rien d'autre.",
	},
	method: {
		title: "Comment ça marche",
		seeMore: "Voir tout le parcours",
		page: {
			title: "Comment ça marche",
			lead: "Vous choisissez vos sujets une fois. Chaque matin ensuite, nous lisons et rédigeons pour vous, et votre brief vous attend à 7 h.",
			diagramLabel:
				"Le parcours d'un brief : vos sujets, les sources que nous lisons, le résumé qui en est tiré, et l'envoi à 7 h.",
			caption:
				"Les mêmes quatre étapes se rejouent chaque matin, pour chaque sujet suivi.",
			flow: [
				{ title: "Vos sujets", meta: "Vous, une fois" },
				{ title: "Les sources", meta: "Chaque matin" },
				{ title: "Le résumé", meta: "Un par sujet" },
				{ title: "Votre brief", meta: "À 7 h" },
			],
			details: [
				{
					title: "Vous choisissez vos sujets",
					body: "Suivez un sujet et son brief vous arrive chaque matin sur Telegram. Ne le suivez plus et il s'arrête dès le lendemain : vous pouvez changer d'avis n'importe quel matin.",
				},
				{
					title: "Nous lisons les sources",
					body: "Chaque sujet a ses propres sources de presse. Chaque matin, nous récupérons les articles qu'elles ont publiés et gardons ceux qui comptent pour ce sujet.",
				},
				{
					title: "Un résumé par sujet",
					body: "Ces articles deviennent un seul résumé court et factuel, dans la langue du sujet. Chaque brief liste les articles dont il est tiré, pour aller lire l'original.",
				},
				{
					title: "Il arrive à 7 h",
					body: "Lisez le résumé sur le site, ou écoutez-le : chaque matin, l'audio de chaque sujet suivi arrive sur Telegram. Rien d'autre, et le désabonnement tient en un clic.",
				},
			],
		},
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
		title: "Les derniers briefs",
		lead: "Le brief le plus récent de chaque sujet que nous couvrons.",
		readTime: (minutes) => `${minutes} min`,
		readTimeLabel: (minutes) => `${minutes} minutes de lecture`,
		listen: "Écouter",
		listenLabel: (headline) => `Écouter le brief : ${headline}`,
		read: "Lire le brief",
		seeAll: "Voir tous les briefs",
		empty: {
			title: "Aucun brief n'a encore été publié",
			body: "Les premiers arrivent dès qu'un sujet passe par la génération du matin.",
		},
		loadError: "Les briefs n'ont pas pu être chargés.",
	},
	briefs: {
		nav: "Briefs",
		title: "Tous les briefs",
		lead: "Tous les briefs publiés jusqu'ici, du plus récent au plus ancien.",
		empty: {
			title: "Rien de publié pour le moment",
			body: "Les briefs apparaissent ici dès que la génération du matin produit le premier.",
		},
		loadError: "Les briefs n'ont pas pu être chargés.",
		pagination: {
			previous: "Précédent",
			next: "Suivant",
			position: (page: number, pageCount: number) =>
				`Page ${page} sur ${pageCount}`,
		},
		detail: {
			back: "Retour à tous les briefs",
			publishedOn: (date: string) => `Publié le ${date}`,
			listenTitle: "Écouter",
			download: "Télécharger l'audio",
			downloadLabel: (name: string) => `Télécharger l'audio du brief ${name}`,
			noAudio: "L'audio de ce brief n'est pas disponible.",
			sourcesTitle: "Sources",
			sourcesLead:
				"Les articles à partir desquels ce brief a été écrit, dans l'ordre où il les traite.",
			sourceLabel: (title: string, provider: string) =>
				`${title} — ${provider}, ouvre un nouvel onglet`,
			notFound: {
				title: "Ce brief n'existe pas",
				body: "Il n'a peut-être jamais été publié, ou il a été supprimé avec son sujet.",
				cta: "Voir tous les briefs",
			},
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
		note: "Un message Telegram par sujet suivi, chaque matin. Désinscription en un clic.",
		signedIn: {
			title: "Demain matin, à 7 h.",
			body: "Suivez un sujet de plus et il rejoint votre prochain brief.",
			cta: "Gérer mes sujets",
			note: "Ne le suivez plus quand vous voulez : il s'arrête dès le lendemain.",
		},
	},
	footer: {
		about: "À propos",
		legal: "Mentions légales",
		privacy: "Confidentialité",
		contact: "Contact",
		rights: (year: number, brand: string) => `© ${year} ${brand}`,
	},
	notFound: {
		title: "Cette page n'existe pas",
		lead: "L'adresse est peut-être mal écrite, ou la page a changé depuis que le lien a été écrit.",
		home: "Retour à l'accueil",
		briefs: "Voir tous les briefs",
	},
	auth: {
		backToSite: "Retour au site",
		fields: {
			name: "Nom",
			email: "Adresse e-mail",
			password: "Mot de passe",
			currentPassword: "Mot de passe actuel",
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
			closed: {
				title: "Les inscriptions sont momentanément fermées",
				body: "Nous terminons la livraison des briefs sur Telegram. D'ici là, écrivez-nous et nous créons votre compte à la main.",
				write: "Nous écrire",
			},
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
			lead: "Tous les briefs des sujets que vous suivez, du plus récent au plus ancien.",
			empty: {
				title: "Aucun brief pour vos sujets",
				body: "Suivez un sujet et ses briefs apparaissent ici — ceux déjà publiés, et celui qui arrive demain à 7h00.",
				cta: "Choisir mes sujets",
			},
		},
		profile: {
			title: "Votre profil",
			lead: "Votre compte et votre mot de passe.",
			back: "Retour à mes briefs",
			account: {
				title: "Compte",
				email: "Adresse email",
				emailVerified: "Vérifiée",
				emailUnverified: "Non vérifiée",
				role: "Rôle",
				roles: { user: "Lecteur", admin: "Administrateur" },
				memberSince: "Membre depuis",
			},
			identity: {
				title: "Votre nom",
				lead: "Le nom avec lequel vos briefs vous accueillent. Votre adresse email ne se change pas ici : c'est avec elle que vous vous connectez.",
				submit: "Enregistrer",
				success: "Votre nom a été enregistré.",
			},
			password: {
				title: "Mot de passe",
				lead: "Changer votre mot de passe déconnecte vos autres appareils. Celui-ci reste connecté.",
				submit: "Changer mon mot de passe",
				success: "Votre mot de passe a été changé.",
				incorrect: "Ce n'est pas votre mot de passe actuel.",
			},
			telegram: {
				title: "Telegram",
				lead: "Là où vos briefs vous sont remis. Vous ouvrez notre bot Telegram et vous appuyez sur Démarrer.",
				// La phrase affichée à côté du bouton : c'est *elle* qui est
				// enregistrée comme preuve du consentement. Appuyer sur Démarrer
				// prouve que le compte Telegram est bien le vôtre, pas que vous êtes
				// d'accord — l'accord se donne ici.
				consent:
					"En appuyant sur ce bouton, j'autorise Brief à m'envoyer mes briefs quotidiens sur Telegram. Je peux arrêter à tout moment en envoyant /stop au bot ou en retirant l'autorisation depuis cette page.",
				acknowledgement:
					"Merci, c'est noté. Vos briefs arriveront dans cette conversation. Envoyez /stop pour les arrêter.",
				idle: {
					body: "Ouvrez notre bot Telegram, appuyez sur Démarrer, et c'est fait. Nous ne vous écrivons jamais en premier.",
					action: "Autoriser Telegram",
				},
				waiting: {
					open: "Ouvrir Telegram",
					body: "Nous attendons votre Démarrer. Appuyez dessus dans Telegram, cette page se mettra à jour d'elle-même.",
					manual: (bot: string) =>
						`Si Telegram ne s'est pas ouvert, cherchez ${bot} dans Telegram et envoyez-lui cette commande :`,
					restart: "Recommencer",
				},
				verified: {
					badge: "Autorisé",
					continue: "Reprendre où vous en étiez",
					state: "État",
					since: "Autorisé le",
					remove: "Retirer l'autorisation",
					removed: "L'autorisation a été retirée.",
				},
				optedOut: {
					badge: "Interrompu",
					body: "Vous avez envoyé /stop, ou bloqué le bot : plus rien n'est envoyé sur Telegram. Vous pouvez autoriser à nouveau quand vous le souhaitez.",
				},
				error: "L'autorisation n'a pas pu être préparée. Veuillez réessayer.",
			},
		},
		topics: {
			title: "Vos sujets",
			lead: "Abonnez-vous à un sujet et son brief vous arrive chaque matin sur Telegram. Désabonnez-vous quand vous voulez.",
			back: "Retour à mes briefs",
			loadError: "Les sujets n'ont pas pu être chargés.",
			pagination: (page, pageCount) => `Page ${page} sur ${pageCount}`,
			card: {
				created: (date) => `Ajouté le ${date}`,
				briefs: (count) =>
					count === 1 ? "1 brief publié" : `${count} briefs publiés`,
				subscribed: (date) => `Abonné depuis le ${date}`,
				paused: "En pause",
			},
			subscribed: {
				title: "Vos abonnements",
				lead: "Les abonnements les plus récents en premier.",
				action: "Se désabonner",
				search: {
					label: "Rechercher parmi vos abonnements",
					placeholder: "Rechercher un nom ou une description",
					clear: "Effacer la recherche",
				},
				empty: {
					title: "Aucun abonnement pour l'instant",
					body: "Choisissez un sujet ci-dessous, et votre premier brief arrive demain à 7h00.",
				},
				noResults: {
					title: "Aucun résultat",
					body: (term) =>
						`Aucun de vos abonnements ne correspond à « ${term} ».`,
				},
			},
			available: {
				title: "Sujets disponibles",
				lead: "Les sujets les plus récents en premier.",
				action: "S'abonner",
				search: {
					label: "Rechercher parmi les sujets disponibles",
					placeholder: "Rechercher un nom ou une description",
					clear: "Effacer la recherche",
				},
				empty: {
					title: "Plus rien à suivre",
					body: "Vous êtes abonné à tous les sujets que nous couvrons. Les nouveaux apparaîtront ici.",
				},
				noResults: {
					title: "Aucun résultat",
					body: (term) => `Aucun sujet disponible ne correspond à « ${term} ».`,
				},
			},
			notifications: {
				pairingNeeded:
					"Encore une étape : autorisez Telegram pour recevoir ce brief.",
				subscribed: (name) => `Vous êtes abonné à ${name}.`,
				unsubscribed: (name) => `Vous n'êtes plus abonné à ${name}.`,
			},
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
				jobStatus: {
					waiting_for_providers: "En attente des sources",
					pending: "En file",
					running: "En cours",
					finished: "Terminé",
					failed: "Échec",
					no_articles_selected: "Aucun article retenu",
				},
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
					providersEmpty:
						"Aucune source rattachée : cette catégorie ne produira rien.",
					providersDisabled: (name: string) => `${name} (désactivée)`,
					providersNonePlaceholder: "Aucune source disponible",
					providersNone:
						"Aucune source n'est enregistrée. Lancez `pnpm drizzle:seed` pour installer les médias supportés.",
					providersLoadError: "Les sources n'ont pas pu être chargées.",
					isEnabled: "Active",
					isEnabledHelp: "Une catégorie désactivée ne produit aucun brief.",
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
