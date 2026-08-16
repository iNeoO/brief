import {
	ActionIcon,
	Box,
	useMantineColorScheme,
	VisuallyHidden,
} from "@mantine/core";
import { MoonIcon, SunIcon } from "#/components/icons";
import { useI18n } from "#/libs/i18n/context";

export function ColorSchemeToggle() {
	const { t } = useI18n();
	const { toggleColorScheme } = useMantineColorScheme();

	return (
		<ActionIcon
			variant="subtle"
			color="gray"
			size={44}
			radius="sm"
			onClick={toggleColorScheme}
		>
			<Box component="span" darkHidden>
				<MoonIcon size={19} />
				<VisuallyHidden>{t.colorScheme.toDark}</VisuallyHidden>
			</Box>
			<Box component="span" lightHidden>
				<SunIcon size={19} />
				<VisuallyHidden>{t.colorScheme.toLight}</VisuallyHidden>
			</Box>
		</ActionIcon>
	);
}
