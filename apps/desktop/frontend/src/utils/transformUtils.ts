// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Data Transformation Utilities
 *
 * Common transformation functions used across print workers and components.
 * Consolidates duplicated logic for data access and transformation.
 */

/**
 * Cell reference for editing state.
 */
export interface EditingCell {
    row: number;
    col: number;
}

/**
 * Creates a cell value getter that respects editing state.
 * When a cell is being edited, returns the editing value instead of stored data.
 *
 * @param data - The 2D array of cell data
 * @param editingCell - The currently editing cell (or null if none)
 * @param editingValue - The current editing value
 * @returns A function that gets cell values with editing support
 */
export function createCellValueGetter(
    data: string[][],
    editingCell: EditingCell | null,
    editingValue: string
): (rowIndex: number, colIndex: number) => string {
    return (rowIndex: number, colIndex: number): string => {
        if (editingCell && editingCell.row === rowIndex && editingCell.col === colIndex) {
            return editingValue;
        }
        return data[rowIndex]?.[colIndex] || "";
    };
}

/**
 * Gets the column index for a column name.
 *
 * @param headers - Array of column headers
 * @param columnName - Name of the column to find
 * @returns The column index, or -1 if not found
 */
export function getColumnIndex(headers: string[], columnName: string | null | undefined): number {
    if (!columnName) return -1;
    return headers.indexOf(columnName);
}

/**
 * Gets multiple column indices for column names.
 *
 * @param headers - Array of column headers
 * @param columnNames - Names of columns to find
 * @returns Array of column indices (excludes not-found columns)
 */
export function getColumnIndices(headers: string[], columnNames: string[]): number[] {
    return columnNames
        .map((col) => headers.indexOf(col))
        .filter((idx) => idx >= 0);
}

/**
 * Extracts values from a row for multiple columns.
 *
 * @param getCellValue - Cell value getter function
 * @param rowIndex - Row index to extract from
 * @param columnIndices - Array of column indices to extract
 * @param filterEmpty - Whether to filter out empty values (default: false)
 * @returns Array of cell values
 */
export function extractRowValues(
    getCellValue: (row: number, col: number) => string,
    rowIndex: number,
    columnIndices: number[],
    filterEmpty: boolean = false
): string[] {
    const values = columnIndices.map((idx) => getCellValue(rowIndex, idx));
    return filterEmpty ? values.filter((v) => v && v.trim()) : values;
}

/**
 * Counts lines in text content, accounting for line wrapping.
 *
 * @param text - The text content
 * @param charsPerLine - Approximate characters per line for wrapping calculation
 * @returns Estimated number of lines
 */
export function estimateLineCount(text: string, charsPerLine: number): number {
    if (!text || charsPerLine <= 0) return 1;

    // Split by explicit newlines first
    const lines = text.split("\n");
    let totalLines = 0;

    for (const line of lines) {
        // Account for word wrapping
        if (line.length === 0) {
            totalLines += 1;
        } else {
            totalLines += Math.ceil(line.length / charsPerLine);
        }
    }

    return Math.max(1, totalLines);
}

/**
 * Converts font size in points to inches.
 *
 * @param fontSizePoints - Font size in points
 * @returns Font size in inches
 */
export function pointsToInches(fontSizePoints: number): number {
    return fontSizePoints / 72;
}

/**
 * Estimates characters per line based on width and font size.
 *
 * @param widthInches - Available width in inches
 * @param fontSizePoints - Font size in points
 * @param charWidthFactor - Character width factor (default: 0.6 for monospace)
 * @returns Estimated characters per line
 */
export function estimateCharsPerLine(
    widthInches: number,
    fontSizePoints: number,
    charWidthFactor: number = 0.6
): number {
    const fontSizeInches = pointsToInches(fontSizePoints);
    const charWidthInches = fontSizeInches * charWidthFactor;
    return Math.floor(widthInches / charWidthInches);
}
