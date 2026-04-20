/**
 * Tests for cellParser utility
 *
 * Tests the pure functions: parseCells, serializeCell, validateCell,
 * getDelimiterFromPath, getCellStats.
 *
 * Note: parseCellsProgressive and cancelProgressiveParsing require a
 * Web Worker environment and are not tested here.
 */

import { describe, it, expect } from "bun:test";
import {
    parseCells,
    serializeCell,
    validateCell,
    getDelimiterFromPath,
    getCellStats,
} from "@utils/cellParser";

describe("parseCells", () => {
    it("parses comma-separated CSV", () => {
        const csv = "Name,Age,City\nAlice,30,NYC\nBob,25,LA";
        const result = parseCells(csv);

        expect(result.headers).toEqual(["Name", "Age", "City"]);
        expect(result.data).toEqual([
            ["Alice", "30", "NYC"],
            ["Bob", "25", "LA"],
        ]);
        expect(result.delimiter).toBe(",");
    });

    it("parses tab-separated TSV", () => {
        const tsv = "Name\tAge\nAlice\t30";
        const result = parseCells(tsv);

        expect(result.headers).toEqual(["Name", "Age"]);
        expect(result.data).toEqual([["Alice", "30"]]);
        expect(result.delimiter).toBe("\t");
    });

    it("handles quoted fields with commas", () => {
        const csv = 'Name,Description\nAlice,"Hello, World"\nBob,"A, B, C"';
        const result = parseCells(csv);

        expect(result.headers).toEqual(["Name", "Description"]);
        expect(result.data[0]).toEqual(["Alice", "Hello, World"]);
        expect(result.data[1]).toEqual(["Bob", "A, B, C"]);
    });

    it("handles quoted fields with newlines", () => {
        const csv = 'Name,Bio\nAlice,"Line1\nLine2"';
        const result = parseCells(csv);

        expect(result.headers).toEqual(["Name", "Bio"]);
        expect(result.data[0][1]).toBe("Line1\nLine2");
    });

    it("handles empty input", () => {
        const result = parseCells("");

        expect(result.headers).toEqual([]);
        expect(result.data).toEqual([]);
    });

    it("handles header-only input", () => {
        const csv = "Name,Age,City";
        const result = parseCells(csv);

        expect(result.headers).toEqual(["Name", "Age", "City"]);
        expect(result.data).toEqual([]);
    });

    it("handles single column", () => {
        const csv = "Name\nAlice\nBob";
        const result = parseCells(csv);

        expect(result.headers).toEqual(["Name"]);
        expect(result.data).toEqual([["Alice"], ["Bob"]]);
    });

    it("handles fields with escaped quotes", () => {
        const csv = 'Name,Quote\nAlice,"She said ""hello"""';
        const result = parseCells(csv);

        expect(result.data[0][1]).toBe('She said "hello"');
    });
});

describe("serializeCell", () => {
    it("serializes to CSV", () => {
        const cellData = {
            headers: ["Name", "Age"],
            data: [["Alice", "30"], ["Bob", "25"]],
        };
        const result = serializeCell(cellData, ",");

        // PapaParse quotes all fields
        expect(result).toContain('"Name","Age"');
        expect(result).toContain('"Alice","30"');
        expect(result).toContain('"Bob","25"');
    });

    it("serializes to TSV", () => {
        const cellData = {
            headers: ["Name", "Age"],
            data: [["Alice", "30"]],
        };
        const result = serializeCell(cellData, "\t");

        expect(result).toContain('"Name"\t"Age"');
        expect(result).toContain('"Alice"\t"30"');
    });

    it("defaults to comma delimiter", () => {
        const cellData = {
            headers: ["Col1", "Col2"],
            data: [["A", "B"]],
        };
        const result = serializeCell(cellData);

        expect(result).toContain(",");
        expect(result).toBe('"Col1","Col2"\n"A","B"');
    });

    it("handles empty data", () => {
        const cellData = {
            headers: ["Name"],
            data: [],
        };
        const result = serializeCell(cellData);

        expect(result).toBe('"Name"');
    });

    it("preserves fields with special characters", () => {
        const cellData = {
            headers: ["Name"],
            data: [["Hello, World"], ['He said "hi"']],
        };
        const result = serializeCell(cellData, ",");

        // Should properly escape quotes and commas
        expect(result).toContain('"Hello, World"');
        expect(result).toContain('"He said ""hi"""');
    });
});

describe("validateCell", () => {
    it("validates valid data", () => {
        const result = validateCell({
            headers: ["Name", "Age"],
            data: [["Alice", "30"], ["Bob", "25"]],
        });

        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
    });

    it("rejects empty headers", () => {
        const result = validateCell({
            headers: [],
            data: [],
        });

        expect(result.valid).toBe(false);
        expect(result.errors).toContain("Cell must have at least one column");
    });

    it("rejects duplicate headers", () => {
        const result = validateCell({
            headers: ["Name", "Name"],
            data: [["Alice", "Bob"]],
        });

        expect(result.valid).toBe(false);
        expect(result.errors).toContain("Cell headers must be unique");
    });

    it("rejects rows with wrong column count", () => {
        const result = validateCell({
            headers: ["Name", "Age"],
            data: [["Alice", "30"], ["Bob"]],  // Second row missing a column
        });

        expect(result.valid).toBe(false);
        expect(result.errors[0]).toContain("Row 2 has 1 columns, expected 2");
    });

    it("validates data with no rows (headers only)", () => {
        const result = validateCell({
            headers: ["Name"],
            data: [],
        });

        expect(result.valid).toBe(true);
    });

    it("reports multiple errors", () => {
        const result = validateCell({
            headers: ["Name", "Name"],
            data: [["Alice"]],  // Both duplicate headers AND wrong column count
        });

        expect(result.valid).toBe(false);
        expect(result.errors.length).toBe(2);
    });
});

describe("getDelimiterFromPath", () => {
    it("returns tab for .tsv files", () => {
        expect(getDelimiterFromPath("data.tsv")).toBe("\t");
    });

    it("returns comma for .csv files", () => {
        expect(getDelimiterFromPath("data.csv")).toBe(",");
    });

    it("returns comma for .cell files", () => {
        expect(getDelimiterFromPath("data.cell")).toBe(",");
    });

    it("returns comma for unknown extensions", () => {
        expect(getDelimiterFromPath("data.txt")).toBe(",");
    });

    it("handles paths with directories", () => {
        expect(getDelimiterFromPath("/path/to/file.tsv")).toBe("\t");
    });

    it("handles paths with multiple dots", () => {
        expect(getDelimiterFromPath("my.data.file.csv")).toBe(",");
    });

    it("is case-insensitive for extensions", () => {
        expect(getDelimiterFromPath("DATA.TSV")).toBe("\t");
        expect(getDelimiterFromPath("DATA.CSV")).toBe(",");
    });
});

describe("getCellStats", () => {
    it("returns correct stats for normal data", () => {
        const stats = getCellStats({
            headers: ["Name", "Age", "City"],
            data: [
                ["Alice", "30", "NYC"],
                ["Bob", "25", "LA"],
            ],
        });

        expect(stats.rowCount).toBe(2);
        expect(stats.columnCount).toBe(3);
        expect(stats.totalCells).toBe(6);
        expect(stats.emptyCells).toBe(0);
    });

    it("counts empty cells", () => {
        const stats = getCellStats({
            headers: ["Name", "Age"],
            data: [
                ["Alice", ""],
                ["", "25"],
            ],
        });

        expect(stats.emptyCells).toBe(2);
    });

    it("counts whitespace-only cells as empty", () => {
        const stats = getCellStats({
            headers: ["Name"],
            data: [["  "], ["   "]],
        });

        expect(stats.emptyCells).toBe(2);
    });

    it("handles empty data", () => {
        const stats = getCellStats({
            headers: ["Name"],
            data: [],
        });

        expect(stats.rowCount).toBe(0);
        expect(stats.totalCells).toBe(0);
        expect(stats.emptyCells).toBe(0);
    });
});
