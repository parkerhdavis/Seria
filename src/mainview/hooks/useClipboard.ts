/**
 * Clipboard Operations Hook
 *
 * Manages copy, cut, and paste operations for the cell grid.
 * Handles both internal clipboard (for advanced paste like tiling)
 * and system clipboard via Tauri's clipboard-manager plugin.
 *
 * Cut cells are tracked locally so they can be visually indicated
 * (dotted outline) and cleared upon paste.
 */

import { useState, useCallback } from "react";
import { writeText, readText } from "@utils/clipboard";
import { logger } from "@utils/logger";
import { toast } from "@stores/toastStore";

interface UseClipboardParams {
  /** Currently selected cell position */
  selectedCell: { row: number; col: number } | null;
  /** Currently selected range */
  selectedRange: {
    startRow: number;
    startCol: number;
    endRow: number;
    endCol: number;
  } | null;
  /** Filtered data rows (2D array of cell values) */
  filteredData: string[][];
  /** Column headers */
  headers: string[];
  /** Copy selection to internal clipboard (cellStore action) */
  copySelection: () => void;
  /** Batch update multiple cells (cellStore action) */
  updateCells: (
    updates: Array<{ row: number; col: number; value: string }>,
  ) => void;
  /** Trigger autosave after modifications */
  triggerAutosave: () => void;
  /** Whether multiple cursors are active */
  hasMultipleCursors: () => boolean;
  /** Get all cursor positions (primary + multi-cursors) */
  getAllCursors: () => Array<{ row: number; col: number }>;
}

interface UseClipboardReturn {
  /** Cells currently marked as cut (shown with dotted outline) */
  cutCells: { row: number; col: number }[] | null;
  /** Directly set or clear the cut cells state */
  setCutCells: React.Dispatch<
    React.SetStateAction<{ row: number; col: number }[] | null>
  >;
  /** Copy selection to internal + system clipboard */
  handleCopyToClipboard: () => Promise<void>;
  /** Cut selection: copy then mark cells for later clearing */
  handleCutToClipboard: () => Promise<void>;
  /** Paste from system clipboard into selected position(s) */
  handlePasteFromSystemClipboard: () => Promise<void>;
}

export function useClipboard({
  selectedCell,
  selectedRange,
  filteredData,
  headers,
  copySelection,
  updateCells,
  triggerAutosave,
  hasMultipleCursors,
  getAllCursors,
}: UseClipboardParams): UseClipboardReturn {
  // Cut cells state - tracks cells that have been cut but not yet pasted
  const [cutCells, setCutCells] = useState<
    { row: number; col: number }[] | null
  >(null);

  // Copy selection to both internal and system clipboard
  const handleCopyToClipboard = useCallback(async () => {
    // Cancel any pending cut operation
    setCutCells(null);

    // Copy to internal clipboard (for advanced paste operations like tiling)
    copySelection();

    // Also copy to system clipboard in tab-delimited format using Tauri's clipboard API
    try {
      if (selectedRange) {
        const { startRow, startCol, endRow, endCol } = selectedRange;
        const minRow = Math.min(startRow, endRow);
        const maxRow = Math.max(startRow, endRow);
        const minCol = Math.min(startCol, endCol);
        const maxCol = Math.max(startCol, endCol);

        const copiedRows: string[] = [];
        for (let r = minRow; r <= maxRow; r++) {
          const rowCells: string[] = [];
          for (let c = minCol; c <= maxCol; c++) {
            rowCells.push(filteredData[r]?.[c] || "");
          }
          copiedRows.push(rowCells.join("\t"));
        }

        await writeText(copiedRows.join("\n"));
      } else if (selectedCell) {
        const value = filteredData[selectedCell.row]?.[selectedCell.col] || "";
        await writeText(value);
      }
    } catch (err: unknown) {
      logger.error("Failed to copy to system clipboard:", err);
      toast.error("Failed to copy to clipboard");
    }
  }, [copySelection, selectedRange, selectedCell, filteredData]);

  // Cut selection to clipboard and mark cells for later clearing
  const handleCutToClipboard = useCallback(async () => {
    // First copy to clipboard
    await handleCopyToClipboard();

    // Mark the cells as cut (to show dotted outline) instead of clearing immediately
    // They will be cleared when pasted
    const cellsToCut: { row: number; col: number }[] = [];

    if (selectedRange) {
      const { startRow, startCol, endRow, endCol } = selectedRange;
      const minRow = Math.min(startRow, endRow);
      const maxRow = Math.max(startRow, endRow);
      const minCol = Math.min(startCol, endCol);
      const maxCol = Math.max(startCol, endCol);

      for (let r = minRow; r <= maxRow; r++) {
        for (let c = minCol; c <= maxCol; c++) {
          cellsToCut.push({ row: r, col: c });
        }
      }
    } else if (selectedCell) {
      cellsToCut.push({ row: selectedCell.row, col: selectedCell.col });
    }

    setCutCells(cellsToCut);
  }, [handleCopyToClipboard, selectedRange, selectedCell]);

  // Paste from system clipboard
  const handlePasteFromSystemClipboard = useCallback(async () => {
    try {
      // Read text from system clipboard using Tauri's clipboard API
      const text = await readText();

      if (!text || !selectedCell) {
        return;
      }

      // Parse clipboard text - treat tabs as column separators, newlines as row separators
      const rows = text.split("\n").map((row) => row.split("\t"));

      // Remove trailing empty row if the clipboard text ended with a newline
      if (
        rows.length > 0 &&
        rows[rows.length - 1].length === 1 &&
        rows[rows.length - 1][0] === ""
      ) {
        rows.pop();
      }

      // Build array of cell updates
      const cellUpdates: Array<{ row: number; col: number; value: string }> =
        [];

      // Check if we have multiple cursors - if so, paste to all cursor positions
      if (hasMultipleCursors()) {
        const allCursors = getAllCursors();

        // Paste the same data to each cursor position
        allCursors.forEach((cursor) => {
          for (let r = 0; r < rows.length; r++) {
            for (let c = 0; c < rows[r].length; c++) {
              const targetRow = cursor.row + r;
              const targetCol = cursor.col + c;
              if (
                targetRow < filteredData.length &&
                targetCol < headers.length
              ) {
                cellUpdates.push({
                  row: targetRow,
                  col: targetCol,
                  value: rows[r][c],
                });
              }
            }
          }
        });
      } else {
        // Single cursor - normal paste
        const { row: startRow, col: startCol } = selectedCell;
        for (let r = 0; r < rows.length; r++) {
          for (let c = 0; c < rows[r].length; c++) {
            const targetRow = startRow + r;
            const targetCol = startCol + c;
            if (targetRow < filteredData.length && targetCol < headers.length) {
              cellUpdates.push({
                row: targetRow,
                col: targetCol,
                value: rows[r][c],
              });
            }
          }
        }
      }

      // Update all cells at once (single undo entry)
      if (cellUpdates.length > 0) {
        updateCells(cellUpdates);
      }

      // If there were cut cells, clear them now that paste is complete
      if (cutCells && cutCells.length > 0) {
        const clearUpdates = cutCells.map((cell) => ({
          row: cell.row,
          col: cell.col,
          value: "",
        }));
        updateCells(clearUpdates);
        setCutCells(null);
      }

      // Trigger autosave after paste operation
      triggerAutosave();
    } catch (err: unknown) {
      logger.error("Failed to paste from system clipboard:", err);
      toast.error("Failed to paste from clipboard");
    }
  }, [
    selectedCell,
    filteredData,
    headers,
    updateCells,
    cutCells,
    triggerAutosave,
    hasMultipleCursors,
    getAllCursors,
  ]);

  return {
    cutCells,
    setCutCells,
    handleCopyToClipboard,
    handleCutToClipboard,
    handlePasteFromSystemClipboard,
  };
}
