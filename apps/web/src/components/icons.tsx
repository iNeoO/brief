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

export function ArrowRightIcon({ size = 20, className }: IconProps) {
	return (
		<Glyph size={size} className={className}>
			<path d="M4 12h15m-6-6 6 6-6 6" />
		</Glyph>
	);
}

export function ListIcon({ size = 20, className }: IconProps) {
	return (
		<Glyph size={size} className={className}>
			<path d="m3 6.5 2 2 3.5-3.5M3 17.5l2 2 3.5-3.5" />
			<path d="M12 7h9M12 18h9" />
		</Glyph>
	);
}

export function NewspaperIcon({ size = 20, className }: IconProps) {
	return (
		<Glyph size={size} className={className}>
			<path d="M4 5h13v14H5.5A1.5 1.5 0 0 1 4 17.5Z" />
			<path d="M17 9h3v8.5a1.5 1.5 0 0 1-3 0Z" />
			<path d="M7 8.5h7M7 12h7M7 15.5h4" />
		</Glyph>
	);
}

export function SparkIcon({ size = 20, className }: IconProps) {
	return (
		<Glyph size={size} className={className}>
			<path d="M12 3.5c.9 3.6 2.4 5.1 6 6-3.6.9-5.1 2.4-6 6-.9-3.6-2.4-5.1-6-6 3.6-.9 5.1-2.4 6-6Z" />
			<path d="M5 16.5c.4 1.6 1 2.2 2.5 2.6-1.5.4-2.1 1-2.5 2.6-.4-1.6-1-2.2-2.5-2.6 1.5-.4 2.1-1 2.5-2.6Z" />
		</Glyph>
	);
}

export function MailIcon({ size = 20, className }: IconProps) {
	return (
		<Glyph size={size} className={className}>
			<rect x="3" y="5.5" width="18" height="13" rx="2" />
			<path d="m3.5 7 8.5 6 8.5-6" />
		</Glyph>
	);
}

export function UserIcon({ size = 18, className }: IconProps) {
	return (
		<Glyph size={size} className={className}>
			<circle cx="12" cy="8" r="3.75" />
			<path d="M4.75 20a7.25 7.25 0 0 1 14.5 0" />
		</Glyph>
	);
}

export function ShieldIcon({ size = 18, className }: IconProps) {
	return (
		<Glyph size={size} className={className}>
			<path d="M12 3.25l7 2.5v5.5c0 4-2.9 7.6-7 9.5-4.1-1.9-7-5.5-7-9.5v-5.5Z" />
		</Glyph>
	);
}

export function SignOutIcon({ size = 18, className }: IconProps) {
	return (
		<Glyph size={size} className={className}>
			<path d="M15 4.75H6.5v14.5H15" />
			<path d="M12.5 12h8m0 0-3-3m3 3-3 3" />
		</Glyph>
	);
}
