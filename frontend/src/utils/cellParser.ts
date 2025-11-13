/**
 * Cells Parser Utility
 *
 * Wrapper around PapaParse for parsing and serializing Cell Data.
 */

import Papa from "papaparse";
import { CellData } from "@/types/cellData";

/**
 * Parsed Cell data with metadata
 */
export interface ParsedCellData extends CellData {
    delimiter: string;  // The delimiter that was detected during parsing
}

/**
 * Parse Cells string into structured data
 *
 * @param cellContent - Raw Cell file content as string
 * @returns Parsed Cell data with headers, rows, and detected delimiter
 */
export function parseCells(cellContent: string): ParsedCellData {
    const result = Papa.parse<string[]>(cellContent, {
        header: false,
        skipEmptyLines: true,
        delimitersToGuess: [",", "\t", "|", ";"],
    });

    if (result.errors.length > 0) {
        console.warn("Cell parsing errors:", result.errors);
    }

    const data = result.data;
    // PapaParse provides the detected delimiter in result.meta.delimiter
    const delimiter = result.meta.delimiter || ",";

    if (data.length === 0) {
        return {
            headers: [],
            data: [],
            delimiter,
        };
    }

    // First row is headers
    const headers = data[0];
    const rows = data.slice(1);

    return {
        headers,
        data: rows,
        delimiter,
    };
}

/**
 * Serialize Cell Data back to string
 *
 * @param cellData - Structured Cell Data
 * @param delimiter - Delimiter to use (default: ",")
 * @returns Cell string
 */
export function serializeCell(cellData: CellData, delimiter: string = ","): string {
    const allRows = [cellData.headers, ...cellData.data];

    const cell = Papa.unparse(allRows, {
        quotes: true,  // Quote all fields
        quoteChar: '"',
        escapeChar: '"',
        delimiter,
        newline: "\n",
    });

    return cell;
}

/**
 * Validate Cell Data structure
 *
 * @param cellData - Cell Data to validate
 * @returns Validation result with errors
 */
export function validateCell(cellData: CellData): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check if headers exist
    if (cellData.headers.length === 0) {
        errors.push("Cell must have at least one column");
    }

    // Check for duplicate headers
    const headerSet = new Set(cellData.headers);
    if (headerSet.size !== cellData.headers.length) {
        errors.push("Cell headers must be unique");
    }

    // Check that all rows have the same number of columns
    const expectedColumnCount = cellData.headers.length;
    cellData.data.forEach((row, index) => {
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
 * Get delimiter from file extension
 *
 * @param filePath - Path to the file
 * @returns Appropriate delimiter for the file type
 */
export function getDelimiterFromPath(filePath: string): string {
    const extension = filePath.split(".").pop()?.toLowerCase();

    switch (extension) {
        case "tsv":
            return "\t";
        case "csv":
            return ",";
        case "cell":
        default:
            return ",";  // Default to comma
    }
}

/**
 * Get Cell file statistics
 *
 * @param cellData - Cell Data
 * @returns Statistics about the Cell
 */
export function getCellStats(cellData: CellData) {
    return {
        rowCount: cellData.data.length,
        columnCount: cellData.headers.length,
        totalCells: cellData.data.length * cellData.headers.length,
        emptyCells: cellData.data.reduce(
            (count, row) => count + row.filter((cell) => cell.trim() === "").length,
            0
        ),
    };
}
