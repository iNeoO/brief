export const en = {
	meta: {
		title: "The essentials of the day, in a few minutes",
		description:
			"One short summary per topic you follow, every morning. Read it or listen to it in a few minutes.",
	},
	a11y: {
		skipToContent: "Skip to content",
		mainNavigation: "Main navigation",
		siteActions: "Preferences and account",
		homeLink: "Home",
	},
	nav: {
		topics: "Topics",
		howItWorks: "How it works",
		signIn: "Sign in",
		signUp: "Sign up",
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
		rhythm: "One email each morning, at 7:00. Nothing else.",
	},
	method: {
		title: "How it works",
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
		note: "One email a day. Unsubscribe in one click.",
	},
	footer: {
		about: "About",
		legal: "Legal notice",
		privacy: "Privacy",
		contact: "Contact",
		rights: (year: number, brand: string) => `© ${year} ${brand}`,
	},
	auth: {
		backToSite: "Back to the site",
		fields: {
			name: "Name",
			email: "Email address",
			password: "Password",
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
			// Deliberately says nothing about whether the account exists.
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
			// Stable heading for every outcome, so the page title and the notice
			// below it never say the same sentence twice.
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
			greeting: (name: string) => `Signed in as ${name}`,
			placeholder:
				"This is where your daily brief will live. The reading layout comes next.",
			manageTopics: "Manage my topics",
			adminArea: "Admin area",
			signOut: "Sign out",
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
				// Wording of the job statuses, seen on the last brief of a category.
				jobStatus: {
					waiting_for_providers: "Waiting for sources",
					pending: "Queued",
					running: "Running",
					finished: "Finished",
					failed: "Failed",
				},
				// Shown where a category has never produced a brief.
				noBrief: "None yet",
				sort: {
					ascending: "Sort ascending",
					descending: "Sort descending",
				},
				empty: {
					title: "No category yet",
					body: "Categories created for the daily pipeline show up here.",
				},
				noResults: {
					title: "No match",
					body: (term: string) => `Nothing matches “${term}”.`,
					clear: "Clear the search",
				},
				pagination: {
					range: (from: number, to: number, total: number) =>
						`${from}–${to} of ${total}`,
					pageSize: "Rows per page",
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
					// A category with no source produces an empty brief, silently.
					providersEmpty:
						"No source is attached: this category will produce nothing.",
					providersDisabled: (name: string) => `${name} (disabled)`,
					isEnable: "Active",
					isEnableHelp: "A disabled category produces no brief.",
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
