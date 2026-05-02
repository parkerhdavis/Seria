// SPDX-License-Identifier: AGPL-3.0-or-later
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

import { useEffect, useRef } from "react";
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

    // Use refs for callback params to avoid effect dependency on caller identity.
    // Callers pass inline arrow functions (e.g. `() => setState(null)`) which
    // create new references every render. Without refs, effects that depend on
    // these callbacks would re-run every render → state updates → infinite loop.
    const clearPrintSelectionRef = useRef(clearPrintSelection);
    clearPrintSelectionRef.current = clearPrintSelection;

    const closeContextMenuRef = useRef(closeContextMenu);
    closeContextMenuRef.current = closeContextMenu;

    const setIsEditingFromPrintRef = useRef(setIsEditingFromPrint);
    setIsEditingFromPrintRef.current = setIsEditingFromPrint;

    // Effect 2: Clear print selection when cell grid enters edit mode
    useEffect(() => {
        if (editingCell && !isEditingFromPrint) {
            clearPrintSelectionRef.current();
        }
    }, [editingCell, isEditingFromPrint]);

    // Effect 3: Clear print selection when a cell is selected in the grid
    useEffect(() => {
        if ((selectedCell || selectedRange) && hasPrintSelection && !isEditingFromPrint) {
            clearPrintSelectionRef.current();
        }
        // Intentionally omitting isEditingFromPrint and hasPrintSelection from deps
        // to avoid re-triggering — we only want to react to cell selection changes
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedCell, selectedRange]);

    // Effect 4: Clear print selection when clicking inside the cell grid
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            const target = e.target as Node;
            const cellGrid = document.querySelector(".cell-grid-container");
            if (cellGrid && cellGrid.contains(target) && hasPrintSelection && !isEditingFromPrint) {
                clearPrintSelectionRef.current();
            }
        };

        document.addEventListener("click", handleClick);
        return () => document.removeEventListener("click", handleClick);
    }, [hasPrintSelection, isEditingFromPrint]);

    // Effect 5: Close context menu on any click
    useEffect(() => {
        if (contextMenu) {
            const handleClick = () => {
                closeContextMenuRef.current();
            };
            document.addEventListener("click", handleClick);
            return () => document.removeEventListener("click", handleClick);
        }
    }, [contextMenu]);

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
                setIsEditingFromPrintRef.current(false);
            }
        };

        document.addEventListener("mousedown", handleMouseDown);
        return () => document.removeEventListener("mousedown", handleMouseDown);
    }, [isEditingFromPrint, editingCell, editingValue, updateCell, clearEditingCell]);
}
