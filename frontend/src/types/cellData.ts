/**
 * Cell Data Types
 *
 * Type definitions for Cell Data structures, filtering, and sorting.
 */

/**
 * Cell Data structure
 * - headers: Column names from the first row
 * - data: 2D array of cell values
 */
export interface CellData {
    headers: string[];
    data: string[][];
}

/**
 * Filter operators for different data types
 */
export type FilterOperator =
    | "equals"
    | "not_equals"
    | "contains"
    | "not_contains"
    | "starts_with"
    | "ends_with"
    | "greater_than"
    | "less_than"
    | "greater_or_equal"
    | "less_or_equal"
    | "is_empty"
    | "is_not_empty";

/**
 * Filter definition for a single column
 */
export interface Filter {
    id: string;
    column: string;
    operator: FilterOperator;
    value: string;
    enabled: boolean;
}

/**
 * Sort order for a column
 */
export type SortDirection = "asc" | "desc";

/**
 * Sort order definition
 */
export interface SortOrder {
    column: string;
    direction: SortDirection;
}

/**
 * Cell file metadata
 */
export interface CellFileInfo {
    path: string;
    name: string;
    size: number;
    lastModified: Date;
    rowCount: number;
    columnCount: number;
}

/**
 * Cell selection state
 */
export interface CellSelection {
    row: number;
    column: number;
}

/**
 * Range selection (for multi-cell operations)
 */
export interface RangeSelection {
    startRow: number;
    endRow: number;
    startColumn: number;
    endColumn: number;
}
