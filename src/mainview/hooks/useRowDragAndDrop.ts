/**
 * useRowDragAndDrop Hook
 *
 * Manages row drag-and-drop reordering state and handlers.
 * Includes disabling text selection during drag operations.
 *
 * Extracted from CellGridVirtualized to isolate row reorder logic.
 */

import { useState, useEffect } from "react";

/**
 * Provides row drag-and-drop reordering state and event handlers.
 *
 * @param reorderRows - Store action to reorder a row from one index to another
 * @param triggerAutosave - Callback to trigger autosave after reorder
 * @returns Drag state and HTML5 drag event handlers
 */
export function useRowDragAndDrop(
    reorderRows: (from: number, to: number) => void,
    triggerAutosave: () => void,
): {
    draggedRow: number | null;
    dropTargetRow: number | null;
    isDraggingRow: boolean;
    handleRowDragStart: (e: React.DragEvent, rowIndex: number) => void;
    handleRowDragOver: (e: React.DragEvent, rowIndex: number) => void;
    handleRowDrop: (e: React.DragEvent, targetIndex: number) => void;
    handleRowDragEnd: () => void;
} {
    const [draggedRow, setDraggedRow] = useState<number | null>(null);
    const [dropTargetRow, setDropTargetRow] = useState<number | null>(null);
    const [isDraggingRow, setIsDraggingRow] = useState(false);

    // Disable text selection during drag operations
    useEffect(() => {
        if (!isDraggingRow) return;

        // Prevent text selection while dragging
        document.body.style.userSelect = "none";
        document.body.style.cursor = "grabbing";

        return () => {
            document.body.style.userSelect = "";
            document.body.style.cursor = "";
        };
    }, [isDraggingRow]);

    const handleRowDragStart = (e: React.DragEvent, rowIndex: number) => {
        // Only allow left-click drag (button 0)
        if (e.button && e.button !== 0) {
            e.preventDefault();
            return;
        }
        e.stopPropagation();
        setDraggedRow(rowIndex);
        setIsDraggingRow(true);
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", rowIndex.toString());
    };

    const handleRowDragOver = (e: React.DragEvent, rowIndex: number) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";

        // Show visual indicator at target position (including original position)
        if (draggedRow !== null) {
            setDropTargetRow(rowIndex);
        }
    };

    const handleRowDrop = (e: React.DragEvent, targetIndex: number) => {
        e.preventDefault();

        // Perform the reorder on drop
        if (draggedRow !== null && draggedRow !== targetIndex) {
            reorderRows(draggedRow, targetIndex);
            triggerAutosave();
        }

        setDraggedRow(null);
        setDropTargetRow(null);
        setIsDraggingRow(false);
    };

    const handleRowDragEnd = () => {
        setDraggedRow(null);
        setDropTargetRow(null);
        setIsDraggingRow(false);
    };

    return {
        draggedRow,
        dropTargetRow,
        isDraggingRow,
        handleRowDragStart,
        handleRowDragOver,
        handleRowDrop,
        handleRowDragEnd,
    };
}
