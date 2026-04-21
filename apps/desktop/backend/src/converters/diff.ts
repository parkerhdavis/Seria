/**
 * CSV diff. Direct port of backend/src/diff.rs.
 *
 * Row matching is LCS-based for small files and falls back to pure
 * hash-lookup matching for files over 5000 rows on either side (the LCS
 * table would be O(n·m) memory, which is no good at that scale). Column
 * diffing is set-based on header names. Modified cells are discovered on
 * the intersection of old/new headers within each matched row pair.
 */

import type { DiffResult, ModifiedCell } from "@shared/rpc";

export function compareCsvFiles({
	oldContent,
	newContent,
}: {
	oldContent: string;
	newContent: string;
}): DiffResult {
	const [oldHeaders, oldData] = parseCsvContent(oldContent);
	const [newHeaders, newData] = parseCsvContent(newContent);

	const addedCols = newHeaders.filter((h) => !oldHeaders.includes(h));
	const deletedCols = oldHeaders.filter((h) => !newHeaders.includes(h));

	const rowMatches = findRowMatches(oldData, newData);
	const matchedOld = new Set(rowMatches.map(([o]) => o));
	const matchedNew = new Set(rowMatches.map(([, n]) => n));

	const deletedRows: number[] = [];
	for (let i = 0; i < oldData.length; i++) {
		if (!matchedOld.has(i)) deletedRows.push(i);
	}
	const addedRows: number[] = [];
	for (let i = 0; i < newData.length; i++) {
		if (!matchedNew.has(i)) addedRows.push(i);
	}

	const modifiedCells: ModifiedCell[] = [];
	for (const [oldIdx, newIdx] of rowMatches) {
		const oldRow = oldData[oldIdx];
		const newRow = newData[newIdx];
		for (let newColIdx = 0; newColIdx < newHeaders.length; newColIdx++) {
			const header = newHeaders[newColIdx];
			const oldColIdx = oldHeaders.indexOf(header);
			if (oldColIdx === -1) continue;
			const oldVal = oldRow[oldColIdx] ?? "";
			const newVal = newRow[newColIdx] ?? "";
			if (oldVal !== newVal) {
				modifiedCells.push({
					row: newIdx,
					col: newColIdx,
					oldValue: oldVal,
					newValue: newVal,
				});
			}
		}
	}

	return {
		addedRows,
		deletedRows,
		modifiedCells,
		columnChanges: { added: addedCols, deleted: deletedCols },
		oldHeaders,
		newHeaders,
		oldData,
		newData,
		oldRowCount: oldData.length,
		newRowCount: newData.length,
	};
}

// ═══════════════════════════════════════════════════════════════════════════
// Parsing
// ═══════════════════════════════════════════════════════════════════════════

function parseCsvContent(content: string): [string[], string[][]] {
	const lines = content.split("\n");
	if (lines.length === 0) return [[], []];

	const headers = parseCsvLine(lines[0]);
	const data: string[][] = [];
	for (let i = 1; i < lines.length; i++) {
		const line = lines[i];
		if (!line || line.trim() === "") continue;
		data.push(parseCsvLine(line));
	}
	return [headers, data];
}

function parseCsvLine(line: string): string[] {
	const fields: string[] = [];
	let current = "";
	let inQuotes = false;
	let i = 0;

	while (i < line.length) {
		const c = line[i];
		if (inQuotes) {
			if (c === '"') {
				if (line[i + 1] === '"') {
					current += '"';
					i += 2;
					continue;
				}
				inQuotes = false;
				i++;
				continue;
			}
			current += c;
			i++;
			continue;
		}
		if (c === '"') {
			inQuotes = true;
			i++;
			continue;
		}
		if (c === ",") {
			fields.push(current);
			current = "";
			i++;
			continue;
		}
		current += c;
		i++;
	}
	fields.push(current);
	return fields;
}

// ═══════════════════════════════════════════════════════════════════════════
// Matching
// ═══════════════════════════════════════════════════════════════════════════

/** djb2-ish hash over a row's cells. Only needs to be stable within this
 *  invocation, not across runs — good enough for bucketing rows. */
function rowHash(row: string[]): string {
	let h = 0;
	for (const cell of row) {
		for (let i = 0; i < cell.length; i++) {
			h = (h * 31 + cell.charCodeAt(i)) | 0;
		}
		h = (h * 31) | 0; // separator so ["ab","c"] ≠ ["a","bc"]
	}
	return h.toString(16);
}

function rowsEqual(a: string[], b: string[]): boolean {
	if (a.length !== b.length) return false;
	for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
	return true;
}

function findRowMatches(
	oldData: string[][],
	newData: string[][],
): Array<[number, number]> {
	const oldLen = oldData.length;
	const newLen = newData.length;

	if (oldLen > 5000 || newLen > 5000) {
		return hashBasedMatching(oldData, newData);
	}

	// LCS table over row equality. dp[i][j] = length of LCS of old[..i], new[..j].
	const dp: Uint32Array[] = Array.from(
		{ length: oldLen + 1 },
		() => new Uint32Array(newLen + 1),
	);

	const oldHashes = oldData.map(rowHash);
	const newHashes = newData.map(rowHash);

	for (let i = 1; i <= oldLen; i++) {
		for (let j = 1; j <= newLen; j++) {
			if (
				oldHashes[i - 1] === newHashes[j - 1] &&
				rowsEqual(oldData[i - 1], newData[j - 1])
			) {
				dp[i][j] = dp[i - 1][j - 1] + 1;
			} else {
				dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
			}
		}
	}

	const matches: Array<[number, number]> = [];
	let i = oldLen;
	let j = newLen;
	while (i > 0 && j > 0) {
		if (
			oldHashes[i - 1] === newHashes[j - 1] &&
			rowsEqual(oldData[i - 1], newData[j - 1])
		) {
			matches.push([i - 1, j - 1]);
			i--;
			j--;
		} else if (dp[i - 1][j] > dp[i][j - 1]) {
			i--;
		} else {
			j--;
		}
	}
	matches.reverse();

	// Second pass: match remaining rows by first-column value (ID column).
	// Catches rows that are *modified* (shared ID, other cells changed) so
	// the modifiedCells loop above can surface the diff instead of flagging
	// them as delete+add.
	const matchedOld = new Set(matches.map(([o]) => o));
	const usedNew = new Set(matches.map(([, n]) => n));
	const idMatches: Array<[number, number]> = [];

	for (let oldIdx = 0; oldIdx < oldData.length; oldIdx++) {
		if (matchedOld.has(oldIdx)) continue;
		const oldRow = oldData[oldIdx];
		const oldId = oldRow[0] ?? "";
		if (oldId === "") continue;

		for (let newIdx = 0; newIdx < newData.length; newIdx++) {
			if (usedNew.has(newIdx)) continue;
			const newId = newData[newIdx][0] ?? "";
			if (oldId === newId) {
				idMatches.push([oldIdx, newIdx]);
				usedNew.add(newIdx);
				break;
			}
		}
	}

	matches.push(...idMatches);
	matches.sort(([a], [b]) => a - b);
	return matches;
}

function hashBasedMatching(
	oldData: string[][],
	newData: string[][],
): Array<[number, number]> {
	const oldMap = new Map<string, number[]>();
	for (let i = 0; i < oldData.length; i++) {
		const h = rowHash(oldData[i]);
		const bucket = oldMap.get(h);
		if (bucket) bucket.push(i);
		else oldMap.set(h, [i]);
	}

	const matches: Array<[number, number]> = [];
	const usedOld = new Set<number>();

	for (let j = 0; j < newData.length; j++) {
		const newRow = newData[j];
		const bucket = oldMap.get(rowHash(newRow));
		if (!bucket) continue;
		for (const oldIdx of bucket) {
			if (!usedOld.has(oldIdx) && rowsEqual(oldData[oldIdx], newRow)) {
				matches.push([oldIdx, j]);
				usedOld.add(oldIdx);
				break;
			}
		}
	}

	matches.sort(([a], [b]) => a - b);
	return matches;
}
