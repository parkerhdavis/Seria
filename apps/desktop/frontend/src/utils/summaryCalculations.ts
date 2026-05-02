// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Summary Calculations Utility
 *
 * Functions for calculating column summaries (Count, Unique, Mode, Average, Min, Max, Sum)
 */

export type SummaryType = "count" | "unique" | "mode" | "average" | "min" | "max" | "sum";

/**
 * Calculate summary value for a column
 */
export function calculateSummary(data: string[], summaryType: SummaryType): string {
    // Filter out empty values
    const nonEmptyData = data.filter((value) => value !== null && value !== undefined && value.trim() !== "");

    if (nonEmptyData.length === 0) {
        return "-";
    }

    switch (summaryType) {
        case "count":
            return calculateCount(nonEmptyData);
        case "unique":
            return calculateUnique(nonEmptyData);
        case "mode":
            return calculateMode(nonEmptyData);
        case "average":
            return calculateAverage(nonEmptyData);
        case "min":
            return calculateMin(nonEmptyData);
        case "max":
            return calculateMax(nonEmptyData);
        case "sum":
            return calculateSum(nonEmptyData);
        default:
            return "-";
    }
}

/**
 * Count of non-empty values
 */
function calculateCount(data: string[]): string {
    return data.length.toString();
}

/**
 * Count of unique values
 */
function calculateUnique(data: string[]): string {
    const uniqueValues = new Set(data);
    return uniqueValues.size.toString();
}

/**
 * Most common value (smart: numeric mode for number columns, text mode for text columns)
 */
function calculateMode(data: string[]): string {
    // Check if data is mostly numeric
    const numericValues = data.filter((value) => !isNaN(Number(value)));
    const isNumericColumn = numericValues.length / data.length > 0.5;

    if (isNumericColumn) {
        // Numeric mode
        const numbers = data.map(Number).filter((n) => !isNaN(n));
        const frequency: Record<number, number> = {};
        numbers.forEach((num) => {
            frequency[num] = (frequency[num] || 0) + 1;
        });

        let maxCount = 0;
        let mode = numbers[0];
        for (const [num, count] of Object.entries(frequency)) {
            if (count > maxCount) {
                maxCount = count;
                mode = Number(num);
            }
        }

        return mode?.toString() || "-";
    } else {
        // Text mode
        const frequency: Record<string, number> = {};
        data.forEach((value) => {
            frequency[value] = (frequency[value] || 0) + 1;
        });

        let maxCount = 0;
        let mode = data[0];
        for (const [value, count] of Object.entries(frequency)) {
            if (count > maxCount) {
                maxCount = count;
                mode = value;
            }
        }

        return mode || "-";
    }
}

/**
 * Average of numeric values (ignores text and empty cells)
 */
function calculateAverage(data: string[]): string {
    const numbers = data.map(Number).filter((n) => !isNaN(n));

    if (numbers.length === 0) {
        return "-";
    }

    const sum = numbers.reduce((acc, num) => acc + num, 0);
    const avg = sum / numbers.length;

    return avg.toFixed(2);
}

/**
 * Minimum value (numeric if numbers exist, otherwise alphabetical)
 */
function calculateMin(data: string[]): string {
    const numbers = data.map(Number).filter((n) => !isNaN(n));

    if (numbers.length > 0) {
        // Numeric min
        return Math.min(...numbers).toString();
    } else {
        // Alphabetical min
        return data.sort()[0] || "-";
    }
}

/**
 * Maximum value (numeric if numbers exist, otherwise alphabetical)
 */
function calculateMax(data: string[]): string {
    const numbers = data.map(Number).filter((n) => !isNaN(n));

    if (numbers.length > 0) {
        // Numeric max
        return Math.max(...numbers).toString();
    } else {
        // Alphabetical max
        return data.sort().reverse()[0] || "-";
    }
}

/**
 * Sum of numeric values (ignores text and empty cells)
 */
function calculateSum(data: string[]): string {
    const numbers = data.map(Number).filter((n) => !isNaN(n));

    if (numbers.length === 0) {
        return "-";
    }

    const sum = numbers.reduce((acc, num) => acc + num, 0);

    return sum.toFixed(2);
}
