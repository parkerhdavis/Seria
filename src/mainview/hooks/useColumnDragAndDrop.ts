/**
 * useColumnDragAndDrop Hook
 *
 * Manages column drag-and-drop reordering state and handlers.
 * Includes disabling text selection during drag operations.
 *
 * Extracted from CellGridVirtualized to isolate column reorder logic.
 */

import { useState, useEffect } from "react";

/**
 * Provides column drag-and-drop reordering state and event handlers.
 *
 * @param reorderColumns - Store action to reorder a column from one index to another
 * @param triggerAutosave - Callback to trigger autosave after reorder
 * @returns Drag state and HTML5 drag event handlers
 */
export function useColumnDragAndDrop(
    reorderColumns: (from: number, to: number) => void,
    triggerAutosave: () => void,
): {
    draggedColumn: number | null;
    dropTargetColumn: number | null;
    isDraggingColumn: boolean;
    handleColumnDragStart: (e: React.DragEvent, colIndex: number) => void;
    handleColumnDragOver: (e: React.DragEvent, colIndex: number) => void;
    handleColumnDrop: (e: React.DragEvent, targetIndex: number) => void;
    handleColumnDragEnd: () => void;
} {
    const [draggedColumn, setDraggedColumn] = useState<number | null>(null);
    const [dropTargetColumn, setDropTargetColumn] = useState<number | null>(null);
    const [isDraggingColumn, setIsDraggingColumn] = useState(false);

    // Disable text selection during drag operations
    useEffect(() => {
        if (!isDraggingColumn) return;

        // Prevent text selection while dragging
        document.body.style.userSelect = "none";
        document.body.style.cursor = "grabbing";

        return () => {
            document.body.style.userSelect = "";
            document.body.style.cursor = "";
        };
    }, [isDraggingColumn]);

    const handleColumnDragStart = (e: React.DragEvent, colIndex: number) => {
        // Only allow left-click drag (button 0)
        if (e.button && e.button !== 0) {
            e.preventDefault();
            return;
        }
        e.stopPropagation();
        setDraggedColumn(colIndex);
        setIsDraggingColumn(true);
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", colIndex.toString());
    };

    const handleColumnDragOver = (e: React.DragEvent, colIndex: number) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";

        // Show visual indicator at target position (including original position)
        if (draggedColumn !== null) {
            setDropTargetColumn(colIndex);
        }
    };

    const handleColumnDrop = (e: React.DragEvent, targetIndex: number) => {
        e.preventDefault();

        // Perform the reorder on drop
        if (draggedColumn !== null && draggedColumn !== targetIndex) {
            reorderColumns(draggedColumn, targetIndex);
            triggerAutosave();
        }

        setDraggedColumn(null);
        setDropTargetColumn(null);
        setIsDraggingColumn(false);
    };

    const handleColumnDragEnd = () => {
        setDraggedColumn(null);
        setDropTargetColumn(null);
        setIsDraggingColumn(false);
    };

    return {
        draggedColumn,
        dropTargetColumn,
        isDraggingColumn,
        handleColumnDragStart,
        handleColumnDragOver,
        handleColumnDrop,
        handleColumnDragEnd,
    };
}
