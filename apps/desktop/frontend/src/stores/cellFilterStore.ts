// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Cell Filter Store
 *
 * Manages column filtering and summary state.
 * Extracted from cellStore to improve separation of concerns.
 */

import { create } from "zustand";

/**
 * Column filter definition
 */
export interface ColumnFilter {
    column: string;
    operation: "contains" | "not-contains" | "equals" | "not-equals";
    value: string;
}

/**
 * Available summary calculation types
 */
export type SummaryType = "count" | "unique" | "mode" | "average" | "min" | "max" | "sum";

/**
 * Filter store state and actions
 */
interface CellFilterStore {
    // State
    columnFilters: ColumnFilter[];
    columnSummaries: Record<string, SummaryType>;

    // Actions
    /**
     * Set or update a filter for a specific column
     * @param column - Column name to filter
     * @param operation - Filter operation
     * @param value - Filter value
     */
    setColumnFilter: (column: string, operation: ColumnFilter["operation"], value: string) => void;

    /**
     * Remove the filter for a specific column
     * @param column - Column name to clear
     */
    clearColumnFilter: (column: string) => void;

    /**
     * Set the summary type for a specific column
     * @param column - Column name
     * @param summaryType - Summary calculation type
     */
    setColumnSummary: (column: string, summaryType: SummaryType) => void;

    /**
     * Initialize summaries with default type for given headers
     * @param headers - Column headers
     * @param defaultType - Default summary type (defaults to "count")
     */
    initializeSummaries: (headers: string[], defaultType?: SummaryType) => void;

    /**
     * Reset all filters and summaries
     */
    resetFilters: () => void;
}

/**
 * Cell Filter Store
 *
 * Usage:
 * ```ts
 * const { columnFilters, setColumnFilter, clearColumnFilter } = useCellFilterStore();
 *
 * // Set a filter
 * setColumnFilter("Name", "contains", "John");
 *
 * // Clear a filter
 * clearColumnFilter("Name");
 *
 * // Set summary type
 * setColumnSummary("Age", "average");
 * ```
 */
export const useCellFilterStore = create<CellFilterStore>((set, get) => ({
    // Initial state
    columnFilters: [],
    columnSummaries: {},

    // Set or update a filter for a column
    setColumnFilter: (column: string, operation: ColumnFilter["operation"], value: string) => {
        const { columnFilters } = get();

        // Remove existing filter for this column
        const newFilters = columnFilters.filter((f) => f.column !== column);

        // Add new filter
        newFilters.push({ column, operation, value });

        set({ columnFilters: newFilters });
    },

    // Remove a column's filter
    clearColumnFilter: (column: string) => {
        const { columnFilters } = get();
        set({ columnFilters: columnFilters.filter((f) => f.column !== column) });
    },

    // Set summary type for a column
    setColumnSummary: (column: string, summaryType: SummaryType) => {
        const { columnSummaries } = get();
        set({
            columnSummaries: {
                ...columnSummaries,
                [column]: summaryType,
            },
        });
    },

    // Initialize summaries with default type for all headers
    initializeSummaries: (headers: string[], defaultType: SummaryType = "count") => {
        const summaries: Record<string, SummaryType> = {};
        headers.forEach((header) => {
            summaries[header] = defaultType;
        });
        set({ columnSummaries: summaries });
    },

    // Reset all filters and summaries
    resetFilters: () => {
        set({ columnFilters: [], columnSummaries: {} });
    },
}));
