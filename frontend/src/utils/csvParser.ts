/**
 * CSV Parser Utility
 *
 * Wrapper around PapaParse for parsing and serializing CSV data.
 */

import Papa from "papaparse";
import { CSVData } from "@/types/csv";

/**
 * Parse CSV string into structured data
 *
 * @param csvContent - Raw CSV file content as string
 * @returns Parsed CSV data with headers and rows
 */
export function parseCSV(csvContent: string): CSVData {
    const result = Papa.parse<string[]>(csvContent, {
        header: false,
        skipEmptyLines: true,
        delimitersToGuess: [",", "\t", "|", ";"],
    });

    if (result.errors.length > 0) {
        console.warn("CSV parsing errors:", result.errors);
    }

    const data = result.data;

    if (data.length === 0) {
        return {
            headers: [],
            data: [],
        };
    }

    // First row is headers
    const headers = data[0];
    const rows = data.slice(1);

    return {
        headers,
        data: rows,
    };
}

/**
 * Serialize CSV data back to string
 *
 * @param csvData - Structured CSV data
 * @returns CSV string
 */
export function serializeCSV(csvData: CSVData): string {
    const allRows = [csvData.headers, ...csvData.data];

    const csv = Papa.unparse(allRows, {
        quotes: true,  // Quote all fields
        quoteChar: '"',
        escapeChar: '"',
        delimiter: ",",
        newline: "\n",
    });

    return csv;
}

/**
 * Validate CSV data structure
 *
 * @param csvData - CSV data to validate
 * @returns Validation result with errors
 */
export function validateCSV(csvData: CSVData): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check if headers exist
    if (csvData.headers.length === 0) {
        errors.push("CSV must have at least one column");
    }

    // Check for duplicate headers
    const headerSet = new Set(csvData.headers);
    if (headerSet.size !== csvData.headers.length) {
        errors.push("CSV headers must be unique");
    }

    // Check that all rows have the same number of columns
    const expectedColumnCount = csvData.headers.length;
    csvData.data.forEach((row, index) => {
        if (row.length !== expectedColumnCount) {
            errors.push(
                `Row ${index + 1} has ${row.length} columns, expected ${expectedColumnCount}`
            );
        }
    });

    return {
        valid: errors.length === 0,
        errors,
    };
}

/**
 * Get CSV file statistics
 *
 * @param csvData - CSV data
 * @returns Statistics about the CSV
 */
export function getCSVStats(csvData: CSVData) {
    return {
        rowCount: csvData.data.length,
        columnCount: csvData.headers.length,
        totalCells: csvData.data.length * csvData.headers.length,
        emptyCells: csvData.data.reduce(
            (count, row) => count + row.filter((cell) => cell.trim() === "").length,
            0
        ),
    };
}
