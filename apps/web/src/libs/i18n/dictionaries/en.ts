export const en = {
	meta: {
		title: "The essentials of the day, in a few minutes",
		description:
			"One short summary per topic you follow, every morning. Read it or listen to it in a few minutes.",
	},
	seo: {
		briefs: {
			title: "Brief archive",
			description:
				"Every brief published so far: one short, factual summary per topic, newest first, each with the articles it was written from.",
		},
		brief: {
			title: (topic: string, date: string) => `${topic} — brief of ${date}`,
			description: (topic: string, date: string) =>
				`The ${topic} brief of ${date}: a short, factual summary of the day's articles, to read or to listen to.`,
		},
		howItWorks: {
			title: "How your daily brief is made",
			description:
				"You choose your topics once. Every morning we read their press sources, write one short summary per topic, and deliver it at 7:00 — to read or to listen to.",
		},
		signUp: {
			title: "Create your account",
			description:
				"Choose your topics and get your first briefs tomorrow at 7:00. One Telegram message per topic you follow, and unsubscribing takes one click.",
		},
		page: (page: number) => `page ${page}`,
	},
	a11y: {
		skipToContent: "Skip to content",
		mainNavigation: "Main navigation",
		siteActions: "Preferences and account",
		homeLink: "Home",
	},
	nav: {
		myTopics: "My topics",
		myBriefs: "My briefs",
		howItWorks: "How it works",
		signIn: "Sign in",
		signUp: "Sign up",
		account: {
			trigger: (name: string) => `Account: ${name}`,
			profile: "My profile",
			admin: "Admin area",
			signOut: "Sign out",
		},
	},
	colorScheme: {
		toDark: "Switch to dark mode",
		toLight: "Switch to light mode",
	},
	language: {
		label: "Language",
		current: (label: string) => `Language: ${label}`,
	},
	hero: {
		title: "The essentials, without the noise.",
		lead: "One short summary per topic you follow, waiting for you each morning.",
		cta: "Start reading",
		rhythm:
			"One Telegram message per topic you follow, every morning at 7:00. Nothing else.",
	},
	method: {
		title: "How it works",
		seeMore: "See the whole flow",
		page: {
			title: "How it works",
			lead: "You choose your topics once. Every morning after that, we do the reading and the writing, and your brief is waiting for you at 7:00.",
			diagramLabel:
				"The path of a brief: your topics, the sources we read, the summary written from them, and the delivery at 7:00.",
			caption:
				"The same four steps run every morning, for each topic you follow.",
			flow: [
				{ title: "Your topics", meta: "You, once" },
				{ title: "The sources", meta: "Every morning" },
				{ title: "The summary", meta: "One per topic" },
				{ title: "Your brief", meta: "At 7:00" },
			],
			details: [
				{
					title: "You choose your topics",
					body: "Follow a topic and its brief reaches you on Telegram every morning. Unfollow it and it stops the next day — you can change your mind any morning.",
				},
				{
					title: "We read the sources",
					body: "Each topic has its own set of press sources. Every morning we collect the articles they published, and keep the ones that matter for that topic.",
				},
				{
					title: "One summary per topic",
					body: "Those articles become a single short, factual summary, in the language of the topic. Every brief lists the articles it was written from, so you can go and read the original.",
				},
				{
					title: "It arrives at 7:00",
					body: "Read the summary on the site, or listen to it — every morning, the audio of each topic you follow arrives on Telegram. Nothing else, and unsubscribing takes one click.",
				},
			],
		},
		steps: [
			{
				title: "You choose your topics",
				body: "Keep only the subjects you care about, and leave out the rest.",
			},
			{
				title: "We read the press for you",
				body: "Each topic is followed across a range of sources, then summarised.",
			},
			{
				title: "You receive your brief",
				body: "A clear, factual summary each morning. Read it, or listen to it.",
			},
		],
	},
	brief: {
		title: "Latest briefs",
		lead: "The most recent brief of each topic we cover.",
		readTime: (minutes: number) => `${minutes} min`,
		readTimeLabel: (minutes: number) => `${minutes} minutes to read`,
		listen: "Listen",
		listenLabel: (headline: string) => `Listen to the brief: ${headline}`,
		read: "Read the brief",
		seeAll: "See every brief",
		empty: {
			title: "No brief has been published yet",
			body: "The first ones arrive as soon as a topic goes through the morning run.",
		},
		loadError: "The briefs could not be loaded.",
	},
	briefs: {
		nav: "Briefs",
		title: "Every brief",
		lead: "All the briefs published so far, newest first.",
		empty: {
			title: "Nothing published yet",
			body: "Briefs appear here as soon as the morning run produces its first one.",
		},
		loadError: "The briefs could not be loaded.",
		pagination: {
			previous: "Previous",
			next: "Next",
			position: (page: number, pageCount: number) =>
				`Page ${page} of ${pageCount}`,
		},
		detail: {
			back: "Back to every brief",
			publishedOn: (date: string) => `Published on ${date}`,
			listenTitle: "Listen",
			download: "Download the audio",
			downloadLabel: (name: string) =>
				`Download the audio of the ${name} brief`,
			noAudio: "The audio of this brief is not available.",
			sourcesTitle: "Sources",
			sourcesLead:
				"The articles this brief was written from, in the order it covers them.",
			sourceLabel: (title: string, provider: string) =>
				`${title} — ${provider}, opens in a new tab`,
			notFound: {
				title: "This brief does not exist",
				body: "It may never have been published, or it was removed with its topic.",
				cta: "See every brief",
			},
		},
	},
	topics: {
		title: "Topics covered",
		lead: "Follow one, or follow them all. You can change your mind any morning.",
		items: [
			"Technology",
			"Economy",
			"International",
			"Science",
			"Culture",
			"Sport",
		],
	},
	closing: {
		title: "Start tomorrow morning.",
		body: "Choose your topics, and your first brief arrives at 7:00.",
		cta: "Create my account",
		note: "One Telegram message per topic you follow, every morning. Unsubscribe in one click.",
		signedIn: {
			title: "Tomorrow morning, at 7:00.",
			body: "Follow one more topic and it joins your next brief.",
			cta: "Manage my topics",
			note: "Unfollow whenever you like — it stops the next day.",
		},
	},
	footer: {
		about: "About",
		legal: "Legal notice",
		privacy: "Privacy",
		contact: "Contact",
		rights: (year: number, brand: string) => `© ${year} ${brand}`,
	},
	notFound: {
		title: "This page does not exist",
		lead: "The address may be mistyped, or the page moved since the link was written.",
		home: "Back to the home page",
		briefs: "See every brief",
	},
	auth: {
		backToSite: "Back to the site",
		fields: {
			name: "Name",
			email: "Email address",
			password: "Password",
			currentPassword: "Current password",
			newPassword: "New password",
			confirmPassword: "Confirm new password",
			passwordHint: "At least 8 characters.",
		},
		validation: {
			nameRequired: "Enter your name.",
			emailRequired: "Enter your email address.",
			emailInvalid: "Enter a valid email address.",
			passwordRequired: "Enter your password.",
			passwordTooShort: "Use at least 8 characters.",
			passwordMismatch: "The two passwords do not match.",
		},
		genericError: "Something went wrong. Please try again.",
		tooManyRequests: "Too many attempts. Try again in a few minutes.",
		signIn: {
			title: "Sign in",
			lead: "Pick up where you left off.",
			submit: "Sign in",
			rememberMe: "Keep me signed in",
			forgotPassword: "Forgotten your password?",
			noAccount: "No account yet?",
			createAccount: "Create one",
			invalidCredentials: "That email and password do not match.",
			emailNotVerified:
				"Confirm your email address before signing in. Check your inbox for the link.",
			resend: "Send the link again",
			resent: "Link sent. Check your inbox.",
		},
		signUp: {
			title: "Create your account",
			lead: "Choose your topics and get your first brief tomorrow at 7:00.",
			submit: "Create my account",
			hasAccount: "Already have an account?",
			signIn: "Sign in",
			emailTaken: "An account already exists with this email address.",
			closed: {
				title: "Sign-ups are closed for the moment",
				body: "We are finishing Telegram delivery. Until then, write to us and we will create your account by hand.",
				write: "Write to us",
			},
			checkInbox: {
				title: "Confirm your email address",
				body: (email: string) =>
					`We sent a link to ${email}. Open it to activate your account, then sign in.`,
				resend: "Send the link again",
				resent: "Link sent. Check your inbox.",
			},
		},
		forgotPassword: {
			title: "Reset your password",
			lead: "Enter your email address and we will send you a link.",
			submit: "Send the link",
			backToSignIn: "Back to sign in",
			sent: {
				title: "Check your inbox",
				body: "If an account exists for that address, a reset link is on its way.",
			},
		},
		resetPassword: {
			title: "Choose a new password",
			lead: "Pick something you have not used here before.",
			submit: "Save my new password",
			invalidToken:
				"This link is no longer valid. Reset links expire — request a new one.",
			requestNew: "Request a new link",
			missingToken: {
				title: "This link is incomplete",
				body: "Open the link from your email exactly as it was sent, or request a new one.",
			},
			done: {
				title: "Password changed",
				body: "You can now sign in with your new password.",
				cta: "Sign in",
			},
		},
		validateEmail: {
			pageTitle: "Email confirmation",
			pending: "Confirming your email address…",
			done: {
				title: "Email address confirmed",
				body: "Your account is active. Sign in to read your first brief.",
				cta: "Sign in",
			},
			failed: {
				title: "We could not confirm this link",
				body: "Verification links expire. Sign in to have a new one sent to you.",
				cta: "Go to sign in",
			},
			missingToken: {
				title: "This link is incomplete",
				body: "Open the link from your email exactly as it was sent.",
			},
		},
		home: {
			title: "Your briefs",
			lead: "Every brief of the topics you follow, newest first.",
			empty: {
				title: "No brief for your topics yet",
				body: "Follow a topic and its briefs appear here — the ones already published, and the one that arrives tomorrow at 7:00.",
				cta: "Choose my topics",
			},
		},
		profile: {
			title: "Your profile",
			lead: "Your account and your password.",
			back: "Back to my briefs",
			account: {
				title: "Account",
				email: "Email address",
				emailVerified: "Verified",
				emailUnverified: "Not verified",
				role: "Role",
				roles: { user: "Reader", admin: "Administrator" },
				memberSince: "Member since",
			},
			identity: {
				title: "Your name",
				lead: "The name your briefs greet you with. Your email address cannot be changed here: it is how you sign in.",
				submit: "Save",
				success: "Your name has been saved.",
			},
			password: {
				title: "Password",
				lead: "Changing your password signs out your other devices. This one stays signed in.",
				submit: "Change my password",
				success: "Your password has been changed.",
				incorrect: "That is not your current password.",
			},
			telegram: {
				title: "Telegram",
				lead: "Where your briefs are delivered. You open our Telegram bot and press Start.",
				// The sentence shown next to the button: it *is* the opt-in record,
				// which is why it names Brief, says what will be sent and how to stop.
				// Pressing Start proves the Telegram account is yours, not that you
				// agreed — the agreement happens here.
				consent:
					"By pressing this button, I authorise Brief to send me my daily briefs on Telegram. I can stop at any time by sending /stop to the bot, or by withdrawing the authorisation from this page.",
				acknowledgement:
					"Thank you, it is noted. Your briefs will arrive in this conversation. Send /stop to end them.",
				idle: {
					body: "Open our Telegram bot, press Start, and it is done. We never write to you first.",
					action: "Authorise Telegram",
				},
				waiting: {
					open: "Open Telegram",
					body: "Waiting for your Start. Press it in Telegram and this page will update on its own.",
					manual: (bot: string) =>
						`If Telegram did not open, search for ${bot} in Telegram and send it this command:`,
					restart: "Start again",
				},
				verified: {
					badge: "Authorised",
					continue: "Continue where you left off",
					state: "Status",
					since: "Authorised on",
					remove: "Withdraw the authorisation",
					removed: "The authorisation has been withdrawn.",
				},
				optedOut: {
					badge: "Stopped",
					body: "You sent /stop, or blocked the bot, so nothing is sent on Telegram any more. You can authorise it again whenever you like.",
				},
				error: "The authorisation could not be prepared. Please try again.",
			},
		},
		topics: {
			title: "Your topics",
			lead: "Follow a topic and its brief reaches you on Telegram every morning. Unfollow whenever you like.",
			back: "Back to my briefs",
			loadError: "The topics could not be loaded.",
			pagination: (page: number, pageCount: number) =>
				`Page ${page} of ${pageCount}`,
			card: {
				created: (date: string) => `Added ${date}`,
				briefs: (count: number) =>
					count === 1 ? "1 brief published" : `${count} briefs published`,
				subscribed: (date: string) => `Followed since ${date}`,
				paused: "Paused",
			},
			subscribed: {
				title: "Topics you follow",
				lead: "Most recently followed first.",
				action: "Unsubscribe",
				search: {
					label: "Search the topics you follow",
					placeholder: "Search a name or a description",
					clear: "Clear the search",
				},
				empty: {
					title: "You follow no topic yet",
					body: "Pick one below, and your first brief on it arrives tomorrow at 7:00.",
				},
				noResults: {
					title: "No match",
					body: (term: string) =>
						`None of the topics you follow matches “${term}”.`,
				},
			},
			available: {
				title: "Available topics",
				lead: "Most recently added first.",
				action: "Subscribe",
				search: {
					label: "Search the available topics",
					placeholder: "Search a name or a description",
					clear: "Clear the search",
				},
				empty: {
					title: "Nothing left to follow",
					body: "You already follow every topic we cover. New ones show up here.",
				},
				noResults: {
					title: "No match",
					body: (term: string) => `No available topic matches “${term}”.`,
				},
			},
			notifications: {
				pairingNeeded:
					"One more step: authorise Telegram to receive this brief.",
				subscribed: (name: string) => `You now follow ${name}.`,
				unsubscribed: (name: string) => `You no longer follow ${name}.`,
			},
		},
		admin: {
			title: "Administration",
			lead: "Reserved for administrators.",
			nav: {
				label: "Admin sections",
				toggle: "Toggle navigation",
				categories: "Categories",
				backToBriefs: "Back to my briefs",
			},
			table: {
				sort: {
					ascending: "Sort ascending",
					descending: "Sort descending",
				},
				pagination: {
					range: (from: number, to: number, total: number) =>
						`${from}–${to} of ${total}`,
					pageSize: "Rows per page",
				},
				clearSearch: "Clear the search",
			},
			jobStatus: {
				waiting_for_providers: "Waiting for sources",
				pending: "Queued",
				running: "Running",
				finished: "Finished",
				failed: "Failed",
				no_articles_selected: "No article kept",
			},
			categories: {
				title: "Categories",
				lead: "Every category, its briefs and its subscribers.",
				search: {
					label: "Search categories",
					placeholder: "Search a name or a description",
					clear: "Clear the search",
				},
				columns: {
					name: "Name",
					description: "Description",
					state: "State",
					createdAt: "Created",
					briefsCount: "Briefs",
					subscribersCount: "Subscribers",
					lastBrief: "Last brief",
				},
				state: {
					active: "Active",
					inactive: "Inactive",
				},
				noBrief: "None yet",
				empty: {
					title: "No category yet",
					body: "Categories created for the daily pipeline show up here.",
				},
				noResults: {
					title: "No match",
					body: (term: string) => `Nothing matches “${term}”.`,
				},
				error: "The categories could not be loaded.",
				actions: {
					column: "Actions",
					open: (name: string) => `Actions for ${name}`,
					edit: "Edit",
					enable: "Enable",
					disable: "Disable",
					delete: "Delete",
				},
				form: {
					create: "New category",
					createTitle: "New category",
					editTitle: "Edit category",
					name: "Name",
					namePlaceholder: "Tech",
					description: "Description",
					descriptionPlaceholder: "What this category covers.",
					language: "Language",
					languageHelp:
						"Every brief of this category is written and voiced in it.",
					providers: "Sources",
					providersPlaceholder: "Pick the sources to read",
					providersEmpty:
						"No source is attached: this category will produce nothing.",
					providersDisabled: (name: string) => `${name} (disabled)`,
					providersNonePlaceholder: "No source available",
					providersNone:
						"No source is registered yet. Run `pnpm drizzle:seed` to install the supported media.",
					providersLoadError: "The sources could not be loaded.",
					isEnabled: "Active",
					isEnabledHelp: "A disabled category produces no brief.",
					submitCreate: "Create",
					submitEdit: "Save",
					cancel: "Cancel",
					loadError: "This category could not be loaded.",
				},
				validation: {
					nameRequired: "A name is required.",
					nameTooLong: (max: number) => `${max} characters maximum.`,
					descriptionRequired: "A description is required.",
					descriptionTooLong: (max: number) => `${max} characters maximum.`,
				},
				confirmDelete: {
					title: "Delete this category?",
					body: (name: string) =>
						`“${name}”, its briefs and their audio files will be deleted. This cannot be undone.`,
					confirm: "Delete",
					cancel: "Cancel",
				},
				notifications: {
					created: (name: string) => `Category “${name}” created.`,
					updated: (name: string) => `Category “${name}” saved.`,
					enabled: (name: string) => `“${name}” is now active.`,
					disabled: (name: string) => `“${name}” is now inactive.`,
					deleted: (name: string) => `Category “${name}” deleted.`,
				},
			},
		},
	},
};

export type Dictionary = typeof en;
