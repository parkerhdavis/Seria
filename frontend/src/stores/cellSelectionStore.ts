/**
 * Cell Selection Store
 *
 * Manages cell selection state and clipboard operations.
 * Extracted from cellStore to improve separation of concerns.
 */

import { create } from "zustand";

/**
 * Single cell selection
 */
export interface CellSelection {
    row: number;
    col: number;
}

/**
 * Range selection (rectangular area)
 */
export interface RangeSelection {
    startRow: number;
    startCol: number;
    endRow: number;
    endCol: number;
}

/**
 * Clipboard data with metadata
 */
export interface ClipboardData {
    data: string[][];
    isSingleCell: boolean;
}

/**
 * Selection store state and actions
 */
interface CellSelectionStore {
    // State
    selectedCell: CellSelection | null;
    selectedRange: RangeSelection | null;
    clipboard: ClipboardData | null;
    multiCursors: CellSelection[];

    // Selection actions
    /**
     * Select a single cell (clears any range selection)
     */
    setSelectedCell: (row: number, col: number) => void;

    /**
     * Select a rectangular range of cells (clears single cell selection)
     */
    setSelectedRange: (startRow: number, startCol: number, endRow: number, endCol: number) => void;

    /**
     * Clear all selection state
     */
    clearSelection: () => void;

    // Clipboard actions
    /**
     * Copy the current selection to clipboard
     * Requires data from cellStore to be passed in
     */
    copyToClipboard: (data: string[][]) => void;

    /**
     * Get the current clipboard data
     */
    getClipboard: () => ClipboardData | null;

    /**
     * Clear the clipboard
     */
    clearClipboard: () => void;

    // Selection helpers
    /**
     * Get the normalized bounds of the current selection
     * Returns null if no selection, or {minRow, maxRow, minCol, maxCol}
     */
    getSelectionBounds: () => { minRow: number; maxRow: number; minCol: number; maxCol: number } | null;

    /**
     * Check if a cell is within the current selection
     */
    isCellSelected: (row: number, col: number) => boolean;

    /**
     * Check if there is any selection
     */
    hasSelection: () => boolean;

    // Multi-cursor actions
    /**
     * Add a cursor at the specified position
     */
    addCursor: (row: number, col: number) => void;

    /**
     * Remove a cursor at the specified position
     */
    removeCursor: (row: number, col: number) => void;

    /**
     * Toggle a cursor at the specified position (add if not present, remove if present)
     */
    toggleCursor: (row: number, col: number) => void;

    /**
     * Clear all multi-cursors
     */
    clearCursors: () => void;

    /**
     * Check if there are multiple cursors
     */
    hasMultipleCursors: () => boolean;

    /**
     * Get all cursor positions (includes selected cell and multi-cursors)
     */
    getAllCursors: () => CellSelection[];
}

/**
 * Cell Selection Store
 *
 * Usage:
 * ```ts
 * const { selectedCell, setSelectedCell, copyToClipboard } = useCellSelectionStore();
 *
 * // Select a cell
 * setSelectedCell(5, 2);
 *
 * // Copy selection (pass data from cellStore)
 * copyToClipboard(cellStoreData);
 * ```
 */
export const useCellSelectionStore = create<CellSelectionStore>((set, get) => ({
    // Initial state
    selectedCell: null,
    selectedRange: null,
    clipboard: null,
    multiCursors: [],

    // Select a single cell
    setSelectedCell: (row: number, col: number) => {
        set({
            selectedCell: { row, col },
            selectedRange: null,
        });
    },

    // Select a range
    setSelectedRange: (startRow: number, startCol: number, endRow: number, endCol: number) => {
        set({
            selectedRange: { startRow, startCol, endRow, endCol },
            selectedCell: null,
        });
    },

    // Clear all selection
    clearSelection: () => {
        set({
            selectedCell: null,
            selectedRange: null,
        });
    },

    // Copy current selection to clipboard
    copyToClipboard: (data: string[][]) => {
        const { selectedCell, selectedRange } = get();

        if (selectedRange) {
            // Copy range
            const { startRow, startCol, endRow, endCol } = selectedRange;
            const minRow = Math.min(startRow, endRow);
            const maxRow = Math.max(startRow, endRow);
            const minCol = Math.min(startCol, endCol);
            const maxCol = Math.max(startCol, endCol);

            const copiedData: string[][] = [];
            for (let r = minRow; r <= maxRow; r++) {
                const row: string[] = [];
                for (let c = minCol; c <= maxCol; c++) {
                    row.push(data[r]?.[c] || "");
                }
                copiedData.push(row);
            }

            set({
                clipboard: {
                    data: copiedData,
                    isSingleCell: false,
                },
            });
        } else if (selectedCell) {
            // Copy single cell
            const value = data[selectedCell.row]?.[selectedCell.col] || "";
            set({
                clipboard: {
                    data: [[value]],
                    isSingleCell: true,
                },
            });
        }
    },

    // Get clipboard data
    getClipboard: () => {
        return get().clipboard;
    },

    // Clear clipboard
    clearClipboard: () => {
        set({ clipboard: null });
    },

    // Get normalized selection bounds
    getSelectionBounds: () => {
        const { selectedCell, selectedRange } = get();

        if (selectedRange) {
            const { startRow, startCol, endRow, endCol } = selectedRange;
            return {
                minRow: Math.min(startRow, endRow),
                maxRow: Math.max(startRow, endRow),
                minCol: Math.min(startCol, endCol),
                maxCol: Math.max(startCol, endCol),
            };
        } else if (selectedCell) {
            return {
                minRow: selectedCell.row,
                maxRow: selectedCell.row,
                minCol: selectedCell.col,
                maxCol: selectedCell.col,
            };
        }

        return null;
    },

    // Check if a specific cell is selected
    isCellSelected: (row: number, col: number) => {
        const { selectedCell, selectedRange } = get();

        if (selectedRange) {
            const { startRow, startCol, endRow, endCol } = selectedRange;
            const minRow = Math.min(startRow, endRow);
            const maxRow = Math.max(startRow, endRow);
            const minCol = Math.min(startCol, endCol);
            const maxCol = Math.max(startCol, endCol);

            return row >= minRow && row <= maxRow && col >= minCol && col <= maxCol;
        } else if (selectedCell) {
            return row === selectedCell.row && col === selectedCell.col;
        }

        return false;
    },

    // Check if there is any selection
    hasSelection: () => {
        const { selectedCell, selectedRange } = get();
        return selectedCell !== null || selectedRange !== null;
    },

    // Add a cursor
    addCursor: (row: number, col: number) => {
        const { multiCursors } = get();

        // Don't add if cursor already exists at this position
        const exists = multiCursors.some((c) => c.row === row && c.col === col);
        if (exists) {
            return;
        }

        set({ multiCursors: [...multiCursors, { row, col }] });
    },

    // Remove a cursor
    removeCursor: (row: number, col: number) => {
        const { multiCursors } = get();
        set({
            multiCursors: multiCursors.filter((c) => c.row !== row || c.col !== col),
        });
    },

    // Toggle a cursor (add if not present, remove if present)
    toggleCursor: (row: number, col: number) => {
        const { multiCursors, selectedCell } = get();

        // Check if this is the selected cell
        if (selectedCell && selectedCell.row === row && selectedCell.col === col) {
            // If clicking on the primary selected cell, do nothing
            return;
        }

        // Check if cursor exists in multi-cursors
        const existsIndex = multiCursors.findIndex((c) => c.row === row && c.col === col);

        if (existsIndex >= 0) {
            // Remove cursor
            set({
                multiCursors: multiCursors.filter((_, i) => i !== existsIndex),
            });
        } else {
            // Add cursor
            set({
                multiCursors: [...multiCursors, { row, col }],
            });
        }
    },

    // Clear all multi-cursors
    clearCursors: () => {
        set({ multiCursors: [] });
    },

    // Check if there are multiple cursors
    hasMultipleCursors: () => {
        return get().multiCursors.length > 0;
    },

    // Get all cursor positions
    getAllCursors: () => {
        const { selectedCell, multiCursors } = get();
        const cursors: CellSelection[] = [];

        if (selectedCell) {
            cursors.push(selectedCell);
        }

        cursors.push(...multiCursors);

        return cursors;
    },
}));
