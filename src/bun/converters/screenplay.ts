/**
 * Screenplay ↔ CSV converter. Direct port of
 * backend/src/converters/screenplay.rs.
 *
 * Both directions are pure string manipulation — no I/O, no async — so
 * the port is mechanical. Behaviour and test coverage match the Rust
 * version line-for-line.
 */

export type ElementType =
	| "Scene"
	| "Action"
	| "Character"
	| "Parenthetical"
	| "Dialogue"
	| "Transition";

type ScreenplayElement = {
	elementType: ElementType;
	content: string;
};

// ═══════════════════════════════════════════════════════════════════════════
// Public API (wired into RPC in src/bun/index.ts)
// ═══════════════════════════════════════════════════════════════════════════

export function convertScreenplayToCsv({ content }: { content: string }): string {
	const elements = parseScreenplay(content);
	return elementsToCsv(elements);
}

export function convertCsvToScreenplay({
	csvContent,
}: {
	csvContent: string;
}): string {
	const elements = parseCsvToElements(csvContent);
	return elementsToScreenplay(elements);
}

// ═══════════════════════════════════════════════════════════════════════════
// Screenplay → elements
// ═══════════════════════════════════════════════════════════════════════════

function parseScreenplay(content: string): ScreenplayElement[] {
	const lines = content.split("\n");
	const elements: ScreenplayElement[] = [];
	let currentElement: ScreenplayElement | null = null;
	let prevType: ElementType | null = null;

	for (const line of lines) {
		if (line.trim() === "") {
			if (currentElement) {
				prevType = currentElement.elementType;
				elements.push(currentElement);
				currentElement = null;
			}
			continue;
		}

		const contextType = currentElement?.elementType ?? prevType;
		const lineType = classifyLine(line, contextType);

		if (currentElement) {
			if (currentElement.elementType === lineType && canContinue(lineType)) {
				// Same type — fold the new line onto the running element so
				// multi-line action/dialogue collapses into a single cell.
				currentElement.content += " " + line.trim();
			} else {
				prevType = currentElement.elementType;
				elements.push(currentElement);
				currentElement = { elementType: lineType, content: line.trim() };
			}
		} else {
			currentElement = { elementType: lineType, content: line.trim() };
		}
	}

	if (currentElement) elements.push(currentElement);
	return elements;
}

function canContinue(elementType: ElementType): boolean {
	return elementType === "Action" || elementType === "Dialogue";
}

function classifyLine(line: string, prevType: ElementType | null): ElementType {
	const trimmed = line.trim();
	const indent = countLeadingSpaces(line);

	if (isSceneHeading(trimmed)) return "Scene";
	if (indent > 50 || isTransition(trimmed)) return "Transition";
	if (trimmed.startsWith("(") && trimmed.endsWith(")")) return "Parenthetical";
	if (indent >= 5 && isAllCaps(trimmed) && prevType !== "Character") {
		return "Character";
	}
	if (
		indent >= 3 &&
		(prevType === "Character" ||
			prevType === "Parenthetical" ||
			prevType === "Dialogue")
	) {
		return "Dialogue";
	}
	return "Action";
}

function countLeadingSpaces(line: string): number {
	let n = 0;
	while (n < line.length && line[n] === " ") n++;
	return n;
}

function isSceneHeading(trimmed: string): boolean {
	if (!isAllCaps(trimmed)) return false;
	const prefixes = ["INT.", "EXT.", "INT/EXT", "I/E", "EST.", "INT ", "EXT "];
	return prefixes.some((p) => trimmed.startsWith(p));
}

function isTransition(trimmed: string): boolean {
	if (trimmed.endsWith("TO:") || trimmed.endsWith(":")) {
		return isAllCaps(trimmed);
	}
	const transitions = [
		"FADE OUT",
		"FADE IN",
		"CUT TO",
		"DISSOLVE TO",
		"SMASH CUT TO",
		"MATCH CUT TO",
	];
	return transitions.some((t) => trimmed.startsWith(t) && isAllCaps(trimmed));
}

function isAllCaps(text: string): boolean {
	// "All caps" ignores digits, punctuation, and whitespace — it's about the
	// *letters* only. Matches the Rust `c.is_alphabetic()` / `c.is_uppercase()`
	// approach.
	let sawLetter = false;
	for (const ch of text) {
		if (/\p{L}/u.test(ch)) {
			sawLetter = true;
			if (ch !== ch.toUpperCase() || ch === ch.toLowerCase()) {
				return false;
			}
		}
	}
	return sawLetter;
}

// ═══════════════════════════════════════════════════════════════════════════
// Elements → CSV
// ═══════════════════════════════════════════════════════════════════════════

type CsvRow = {
	transition: string;
	scene: string;
	action: string;
	character: string;
	parenthetical: string;
	dialogue: string;
};

function newRow(): CsvRow {
	return {
		transition: "",
		scene: "",
		action: "",
		character: "",
		parenthetical: "",
		dialogue: "",
	};
}

function rowIsEmpty(r: CsvRow): boolean {
	return (
		r.transition === "" &&
		r.scene === "" &&
		r.action === "" &&
		r.character === "" &&
		r.parenthetical === "" &&
		r.dialogue === ""
	);
}

function rowHasDialogueGroup(r: CsvRow): boolean {
	return r.character !== "" || r.parenthetical !== "" || r.dialogue !== "";
}

function rowHasSceneGroup(r: CsvRow): boolean {
	return r.transition !== "" || r.scene !== "";
}

function rowHasAction(r: CsvRow): boolean {
	return r.action !== "";
}

function csvEscape(s: string): string {
	if (s.includes(",") || s.includes('"') || s.includes("\n")) {
		return `"${s.replace(/"/g, '""')}"`;
	}
	return s;
}

function rowToCsvLine(r: CsvRow): string {
	return [r.transition, r.scene, r.action, r.character, r.parenthetical, r.dialogue]
		.map(csvEscape)
		.join(",");
}

function elementsToCsv(elements: ScreenplayElement[]): string {
	const rows: CsvRow[] = [];
	let current = newRow();

	for (const elem of elements) {
		switch (elem.elementType) {
			case "Transition": {
				if (rowHasAction(current) || rowHasDialogueGroup(current)) {
					if (!rowIsEmpty(current)) rows.push(current);
					current = newRow();
				}
				current.transition = elem.content;
				break;
			}
			case "Scene": {
				if (rowHasAction(current) || rowHasDialogueGroup(current)) {
					if (!rowIsEmpty(current)) rows.push(current);
					current = newRow();
				}
				current.scene = elem.content;
				break;
			}
			case "Action": {
				if (!rowIsEmpty(current)) rows.push(current);
				current = newRow();
				current.action = elem.content;
				rows.push(current);
				current = newRow();
				break;
			}
			case "Character": {
				if (!rowIsEmpty(current)) rows.push(current);
				current = newRow();
				current.character = elem.content;
				break;
			}
			case "Parenthetical": {
				if (rowHasSceneGroup(current) || rowHasAction(current)) {
					if (!rowIsEmpty(current)) rows.push(current);
					current = newRow();
				}
				current.parenthetical = elem.content;
				break;
			}
			case "Dialogue": {
				if (rowHasSceneGroup(current) || rowHasAction(current)) {
					if (!rowIsEmpty(current)) rows.push(current);
					current = newRow();
				}
				current.dialogue = elem.content;
				break;
			}
		}
	}

	if (!rowIsEmpty(current)) rows.push(current);

	let csv = "Transition,Scene,Action,Character,Parenthetical,Dialogue\n";
	for (const row of rows) {
		csv += rowToCsvLine(row) + "\n";
	}
	return csv;
}

// ═══════════════════════════════════════════════════════════════════════════
// CSV → elements
// ═══════════════════════════════════════════════════════════════════════════

function parseCsvToElements(csvContent: string): ScreenplayElement[] {
	const elements: ScreenplayElement[] = [];
	const lines = csvContent.split("\n");
	if (lines.length === 0) return elements;

	// Skip header row (index 0).
	for (let i = 1; i < lines.length; i++) {
		const line = lines[i];
		if (!line || line.trim() === "") continue;

		let fields: string[];
		try {
			fields = parseCsvLine(line);
		} catch (err: unknown) {
			throw new Error(
				`CSV parsing error at line ${i + 1}: ${(err as Error).message}`,
			);
		}

		if (fields.length !== 6) {
			throw new Error(
				`Invalid CSV format at line ${i + 1}: expected 6 columns, found ${fields.length}`,
			);
		}

		const [transition, scene, action, character, parenthetical, dialogue] =
			fields.map((f) => f.trim());

		if (transition) elements.push({ elementType: "Transition", content: transition });
		if (scene) elements.push({ elementType: "Scene", content: scene });
		if (action) elements.push({ elementType: "Action", content: action });
		if (character) elements.push({ elementType: "Character", content: character });
		if (parenthetical) {
			elements.push({ elementType: "Parenthetical", content: parenthetical });
		}
		if (dialogue) elements.push({ elementType: "Dialogue", content: dialogue });
	}

	return elements;
}

function parseCsvLine(line: string): string[] {
	const fields: string[] = [];
	let current = "";
	let inQuotes = false;
	let i = 0;

	while (i < line.length) {
		const ch = line[i];
		if (ch === '"') {
			if (inQuotes && line[i + 1] === '"') {
				current += '"';
				i += 2;
				continue;
			}
			inQuotes = !inQuotes;
			i++;
			continue;
		}
		if (ch === "," && !inQuotes) {
			fields.push(current);
			current = "";
			i++;
			continue;
		}
		current += ch;
		i++;
	}

	if (inQuotes) throw new Error("Unclosed quote in CSV line");

	fields.push(current);
	return fields;
}

// ═══════════════════════════════════════════════════════════════════════════
// Elements → screenplay
// ═══════════════════════════════════════════════════════════════════════════

function elementsToScreenplay(elements: ScreenplayElement[]): string {
	let out = "";

	for (const element of elements) {
		// Blank line before scene headings and character names for readability
		// (except at the very start).
		if (out !== "") {
			if (element.elementType === "Scene" || element.elementType === "Character") {
				out += "\n";
			}
		}

		switch (element.elementType) {
			case "Scene":
			case "Action":
				out += element.content + "\n";
				break;
			case "Character":
				out += " ".repeat(20) + element.content + "\n";
				break;
			case "Parenthetical": {
				let line = " ".repeat(15);
				line += element.content.startsWith("(") ? "" : "(";
				line += element.content;
				line += element.content.endsWith(")") ? "" : ")";
				out += line + "\n";
				break;
			}
			case "Dialogue":
				out += " ".repeat(10) + element.content + "\n";
				break;
			case "Transition":
				out += " ".repeat(44) + element.content + "\n";
				break;
		}
	}

	return out;
}

// ═══════════════════════════════════════════════════════════════════════════
// Exports kept visible for the test suite
// ═══════════════════════════════════════════════════════════════════════════

export const __internals = {
	isSceneHeading,
	isAllCaps,
	isTransition,
	parseScreenplay,
	elementsToCsv,
	parseCsvLine,
	parseCsvToElements,
	elementsToScreenplay,
};
