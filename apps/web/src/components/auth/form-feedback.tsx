import { Alert } from "@mantine/core";

export function FormError({ children }: { children: React.ReactNode }) {
	return (
		<Alert color="red" variant="light" radius="sm" role="alert">
			{children}
		</Alert>
	);
}

export function FormNote({ children }: { children: React.ReactNode }) {
	return (
		<Alert color="accent" variant="light" radius="sm" role="alert">
			{children}
		</Alert>
	);
}
