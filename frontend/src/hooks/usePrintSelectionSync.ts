/**
 * Print Selection Sync Hook
 *
 * Shared logic for synchronizing print-view selection state with the
 * cell grid. Used by both ScreenplayPrint and CardPrint to:
 * - Clear print selection when cell grid is edited/selected
 * - Close context menu on outside click
 * - Save editing on outside click
 *
 * Effect 1 (scroll-to-editing-cell) is NOT included because it requires
 * print-type-specific ref lookup strategies.
 */

import { useEffect } from "react";
import { useCellSelectionStore } from "@stores/cellSelectionStore";
import { useCellEditStore } from "@stores/cellEditStore";
import { useCellStore } from "@stores/cellStore";

interface UsePrintSelectionSyncParams {
    /** Whether a print element is currently selected */
    hasPrintSelection: boolean;
    /** Clear the print selection */
    clearPrintSelection: () => void;
    /** Whether editing is happening from the print view */
    isEditingFromPrint: boolean;
    /** Set the isEditingFromPrint flag */
    setIsEditingFromPrint: (value: boolean) => void;
    /** Context menu state (null = closed) */
    contextMenu: unknown | null;
    /** Close the context menu */
    closeContextMenu: () => void;
}

export function usePrintSelectionSync({
    hasPrintSelection,
    clearPrintSelection,
    isEditingFromPrint,
    setIsEditingFromPrint,
    contextMenu,
    closeContextMenu,
}: UsePrintSelectionSyncParams): void {
    // Store subscriptions for shared effects
    const editingCell = useCellEditStore((state) => state.editingCell);
    const editingValue = useCellEditStore((state) => state.editingValue);
    const clearEditingCell = useCellEditStore((state) => state.clearEditingCell);
    const updateCell = useCellStore((state) => state.updateCell);
    const selectedCell = useCellSelectionStore((state) => state.selectedCell);
    const selectedRange = useCellSelectionStore((state) => state.selectedRange);

    // Effect 2: Clear print selection when cell grid enters edit mode
    useEffect(() => {
        if (editingCell && !isEditingFromPrint) {
            clearPrintSelection();
        }
    }, [editingCell, isEditingFromPrint, clearPrintSelection]);

    // Effect 3: Clear print selection when a cell is selected in the grid
    useEffect(() => {
        if ((selectedCell || selectedRange) && hasPrintSelection && !isEditingFromPrint) {
            clearPrintSelection();
        }
        // Intentionally omitting isEditingFromPrint and hasPrintSelection from deps
        // to avoid infinite loops — we only want to react to cell selection changes
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedCell, selectedRange]);

    // Effect 4: Clear print selection when clicking inside the cell grid
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            const target = e.target as Node;
            const cellGrid = document.querySelector(".cell-grid-container");
            if (cellGrid && cellGrid.contains(target) && hasPrintSelection && !isEditingFromPrint) {
                clearPrintSelection();
            }
        };

        document.addEventListener("click", handleClick);
        return () => document.removeEventListener("click", handleClick);
    }, [hasPrintSelection, isEditingFromPrint, clearPrintSelection]);

    // Effect 5: Close context menu on any click
    useEffect(() => {
        if (contextMenu) {
            const handleClick = () => {
                closeContextMenu();
            };
            document.addEventListener("click", handleClick);
            return () => document.removeEventListener("click", handleClick);
        }
    }, [contextMenu, closeContextMenu]);

    // Effect 6: Save editing when clicking outside an input/textarea
    useEffect(() => {
        if (!isEditingFromPrint || !editingCell) return;

        const handleMouseDown = (e: MouseEvent) => {
            const target = e.target as HTMLElement;

            if (
                !target.closest("input[type='text']") &&
                !target.closest("textarea")
            ) {
                updateCell(editingCell.row, editingCell.col, editingValue);
                clearEditingCell();
                setIsEditingFromPrint(false);
            }
        };

        document.addEventListener("mousedown", handleMouseDown);
        return () => document.removeEventListener("mousedown", handleMouseDown);
    }, [isEditingFromPrint, editingCell, editingValue, updateCell, clearEditingCell, setIsEditingFromPrint]);
}
