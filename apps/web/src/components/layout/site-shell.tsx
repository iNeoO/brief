import { useI18n } from "#/libs/i18n/context";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

const MAIN_ID = "main";

export function SiteShell({ children }: { children: React.ReactNode }) {
	const { t } = useI18n();

	return (
		<>
			<a href={`#${MAIN_ID}`} className="brief-skip-link">
				{t.a11y.skipToContent}
			</a>

			<SiteHeader />

			<main id={MAIN_ID}>{children}</main>

			<SiteFooter />
		</>
	);
}
