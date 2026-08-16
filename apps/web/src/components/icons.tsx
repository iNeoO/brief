type IconProps = {
	size?: number | string;
	className?: string;
};

function Glyph({
	size,
	className,
	children,
}: IconProps & { children: React.ReactNode }) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={1.6}
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
			focusable="false"
			className={className}
		>
			{children}
		</svg>
	);
}

export function SunIcon({ size = 18, className }: IconProps) {
	return (
		<Glyph size={size} className={className}>
			<circle cx="12" cy="12" r="4" />
			<path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
		</Glyph>
	);
}

export function MoonIcon({ size = 18, className }: IconProps) {
	return (
		<Glyph size={size} className={className}>
			<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />
		</Glyph>
	);
}

export function GlobeIcon({ size = 18, className }: IconProps) {
	return (
		<Glyph size={size} className={className}>
			<circle cx="12" cy="12" r="9" />
			<path d="M3.6 9h16.8M3.6 15h16.8" />
			<path d="M12 3c2.2 2.4 3.3 5.4 3.3 9s-1.1 6.6-3.3 9c-2.2-2.4-3.3-5.4-3.3-9S9.8 5.4 12 3Z" />
		</Glyph>
	);
}

export function ChevronDownIcon({ size = 16, className }: IconProps) {
	return (
		<Glyph size={size} className={className}>
			<path d="m6 9.5 6 6 6-6" />
		</Glyph>
	);
}

export function PlayIcon({ size = 16, className }: IconProps) {
	return (
		<Glyph size={size} className={className}>
			<path d="M8 5.5v13l11-6.5-11-6.5Z" />
		</Glyph>
	);
}

export function ClockIcon({ size = 15, className }: IconProps) {
	return (
		<Glyph size={size} className={className}>
			<circle cx="12" cy="12" r="8.5" />
			<path d="M12 7.5V12l3 2" />
		</Glyph>
	);
}

export function DotsIcon({ size = 18, className }: IconProps) {
	return (
		<Glyph size={size} className={className}>
			<circle cx="12" cy="5" r="1.4" fill="currentColor" />
			<circle cx="12" cy="12" r="1.4" fill="currentColor" />
			<circle cx="12" cy="19" r="1.4" fill="currentColor" />
		</Glyph>
	);
}

export function PlusIcon({ size = 16, className }: IconProps) {
	return (
		<Glyph size={size} className={className}>
			<path d="M12 5v14M5 12h14" />
		</Glyph>
	);
}

export function CheckIcon({ size = 16, className }: IconProps) {
	return (
		<Glyph size={size} className={className}>
			<path d="m5 12.5 4.5 4.5L19 7.5" />
		</Glyph>
	);
}
