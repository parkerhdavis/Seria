/**
 * Tests for summaryCalculations utility
 *
 * Covers all 7 summary types: count, unique, mode, average, min, max, sum.
 * Tests edge cases: empty data, non-numeric data, mixed data, single values.
 */

import { describe, it, expect } from "vitest";
import { calculateSummary, SummaryType } from "@utils/summaryCalculations";

describe("calculateSummary", () => {
    // ===== EMPTY DATA =====
    describe("empty data", () => {
        const summaryTypes: SummaryType[] = ["count", "unique", "mode", "average", "min", "max", "sum"];

        it.each(summaryTypes)('returns "-" for %s with empty array', (type) => {
            expect(calculateSummary([], type)).toBe("-");
        });

        it.each(summaryTypes)('returns "-" for %s with all-empty strings', (type) => {
            expect(calculateSummary(["", "  ", "   "], type)).toBe("-");
        });
    });

    // ===== COUNT =====
    describe("count", () => {
        it("counts non-empty values", () => {
            expect(calculateSummary(["a", "b", "c"], "count")).toBe("3");
        });

        it("excludes empty and whitespace-only values", () => {
            expect(calculateSummary(["a", "", "b", "  ", "c"], "count")).toBe("3");
        });

        it("counts single value", () => {
            expect(calculateSummary(["hello"], "count")).toBe("1");
        });
    });

    // ===== UNIQUE =====
    describe("unique", () => {
        it("counts unique values", () => {
            expect(calculateSummary(["a", "b", "c"], "unique")).toBe("3");
        });

        it("handles duplicates", () => {
            expect(calculateSummary(["a", "b", "a", "c", "b"], "unique")).toBe("3");
        });

        it("handles all identical values", () => {
            expect(calculateSummary(["x", "x", "x"], "unique")).toBe("1");
        });

        it("excludes empty values from count", () => {
            expect(calculateSummary(["a", "", "a", "  "], "unique")).toBe("1");
        });
    });

    // ===== MODE =====
    describe("mode", () => {
        it("finds most common text value", () => {
            expect(calculateSummary(["apple", "banana", "apple", "cherry"], "mode")).toBe("apple");
        });

        it("finds most common numeric value", () => {
            expect(calculateSummary(["1", "2", "1", "3", "1"], "mode")).toBe("1");
        });

        it("returns first value when all have same frequency (text)", () => {
            const result = calculateSummary(["a", "b", "c"], "mode");
            // Any of these is acceptable since they all have frequency 1
            expect(["a", "b", "c"]).toContain(result);
        });

        it("handles single value", () => {
            expect(calculateSummary(["only"], "mode")).toBe("only");
        });

        it("distinguishes numeric vs text mode based on column content", () => {
            // Mostly numeric -> numeric mode
            expect(calculateSummary(["5", "5", "5", "text"], "mode")).toBe("5");
            // Mostly text -> text mode
            expect(calculateSummary(["a", "a", "b", "5"], "mode")).toBe("a");
        });
    });

    // ===== AVERAGE =====
    describe("average", () => {
        it("calculates average of numeric values", () => {
            expect(calculateSummary(["10", "20", "30"], "average")).toBe("20.00");
        });

        it("ignores non-numeric values", () => {
            expect(calculateSummary(["10", "text", "30"], "average")).toBe("20.00");
        });

        it("returns dash when no numeric values exist", () => {
            expect(calculateSummary(["a", "b", "c"], "average")).toBe("-");
        });

        it("handles decimal values", () => {
            expect(calculateSummary(["1.5", "2.5"], "average")).toBe("2.00");
        });

        it("handles single numeric value", () => {
            expect(calculateSummary(["42"], "average")).toBe("42.00");
        });

        it("handles negative numbers", () => {
            expect(calculateSummary(["-10", "10"], "average")).toBe("0.00");
        });
    });

    // ===== MIN =====
    describe("min", () => {
        it("finds numeric minimum", () => {
            expect(calculateSummary(["10", "5", "20"], "min")).toBe("5");
        });

        it("handles negative numbers", () => {
            expect(calculateSummary(["-5", "0", "5"], "min")).toBe("-5");
        });

        it("falls back to alphabetical min for text-only data", () => {
            expect(calculateSummary(["cherry", "apple", "banana"], "min")).toBe("apple");
        });

        it("handles single value", () => {
            expect(calculateSummary(["42"], "min")).toBe("42");
        });

        it("prefers numeric comparison when numbers exist", () => {
            expect(calculateSummary(["2", "10", "abc"], "min")).toBe("2");
        });
    });

    // ===== MAX =====
    describe("max", () => {
        it("finds numeric maximum", () => {
            expect(calculateSummary(["10", "5", "20"], "max")).toBe("20");
        });

        it("handles negative numbers", () => {
            expect(calculateSummary(["-5", "0", "5"], "max")).toBe("5");
        });

        it("falls back to alphabetical max for text-only data", () => {
            expect(calculateSummary(["cherry", "apple", "banana"], "max")).toBe("cherry");
        });

        it("handles single value", () => {
            expect(calculateSummary(["42"], "max")).toBe("42");
        });
    });

    // ===== SUM =====
    describe("sum", () => {
        it("sums numeric values", () => {
            expect(calculateSummary(["10", "20", "30"], "sum")).toBe("60.00");
        });

        it("ignores non-numeric values", () => {
            expect(calculateSummary(["10", "text", "30"], "sum")).toBe("40.00");
        });

        it("returns dash when no numeric values exist", () => {
            expect(calculateSummary(["a", "b", "c"], "sum")).toBe("-");
        });

        it("handles decimal values", () => {
            expect(calculateSummary(["1.5", "2.5", "3.0"], "sum")).toBe("7.00");
        });

        it("handles negative numbers", () => {
            expect(calculateSummary(["-10", "10", "5"], "sum")).toBe("5.00");
        });

        it("handles single numeric value", () => {
            expect(calculateSummary(["42"], "sum")).toBe("42.00");
        });
    });
});
