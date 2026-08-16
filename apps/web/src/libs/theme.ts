import {
	createTheme,
	type MantineColorsTuple,
	virtualColor,
} from "@mantine/core";

const ink: MantineColorsTuple = [
	"#eef2fa",
	"#dde4f2",
	"#b7c6e4",
	"#8ea6d6",
	"#6c8bc9",
	"#557ac1",
	"#4870bd",
	"#3a5fa6",
	"#325494",
	"#264682",
];

const neutral: MantineColorsTuple = [
	"#e9ebf0", // text
	"#ced3dd",
	"#a1a6ad", // dimmed
	"#828997", // placeholder
	"#2e333c", // borders
	"#22262d",
	"#22262d", // raised surfaces (menus, default buttons)
	"#1b1e24", // page background
	"#16191e",
	"#101317",
];

const FONT_FAMILY_DISPLAY =
	'"Inter Tight Variable", "Inter Variable", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

const FONT_FAMILY_BODY =
	'"Inter Variable", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

export const theme = createTheme({
	primaryColor: "accent",
	// Light mode fills with the deep shade, dark mode with the pale one.
	primaryShade: { light: 8, dark: 3 },
	autoContrast: true,
	colors: {
		accent: virtualColor({ name: "accent", light: "ink", dark: "ink" }),
		ink,
		dark: neutral,
	},
	fontFamily: FONT_FAMILY_BODY,
	fontFamilyMonospace:
		"ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
	headings: {
		fontFamily: FONT_FAMILY_DISPLAY,
		fontWeight: "600",
		sizes: {
			h1: { fontSize: "clamp(2.125rem, 5vw, 3.25rem)", lineHeight: "1.08" },
			h2: { fontSize: "clamp(1.5rem, 3vw, 2rem)", lineHeight: "1.15" },
			h3: { fontSize: "1.375rem", lineHeight: "1.25" },
			h4: { fontSize: "1.125rem", lineHeight: "1.3" },
		},
	},
	// Five sizes, body at 17px.
	fontSizes: {
		xs: "0.8125rem",
		sm: "0.9375rem",
		md: "1.0625rem",
		lg: "1.1875rem",
		xl: "1.375rem",
	},
	lineHeights: {
		xs: "1.5",
		sm: "1.55",
		md: "1.65",
		lg: "1.6",
		xl: "1.5",
	},
	radius: {
		xs: "2px",
		sm: "4px",
		md: "6px",
		lg: "10px",
		xl: "16px",
	},
	defaultRadius: "sm",
	spacing: {
		xs: "0.5rem",
		sm: "0.75rem",
		md: "1rem",
		lg: "1.5rem",
		xl: "2.5rem",
	},
	cursorType: "pointer",
});
