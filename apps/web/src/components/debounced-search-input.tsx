import { CloseButton, TextInput } from "@mantine/core";
import { useEffect, useRef, useState } from "react";

const SEARCH_DEBOUNCE_MS = 300;

/**
 * Every search box shows the same three strings; each dictionary section that
 * has a search box declares them under this shape.
 */
export type SearchInputLabels = {
	label: string;
	placeholder: string;
	clear: string;
};

/**
 * A search box that owns the characters being typed and only pushes the
 * trimmed term out once typing settles. `value` is the committed term — read
 * back from the URL by both callers — so a back navigation or a hand-edited
 * URL updates the input, while the reader keeps typing undisturbed.
 */
export function DebouncedSearchInput({
	value,
	onCommit,
	labels,
	className,
}: {
	value: string | undefined;
	onCommit: (term: string | undefined) => void;
	labels: SearchInputLabels;
	className?: string;
}) {
	const [term, setTerm] = useState(value ?? "");
	// What we last pushed out. Without it, the echo of our own update would
	// overwrite the characters typed while the debounce was running.
	const committed = useRef(value ?? "");
	// Only read when the debounce fires, so an inline callback at the call site
	// does not restart the timer on every render.
	const commit = useRef(onCommit);

	useEffect(() => {
		commit.current = onCommit;
	}, [onCommit]);

	useEffect(() => {
		const next = value ?? "";

		if (next === committed.current) {
			return;
		}

		committed.current = next;
		setTerm(next);
	}, [value]);

	useEffect(() => {
		if (term === committed.current) {
			return;
		}

		const timeout = setTimeout(() => {
			committed.current = term;
			commit.current(term.trim() || undefined);
		}, SEARCH_DEBOUNCE_MS);

		return () => clearTimeout(timeout);
	}, [term]);

	return (
		<TextInput
			className={className}
			aria-label={labels.label}
			placeholder={labels.placeholder}
			value={term}
			onChange={(event) => setTerm(event.currentTarget.value)}
			rightSection={
				term ? (
					<CloseButton
						size="sm"
						aria-label={labels.clear}
						onClick={() => setTerm("")}
					/>
				) : null
			}
		/>
	);
}
