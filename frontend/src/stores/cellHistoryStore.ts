/**
 * Cell History Store
 *
 * Manages undo/redo history for Cell data mutations.
 * Extracted from cellStore to improve separation of concerns.
 */

import { create } from "zustand";

/**
 * Snapshot of data state for undo/redo
 */
export interface DataSnapshot {
    data: string[][];
    headers: string[];
}

/**
 * History store state and actions
 */
interface CellHistoryStore {
    // State
    undoStack: DataSnapshot[];
    redoStack: DataSnapshot[];

    // Actions
    /**
     * Push a snapshot to the undo stack (clears redo stack)
     * Call this BEFORE making a mutation to capture the "before" state
     */
    pushSnapshot: (snapshot: DataSnapshot) => void;

    /**
     * Pop from undo stack and push current state to redo stack
     * Returns the previous state to restore, or null if stack is empty
     */
    popUndo: (currentSnapshot: DataSnapshot) => DataSnapshot | null;

    /**
     * Pop from redo stack and push current state to undo stack
     * Returns the next state to restore, or null if stack is empty
     */
    popRedo: (currentSnapshot: DataSnapshot) => DataSnapshot | null;

    /**
     * Check if undo is available
     */
    canUndo: () => boolean;

    /**
     * Check if redo is available
     */
    canRedo: () => boolean;

    /**
     * Clear all history (e.g., when loading a new file)
     */
    clearHistory: () => void;

    /**
     * Get the current undo stack length (for debugging/UI)
     */
    getUndoCount: () => number;

    /**
     * Get the current redo stack length (for debugging/UI)
     */
    getRedoCount: () => number;
}

/**
 * Maximum number of undo states to keep in memory
 */
const MAX_UNDO_STACK_SIZE = 50;

/**
 * Helper function to create a deep copy snapshot of data
 */
export const createSnapshot = (data: string[][], headers: string[]): DataSnapshot => ({
    data: data.map((row) => [...row]),
    headers: [...headers],
});

/**
 * Cell History Store
 *
 * Usage:
 * ```ts
 * const { pushSnapshot, popUndo, canUndo } = useCellHistoryStore();
 *
 * // Before making a change:
 * pushSnapshot(createSnapshot(currentData, currentHeaders));
 *
 * // To undo:
 * if (canUndo()) {
 *     const previousState = popUndo(createSnapshot(currentData, currentHeaders));
 *     if (previousState) {
 *         // Apply previousState.data and previousState.headers
 *     }
 * }
 * ```
 */
export const useCellHistoryStore = create<CellHistoryStore>((set, get) => ({
    // Initial state
    undoStack: [],
    redoStack: [],

    // Push snapshot to undo stack (before mutation)
    pushSnapshot: (snapshot: DataSnapshot) => {
        const { undoStack } = get();

        // Limit undo stack size to prevent memory issues
        const newUndoStack = [...undoStack, snapshot].slice(-MAX_UNDO_STACK_SIZE);

        // Clear redo stack when a new action is performed
        set({
            undoStack: newUndoStack,
            redoStack: [],
        });
    },

    // Pop from undo stack, push current to redo
    popUndo: (currentSnapshot: DataSnapshot) => {
        const { undoStack, redoStack } = get();

        if (undoStack.length === 0) {
            return null;
        }

        // Get the previous state
        const previousState = undoStack[undoStack.length - 1];
        const newUndoStack = undoStack.slice(0, -1);

        // Push current state to redo stack
        const newRedoStack = [...redoStack, currentSnapshot];

        set({
            undoStack: newUndoStack,
            redoStack: newRedoStack,
        });

        return previousState;
    },

    // Pop from redo stack, push current to undo
    popRedo: (currentSnapshot: DataSnapshot) => {
        const { undoStack, redoStack } = get();

        if (redoStack.length === 0) {
            return null;
        }

        // Get the next state
        const nextState = redoStack[redoStack.length - 1];
        const newRedoStack = redoStack.slice(0, -1);

        // Push current state to undo stack
        const newUndoStack = [...undoStack, currentSnapshot];

        set({
            undoStack: newUndoStack,
            redoStack: newRedoStack,
        });

        return nextState;
    },

    // Check if undo is available
    canUndo: () => {
        return get().undoStack.length > 0;
    },

    // Check if redo is available
    canRedo: () => {
        return get().redoStack.length > 0;
    },

    // Clear all history
    clearHistory: () => {
        set({
            undoStack: [],
            redoStack: [],
        });
    },

    // Get undo count
    getUndoCount: () => {
        return get().undoStack.length;
    },

    // Get redo count
    getRedoCount: () => {
        return get().redoStack.length;
    },
}));
