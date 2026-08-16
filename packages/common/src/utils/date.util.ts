export function formatDateToYMD(date: Date, timeZone = "Europe/Paris"): string {
	return new Intl.DateTimeFormat("en-CA", {
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		timeZone,
	}).format(date);
}
