// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Cell Column Store
 *
 * Manages column display state: widths, order, and autocomplete cache.
 * Extracted from cellStore to improve separation of concerns.
 *
 * Note: Structural column mutations (addColumn, deleteColumn, renameColumn,
 * reorderColumns) remain in cellStore because they also mutate data/headers.
 */

import { create } from "zustand";
import { buildColumnCache, updateColumnCache } from "@utils/autocomplete";

/**
 * Column store state and actions
 */
interface CellColumnStore {
    // State

    /**
     * Column widths stored as proportions (0-1 range) of available width.
     * e.g., {0: 0.3, 1: 0.5, 2: 0.2} means col 0 gets 30%, col 1 gets 50%, col 2 gets 20%
     */
    columnWidths: Record<number, number>;

    /**
     * Column order - array of column indices indicating display order.
     * e.g., [2, 0, 1] means display column 2 first, then column 0, then column 1
     */
    columnOrder: number[];

    /**
     * Autocomplete cache - maps column index to set of unique values
     */
    columnCache: Map<number, Set<string>>;

    // Actions

    /**
     * Set column widths (accepts either a value or an updater function)
     */
    setColumnWidths: (widths: Record<number, number> | ((prev: Record<number, number>) => Record<number, number>)) => void;

    /**
     * Set column order
     */
    setColumnOrder: (order: number[]) => void;

    /**
     * Initialize default column order [0, 1, 2, ...] for given header count
     */
    initializeColumnOrder: (headerCount: number) => void;

    /**
     * Update column order after a reorder operation
     */
    updateColumnOrder: (fromIndex: number, toIndex: number) => void;

    /**
     * Rebuild the autocomplete cache from scratch
     * @param data - Current cell data
     * @param headers - Current headers
     */
    rebuildColumnCache: (data: string[][], headers: string[]) => void;

    /**
     * Update autocomplete cache for a single cell change
     * @param col - Column index
     * @param value - New cell value
     */
    updateColumnCacheEntry: (col: number, value: string) => void;

    /**
     * Reset all column display state
     */
    resetColumns: () => void;
}

/**
 * Cell Column Store
 *
 * Usage:
 * ```ts
 * const { columnWidths, setColumnWidths, columnOrder } = useCellColumnStore();
 *
 * // Set widths
 * setColumnWidths({ 0: 0.5, 1: 0.5 });
 *
 * // Update with function
 * setColumnWidths(prev => ({ ...prev, 0: 0.3 }));
 *
 * // Rebuild autocomplete cache
 * rebuildColumnCache(data, headers);
 * ```
 */
export const useCellColumnStore = create<CellColumnStore>((set, get) => ({
    // Initial state
    columnWidths: {},
    columnOrder: [],
    columnCache: new Map(),

    // Set column widths
    setColumnWidths: (widths: Record<number, number> | ((prev: Record<number, number>) => Record<number, number>)) => {
        if (typeof widths === "function") {
            const currentWidths = get().columnWidths;
            const newWidths = widths(currentWidths);
            set({ columnWidths: newWidths });
        } else {
            set({ columnWidths: widths });
        }
    },

    // Set column order
    setColumnOrder: (order: number[]) => {
        set({ columnOrder: order });
    },

    // Initialize default column order
    initializeColumnOrder: (headerCount: number) => {
        const defaultOrder = Array.from({ length: headerCount }, (_, i) => i);
        set({ columnOrder: defaultOrder });
    },

    // Update column order after a reorder operation
    updateColumnOrder: (fromIndex: number, toIndex: number) => {
        const { columnOrder } = get();
        const newColumnOrder = [...columnOrder];
        const [movedOrderIndex] = newColumnOrder.splice(fromIndex, 1);
        newColumnOrder.splice(toIndex, 0, movedOrderIndex);
        set({ columnOrder: newColumnOrder });
    },

    // Rebuild column cache from current data
    rebuildColumnCache: (data: string[][], headers: string[]) => {
        const cache = buildColumnCache(data, headers);
        set({ columnCache: cache });
    },

    // Update cache for a single cell change
    updateColumnCacheEntry: (col: number, value: string) => {
        const { columnCache } = get();
        updateColumnCache(columnCache, col, value);
    },

    // Reset all column state
    resetColumns: () => {
        set({
            columnWidths: {},
            columnOrder: [],
            columnCache: new Map(),
        });
    },
}));
