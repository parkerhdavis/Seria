// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Cell Selection Hook
 *
 * Manages mouse-driven cell selection state including:
 * - Click-to-select, shift-click to extend, ctrl-click multi-cursor
 * - Drag selection with RAF-batched updates (max 60fps)
 * - Column hover highlighting
 * - Global mouseup handler to end selection
 */

import { useState, useCallback, useEffect, useRef } from "react";

interface UseCellSelectionParams {
    /** Currently selected cell (from store) */
    selectedCell: { row: number; col: number } | null;
    /** Set the selected cell (store action) */
    setSelectedCell: (row: number, col: number) => void;
    /** Set the selected range (store action) */
    setSelectedRange: (startRow: number, startCol: number, endRow: number, endCol: number) => void;
    /** Toggle a multi-cursor at a position (store action) */
    toggleCursor: (row: number, col: number) => void;
    /** Clear all multi-cursors (store action) */
    clearCursors: () => void;
    /** Ref to the editing cell DOM element (to avoid ending selection on editor clicks) */
    editingCellRef: React.RefObject<HTMLDivElement | null>;
    /** Ref to the grid focus div (to restore focus on click) */
    gridFocusRef: React.RefObject<HTMLDivElement | null>;
    /** Current editing cell (to prevent drag selection while editing) */
    editingCell: { row: number; col: number } | null;
    /** Source of the current edit (to prevent drag selection while editing) */
    editingSource: string | null;
    /** Hover highlight mode from settings */
    hoverHighlightMode: string;
}

interface UseCellSelectionReturn {
    /** Whether a drag selection is in progress */
    isSelecting: boolean;
    /** Currently hovered column index (for highlighting) */
    hoveredColumn: number | null;
    /** Mouse down handler for cells */
    handleCellMouseDown: (e: React.MouseEvent, row: number, col: number) => void;
    /** Mouse enter handler for cells (drag selection + hover) */
    handleCellMouseEnter: (row: number, col: number) => void;
    /** Mouse leave handler for cells (clear hover) */
    handleCellMouseLeave: () => void;
    /** Stop any in-progress drag selection */
    stopSelecting: () => void;
}

export function useCellSelection({
    selectedCell,
    setSelectedCell,
    setSelectedRange,
    toggleCursor,
    clearCursors,
    editingCellRef,
    gridFocusRef,
    editingCell,
    editingSource,
    hoverHighlightMode,
}: UseCellSelectionParams): UseCellSelectionReturn {
    // Selection state for drag selection
    const [isSelecting, setIsSelecting] = useState(false);
    const [selectionStart, setSelectionStart] = useState<{ row: number; col: number } | null>(null);

    // Hover state for column highlighting
    const [hoveredColumn, setHoveredColumn] = useState<number | null>(null);

    // Performance: Batch selection updates using RAF
    const pendingSelectionRef = useRef<{ row: number; col: number } | null>(null);
    const rafIdRef = useRef<number | null>(null);

    // Handle global mouseup for selection
    useEffect(() => {
        const handleMouseUp = (e: MouseEvent) => {
            const target = e.target as Node;
            const isInsideEditingCell = editingCellRef.current && editingCellRef.current.contains(target);

            if (isInsideEditingCell) {
                return;
            }

            setIsSelecting(false);
            setSelectionStart(null);
        };

        document.addEventListener("mouseup", handleMouseUp);
        return () => document.removeEventListener("mouseup", handleMouseUp);
    }, [editingCellRef]);

    // Cleanup RAF on unmount
    useEffect(() => {
        return () => {
            if (rafIdRef.current !== null) {
                cancelAnimationFrame(rafIdRef.current);
                rafIdRef.current = null;
            }
        };
    }, []);

    // Cancel pending selection update when selection ends
    useEffect(() => {
        if (!isSelecting && rafIdRef.current !== null) {
            cancelAnimationFrame(rafIdRef.current);
            rafIdRef.current = null;
            pendingSelectionRef.current = null;
        }
    }, [isSelecting]);

    const handleCellMouseDown = useCallback((e: React.MouseEvent, row: number, col: number) => {
        if (e.button !== 0) return;

        const target = e.target as HTMLElement;
        const isClickInsideEditor =
            target instanceof HTMLInputElement ||
            target instanceof HTMLTextAreaElement ||
            target.closest("input[type='text']") !== null ||
            target.closest("textarea") !== null;

        if (isClickInsideEditor) {
            return;
        }

        if (gridFocusRef.current) {
            gridFocusRef.current.focus();
        }

        // Ctrl/Cmd-click: toggle multi-cursor
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            toggleCursor(row, col);
            return;
        }

        // Shift-click: extend selection (clears multi-cursors)
        if (e.shiftKey && selectedCell) {
            e.preventDefault();
            setSelectedRange(selectedCell.row, selectedCell.col, row, col);
            clearCursors();
            return;
        }

        // Normal click: start new selection (clears multi-cursors)
        setIsSelecting(true);
        setSelectionStart({ row, col });
        setSelectedCell(row, col);
        clearCursors();
    }, [selectedCell, setSelectedRange, setSelectedCell, toggleCursor, clearCursors, gridFocusRef]);

    const handleCellMouseEnter = useCallback((row: number, col: number) => {
        // Set hovered column for column highlighting
        if (hoverHighlightMode === "column" || hoverHighlightMode === "row-and-column") {
            setHoveredColumn(col);
        }

        // Don't handle drag selection if editing
        if (editingCell && editingSource === "cell") {
            return;
        }

        // Handle drag selection with RAF batching for performance
        if (isSelecting && selectionStart) {
            if (row !== selectionStart.row || col !== selectionStart.col) {
                // Store pending selection instead of updating immediately
                pendingSelectionRef.current = { row, col };

                // Cancel any pending RAF
                if (rafIdRef.current !== null) {
                    cancelAnimationFrame(rafIdRef.current);
                }

                // Schedule update for next animation frame (max 60fps)
                rafIdRef.current = requestAnimationFrame(() => {
                    if (pendingSelectionRef.current && selectionStart) {
                        const { row: endRow, col: endCol } = pendingSelectionRef.current;
                        setSelectedRange(selectionStart.row, selectionStart.col, endRow, endCol);
                        pendingSelectionRef.current = null;
                    }
                    rafIdRef.current = null;
                });
            }
        }
    }, [hoverHighlightMode, editingCell, editingSource, isSelecting, selectionStart, setSelectedRange]);

    const handleCellMouseLeave = useCallback(() => {
        setHoveredColumn(null);
    }, []);

    const stopSelecting = useCallback(() => {
        setIsSelecting(false);
        setSelectionStart(null);
    }, []);

    return {
        isSelecting,
        hoveredColumn,
        handleCellMouseDown,
        handleCellMouseEnter,
        handleCellMouseLeave,
        stopSelecting,
    };
}
