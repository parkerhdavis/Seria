/**
 * CSV diff tests. Ported from the `#[cfg(test)] mod tests` block at the
 * bottom of backend/src/diff.rs. One additional test covers the
 * hash-based fast path for >5k rows.
 */

import { describe, expect, test } from "bun:test";
import { compareCsvFiles } from "./diff";

describe("compareCsvFiles", () => {
	test("identical files produce no changes", () => {
		const content = "id,name\n1,Alice\n2,Bob";
		const result = compareCsvFiles({ oldContent: content, newContent: content });
		expect(result.addedRows).toEqual([]);
		expect(result.deletedRows).toEqual([]);
		expect(result.modifiedCells).toEqual([]);
	});

	test("appended row shows up as an added row", () => {
		const oldContent = "id,name\n1,Alice\n2,Bob";
		const newContent = "id,name\n1,Alice\n2,Bob\n3,Charlie";
		const result = compareCsvFiles({ oldContent, newContent });
		expect(result.addedRows).toEqual([2]);
		expect(result.deletedRows).toEqual([]);
		expect(result.modifiedCells).toEqual([]);
	});

	test("removed row shows up as a deleted row", () => {
		const oldContent = "id,name\n1,Alice\n2,Bob\n3,Charlie";
		const newContent = "id,name\n1,Alice\n3,Charlie";
		const result = compareCsvFiles({ oldContent, newContent });
		expect(result.addedRows).toEqual([]);
		expect(result.deletedRows).toEqual([1]);
		expect(result.modifiedCells).toEqual([]);
	});

	test("single cell change reports one modified cell with old/new values", () => {
		const oldContent = "id,name\n1,Alice\n2,Bob";
		const newContent = "id,name\n1,Alice\n2,Robert";
		const result = compareCsvFiles({ oldContent, newContent });
		expect(result.addedRows).toEqual([]);
		expect(result.deletedRows).toEqual([]);
		expect(result.modifiedCells).toHaveLength(1);
		expect(result.modifiedCells[0].oldValue).toBe("Bob");
		expect(result.modifiedCells[0].newValue).toBe("Robert");
	});

	test("header changes surface in columnChanges", () => {
		const oldContent = "id,name,age\n1,Alice,30";
		const newContent = "id,name,email\n1,Alice,alice@example.com";
		const result = compareCsvFiles({ oldContent, newContent });
		expect(result.columnChanges.added).toEqual(["email"]);
		expect(result.columnChanges.deleted).toEqual(["age"]);
	});

	test("hash-based fast path is correct for > 5k rows", () => {
		const header = "id,v\n";
		const oldRows = Array.from({ length: 6000 }, (_, i) => `${i},${i * 2}`).join("\n");
		// Change the value of row 3000 and append a new row at the end.
		const newRowsArr = Array.from({ length: 6000 }, (_, i) => `${i},${i * 2}`);
		newRowsArr[3000] = `3000,${3000 * 2 + 1}`;
		newRowsArr.push("6000,999");
		const newRows = newRowsArr.join("\n");

		const result = compareCsvFiles({
			oldContent: header + oldRows,
			newContent: header + newRows,
		});

		// The hash path doesn't include the ID-column second pass, so the
		// changed-row shows up as delete+add rather than modified. Appended
		// row is still just an add.
		expect(result.addedRows).toContain(6000);
		expect(result.deletedRows).toContain(3000);
		expect(result.oldRowCount).toBe(6000);
		expect(result.newRowCount).toBe(6001);
	});
});
