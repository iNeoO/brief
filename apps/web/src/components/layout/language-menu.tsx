import { Box, Menu } from "@mantine/core";
import { CheckIcon, ChevronDownIcon, GlobeIcon } from "#/components/icons";
import { LOCALE_LABELS, LOCALES } from "#/libs/i18n/config";
import { useI18n } from "#/libs/i18n/context";
import classes from "./layout.module.css";

export function LanguageMenu() {
	const { locale, setLocale, t } = useI18n();

	return (
		<Menu position="bottom-end" width={190} radius="sm" shadow="xs">
			<Menu.Target>
				<button
					type="button"
					className={classes.languageTrigger}
					aria-label={t.language.current(LOCALE_LABELS[locale])}
				>
					<GlobeIcon size={17} />
					<span className={classes.languageCode}>{locale}</span>
					<ChevronDownIcon size={14} />
				</button>
			</Menu.Target>

			<Menu.Dropdown>
				<Menu.Label>{t.language.label}</Menu.Label>
				{LOCALES.map((option) => (
					<Menu.Item
						key={option}
						onClick={() => setLocale(option)}
						// The tick, not a colour, is what marks the active language.
						leftSection={
							option === locale ? <CheckIcon size={15} /> : <Box w={15} />
						}
					>
						{LOCALE_LABELS[option]}
					</Menu.Item>
				))}
			</Menu.Dropdown>
		</Menu>
	);
}
