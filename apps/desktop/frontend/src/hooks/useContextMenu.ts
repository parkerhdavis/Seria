// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Context Menu Hook
 *
 * Manages context menu state (position + target cell), the right-click
 * handler that opens the menu, and the click-outside effect that closes it.
 */

import { useState, useCallback, useEffect } from "react";

interface ContextMenuState {
    x: number;
    y: number;
    row: number;
    col: number;
}

interface UseContextMenuParams {
    /** Currently selected cell */
    selectedCell: { row: number; col: number } | null;
    /** Currently selected range */
    selectedRange: {
        startRow: number;
        startCol: number;
        endRow: number;
        endCol: number;
    } | null;
    /** Set the selected cell (used when right-clicking an unselected cell) */
    setSelectedCell: (row: number, col: number) => void;
}

interface UseContextMenuReturn {
    /** Current context menu state (null when closed) */
    contextMenu: ContextMenuState | null;
    /** Close the context menu */
    closeContextMenu: () => void;
    /** Right-click handler for cells */
    handleCellContextMenu: (e: React.MouseEvent, row: number, col: number) => void;
}

export function useContextMenu({
    selectedCell,
    selectedRange,
    setSelectedCell,
}: UseContextMenuParams): UseContextMenuReturn {
    const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

    const closeContextMenu = useCallback(() => {
        setContextMenu(null);
    }, []);

    const handleCellContextMenu = useCallback((e: React.MouseEvent, row: number, col: number) => {
        e.preventDefault();
        e.stopPropagation();

        // If right-clicking on an unselected cell, select it first
        const isClickedCellSelected = selectedCell?.row === row && selectedCell?.col === col;
        const isClickedCellInRange = selectedRange &&
            row >= Math.min(selectedRange.startRow, selectedRange.endRow) &&
            row <= Math.max(selectedRange.startRow, selectedRange.endRow) &&
            col >= Math.min(selectedRange.startCol, selectedRange.endCol) &&
            col <= Math.max(selectedRange.startCol, selectedRange.endCol);

        if (!isClickedCellSelected && !isClickedCellInRange) {
            setSelectedCell(row, col);
        }

        // Show context menu at cursor position
        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            row,
            col,
        });
    }, [selectedCell, selectedRange, setSelectedCell]);

    // Close context menu on click outside
    useEffect(() => {
        if (!contextMenu) return;

        const handleClickOutside = () => {
            setContextMenu(null);
        };

        // Use setTimeout to avoid closing the menu immediately when it opens
        // (the right-click event that opened it would otherwise close it)
        const timeoutId = setTimeout(() => {
            document.addEventListener("click", handleClickOutside);
            document.addEventListener("contextmenu", handleClickOutside);
        }, 0);

        return () => {
            clearTimeout(timeoutId);
            document.removeEventListener("click", handleClickOutside);
            document.removeEventListener("contextmenu", handleClickOutside);
        };
    }, [contextMenu]);

    return {
        contextMenu,
        closeContextMenu,
        handleCellContextMenu,
    };
}
