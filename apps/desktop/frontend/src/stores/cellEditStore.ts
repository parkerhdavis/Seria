/**
 * Cell Edit Store
 *
 * Manages cell editing state, coordinating between Cell Grid and Print preview.
 * Extracted from cellStore to improve separation of concerns.
 */

import { create } from "zustand";

/**
 * Cell being edited
 */
export interface EditingCell {
    row: number;
    col: number;
}

/**
 * Source of the edit action
 */
export type EditingSource = "cell" | "print" | null;

/**
 * Edit store state and actions
 */
interface CellEditStore {
    // State
    editingCell: EditingCell | null;
    editingValue: string;
    editingSource: EditingSource;

    // Actions
    /**
     * Start editing a cell
     * @param row - Row index
     * @param col - Column index
     * @param initialValue - Initial value to show in editor
     * @param source - Where the edit originated ("cell" or "print")
     */
    setEditingCell: (row: number, col: number, initialValue: string, source?: "cell" | "print") => void;

    /**
     * Update the value being edited (for real-time preview updates)
     */
    updateEditingValue: (value: string) => void;

    /**
     * Clear editing state (finish editing)
     */
    clearEditingCell: () => void;

    /**
     * Check if currently editing a specific cell
     */
    isEditingCell: (row: number, col: number) => boolean;

    /**
     * Check if any cell is being edited
     */
    isEditing: () => boolean;

    /**
     * Get the current editing location
     */
    getEditingLocation: () => { row: number; col: number } | null;
}

/**
 * Cell Edit Store
 *
 * Usage:
 * ```ts
 * const { editingCell, setEditingCell, clearEditingCell } = useCellEditStore();
 *
 * // Start editing
 * setEditingCell(5, 2, "initial value", "cell");
 *
 * // Update value during edit
 * updateEditingValue("new value");
 *
 * // Finish editing
 * clearEditingCell();
 * ```
 */
export const useCellEditStore = create<CellEditStore>((set, get) => ({
    // Initial state
    editingCell: null,
    editingValue: "",
    editingSource: null,

    // Start editing a cell
    setEditingCell: (row: number, col: number, initialValue: string, source: "cell" | "print" = "cell") => {
        set({
            editingCell: { row, col },
            editingValue: initialValue,
            editingSource: source,
        });
    },

    // Update the value being edited
    updateEditingValue: (value: string) => {
        set({ editingValue: value });
    },

    // Clear editing state
    clearEditingCell: () => {
        set({
            editingCell: null,
            editingValue: "",
            editingSource: null,
        });
    },

    // Check if editing a specific cell
    isEditingCell: (row: number, col: number) => {
        const { editingCell } = get();
        return editingCell !== null && editingCell.row === row && editingCell.col === col;
    },

    // Check if any cell is being edited
    isEditing: () => {
        return get().editingCell !== null;
    },

    // Get the current editing location
    getEditingLocation: () => {
        const { editingCell } = get();
        return editingCell ? { row: editingCell.row, col: editingCell.col } : null;
    },
}));
