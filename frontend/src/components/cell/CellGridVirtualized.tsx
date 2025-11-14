/**
 * Virtualized Cell Grid Component (Enhanced)
 *
 * Performance-optimized version of CellGrid using virtualization
 * for handling large Cell files efficiently with dynamic row heights.
 *
 * Phase 1 Complete: Selection system, keyboard shortcuts, dynamic sizing
 * Phase 2 Complete: Copy/paste/cut, context menus, multi-cell fill
 * Phase 3 Complete: Column resizing, column filtering UI, column summaries with fixed bottom row
 * Phase 4 Complete: Row/column drag-and-drop reordering
 */

import { useState, useMemo, useEffect, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useCellStore } from "@stores/cellStore";
import { useSettingsStore } from "@stores/settingsStore";
import { useFindReplaceStore } from "@stores/findReplaceStore";
import { useDrawerStore } from "@stores/drawerStore";
import ColumnFilterDropdown from "../toolbar/ColumnFilterDropdown";
import { calculateSummary } from "@utils/summaryCalculations";
import { writeText, readText } from "@tauri-apps/plugin-clipboard-manager";
import { useAutosave } from "@utils/useAutosave";

interface CellGridVirtualizedProps {
    onCellEdit?: (row: number, col: number, value: string) => void;
}

/**
 * Virtualized Cell Grid - only renders visible rows for performance
 * Now with full selection system and keyboard navigation
 */
function CellGridVirtualized({ onCellEdit }: CellGridVirtualizedProps) {
    // ===== STORE INTEGRATION =====
    const {
        headers,
        data,
        updateCell,
        updateCells,
        editingCell,
        editingValue,
        editingSource,
        setEditingCell,
        updateEditingValue,
        clearEditingCell,
        selectedCell,
        selectedRange,
        setSelectedCell,
        setSelectedRange,
        clearSelection,
        copySelection,
        clearCells,
        columnWidths,
        setColumnWidths,
        columnFilters,
        setColumnFilter,
        clearColumnFilter,
        columnSummaries,
        setColumnSummary,
        reorderRows,
        reorderColumns,
    } = useCellStore();

    const {
        showColumnSeparators,
        wrapText,
        autoFitColumns,
        rowColoringMode,
        rowColorFilter,
        cellFollowsPrintEdit,
        hoverHighlightMode,
    } = useSettingsStore();

    const { matches, currentMatchIndex } = useFindReplaceStore();

    const { position: drawerPosition, rightDrawerSize } = useDrawerStore();

    // Autosave hook
    const { triggerAutosave } = useAutosave();

    // ===== LOCAL STATE =====
    // Selection state for drag selection
    const [isSelecting, setIsSelecting] = useState(false);
    const [selectionStart, setSelectionStart] = useState<{ row: number; col: number } | null>(null);

    // Cut cells state - tracks cells that have been cut but not yet pasted
    const [cutCells, setCutCells] = useState<{ row: number; col: number }[] | null>(null);

    // Hover state for column highlighting
    const [hoveredColumn, setHoveredColumn] = useState<number | null>(null);

    // Context menu state
    const [contextMenu, setContextMenu] = useState<{
        x: number;
        y: number;
        row: number;
        col: number;
    } | null>(null);

    // Multi-cell fill dialog state
    const [showFillDialog, setShowFillDialog] = useState(false);

    // Column resizing state
    const [resizingColumn, setResizingColumn] = useState<number | null>(null);
    const [resizeStartX, setResizeStartX] = useState(0);
    const [resizeStartWidth, setResizeStartWidth] = useState(0);
    const [resizeNextStartWidth, setResizeNextStartWidth] = useState(0);
    const [resizeAllStartWidths, setResizeAllStartWidths] = useState<Record<number, number>>({});
    const [isShiftResize, setIsShiftResize] = useState(false);

    // Drag and drop state
    const [draggedRow, setDraggedRow] = useState<number | null>(null);
    const [draggedColumn, setDraggedColumn] = useState<number | null>(null);
    const [dropTargetRow, setDropTargetRow] = useState<number | null>(null);
    const [dropTargetColumn, setDropTargetColumn] = useState<number | null>(null);
    const [isDraggingRow, setIsDraggingRow] = useState(false);
    const [isDraggingColumn, setIsDraggingColumn] = useState(false);

    // Performance: Batch selection updates using RAF
    const pendingSelectionRef = useRef<{ row: number; col: number } | null>(null);
    const rafIdRef = useRef<number | null>(null);

    // Track container width changes to trigger re-renders for proportional column widths
    const [containerWidth, setContainerWidth] = useState(0);

    // Summary row scroll sync
    const [summaryRowScrollLeft, setSummaryRowScrollLeft] = useState(0);

    // ===== REFS =====
    const parentRef = useRef<HTMLDivElement>(null);
    const gridFocusRef = useRef<HTMLDivElement>(null);
    const editingCellRef = useRef<HTMLDivElement | null>(null);
    const editingInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
    const summaryRowContentRef = useRef<HTMLDivElement>(null);

    // ===== FILTERED DATA =====
    // Apply column filters
    const filteredData = useMemo(() => {
        if (columnFilters.length === 0) return data;

        return data.filter((row) => {
            return columnFilters.every((filter) => {
                const colIndex = headers.indexOf(filter.column);
                if (colIndex === -1) return true;

                const cellValue = (row[colIndex] || "").toLowerCase();
                const filterValue = filter.value.toLowerCase();

                switch (filter.operation) {
                    case "contains":
                        return cellValue.includes(filterValue);
                    case "not-contains":
                        return !cellValue.includes(filterValue);
                    case "equals":
                        return cellValue === filterValue;
                    case "not-equals":
                        return cellValue !== filterValue;
                    default:
                        return true;
                }
            });
        });
    }, [data, headers, columnFilters]);

    // ===== VIRTUALIZER SETUP WITH DYNAMIC SIZING =====
    const rowVirtualizer = useVirtualizer({
        count: filteredData.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 40, // Initial estimate, will be measured dynamically
        overscan: 10, // Pre-render 10 rows above/below for smoother scrolling
        // Enable dynamic sizing for wrapText support
        measureElement: (element) => {
            // Measure actual row height after render
            return element?.getBoundingClientRect().height ?? 40;
        },
    });

    // ===== COLUMN WIDTH HELPERS =====
    const getAvailableWidth = (): number => {
        if (!parentRef.current) return 800;
        // Use the tracked containerWidth state to ensure re-renders on resize
        const currentWidth = containerWidth || parentRef.current.clientWidth;
        const rowNumberWidth = 64; // Row number column (left side only)
        const scrollbarWidth = autoFitColumns ? 14 : 0; // Account for vertical scrollbar when auto-fit is on
        // Account for Print Drawer when positioned on the right
        const drawerWidth = drawerPosition === "right" ? rightDrawerSize : 0;
        const available = Math.max(currentWidth - rowNumberWidth - scrollbarWidth - drawerWidth, 200);
        return available;
    };

    const getPixelWidth = (colIndex: number): number => {
        const availableWidth = getAvailableWidth();
        const proportion = columnWidths[colIndex];

        if (proportion === undefined || proportion === 0) {
            const equalProportion = 1 / headers.length;
            return Math.floor(equalProportion * availableWidth);
        }

        return Math.floor(proportion * availableWidth);
    };

    // Get pixel widths for all columns, ensuring they sum exactly to available width
    const getAllPixelWidths = (): number[] => {
        const availableWidth = getAvailableWidth();
        const widths: number[] = [];
        let totalAllocated = 0;

        // Calculate widths for all columns except the last
        for (let i = 0; i < headers.length - 1; i++) {
            const width = getPixelWidth(i);
            widths.push(width);
            totalAllocated += width;
        }

        // Last column gets remaining space to fill exactly
        const remainingWidth = Math.max(100, availableWidth - totalAllocated);
        widths.push(remainingWidth);

        return widths;
    };

    const convertPixelsToProportions = (pixelWidths: Record<number, number>): Record<number, number> => {
        const totalWidth = Object.values(pixelWidths).reduce((sum, w) => sum + w, 0);
        const proportions: Record<number, number> = {};
        Object.keys(pixelWidths).forEach((key) => {
            const idx = parseInt(key);
            proportions[idx] = pixelWidths[idx] / totalWidth;
        });
        return proportions;
    };

    // ===== ROW COLORING =====
    const rowMatchesFilter = (row: string[]) => {
        if (!rowColorFilter || !rowColorFilter.value) return false;

        const fieldIndex = headers.indexOf(rowColorFilter.field);
        if (fieldIndex === -1) return false;

        const cellValue = (row[fieldIndex] || "").toLowerCase();
        const filterValue = rowColorFilter.value.toLowerCase();

        switch (rowColorFilter.operation) {
            case "contains":
                return cellValue.includes(filterValue);
            case "not-contains":
                return !cellValue.includes(filterValue);
            case "equals":
                return cellValue === filterValue;
            case "not-equals":
                return cellValue !== filterValue;
            default:
                return false;
        }
    };

    // ===== CONTAINER RESIZE OBSERVER =====

    // Watch for container size changes (e.g., drawer opening/closing) and update state to trigger re-renders
    useEffect(() => {
        if (!parentRef.current) return;

        const updateContainerWidth = () => {
            if (parentRef.current) {
                const newWidth = parentRef.current.clientWidth;
                setContainerWidth(newWidth);
            }
        };

        // Set initial width
        updateContainerWidth();

        // Watch for container resize (drawer open/close, window resize, etc.)
        const resizeObserver = new ResizeObserver(() => {
            updateContainerWidth();
        });
        resizeObserver.observe(parentRef.current);

        // Also listen to window resize for good measure
        window.addEventListener("resize", updateContainerWidth);

        return () => {
            resizeObserver.disconnect();
            window.removeEventListener("resize", updateContainerWidth);
        };
    }, []); // Run only on mount - ResizeObserver and window resize handle updates

    // ===== AUTO-FIT COLUMNS INITIALIZATION =====

    // Auto-fit columns effect - set initial equal proportions if needed
    useEffect(() => {
        if (!autoFitColumns || headers.length === 0) return;

        // Check if we already have column proportions set (e.g., from loaded config)
        const hasExistingProportions = Object.keys(columnWidths).length === headers.length &&
            Object.values(columnWidths).every(p => p > 0);

        if (!hasExistingProportions) {
            // Initialize with equal proportions
            const newProportions: Record<number, number> = {};
            const equalProportion = 1 / headers.length;
            for (let i = 0; i < headers.length; i++) {
                newProportions[i] = equalProportion;
            }
            setColumnWidths(newProportions);
        }

        // No resize listeners needed! Proportions stay constant, pixels recalculate on render
    }, [autoFitColumns, headers.length, columnWidths, setColumnWidths]);

    // ===== SUMMARY ROW SCROLL SYNC =====

    // Sync summary row horizontal scroll with main grid scroll
    useEffect(() => {
        const handleScroll = () => {
            if (parentRef.current) {
                setSummaryRowScrollLeft(parentRef.current.scrollLeft);
            }
        };

        const container = parentRef.current;
        if (container) {
            container.addEventListener("scroll", handleScroll);
            return () => container.removeEventListener("scroll", handleScroll);
        }
    }, []);

    // Apply scroll position to summary row content
    useEffect(() => {
        if (summaryRowContentRef.current) {
            summaryRowContentRef.current.scrollLeft = summaryRowScrollLeft;
        }
    }, [summaryRowScrollLeft]);

    // ===== GLOBAL EVENT HANDLERS =====

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
    }, []);

    // Handle clicking outside editing cell to save
    useEffect(() => {
        const handleMouseDown = (e: MouseEvent) => {
            if (editingCell && editingSource === "cell" && editingCellRef.current) {
                const target = e.target as Node;
                const isClickInsideEditingCell = editingCellRef.current.contains(target);

                if (!isClickInsideEditingCell) {
                    const value = editingValue;
                    updateCell(editingCell.row, editingCell.col, value);
                    clearEditingCell();
                }
            }
        };

        document.addEventListener("mousedown", handleMouseDown);
        return () => document.removeEventListener("mousedown", handleMouseDown);
    }, [editingCell, editingSource, editingValue, updateCell, clearEditingCell]);

    // ===== KEYBOARD SHORTCUTS =====
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if event came from an input or textarea element
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
                return;
            }

            // Ignore if editing cell from Print view
            if (editingCell && editingSource === "print") {
                return;
            }

            // Ignore if the grid doesn't have focus
            if (gridFocusRef.current && document.activeElement !== gridFocusRef.current) {
                const hasFocus = gridFocusRef.current.contains(document.activeElement);
                if (!hasFocus && document.activeElement !== document.body) {
                    return;
                }
            }

            // Ignore if editing cell
            if (editingCell) {
                return;
            }

            // Arrow key navigation
            if (selectedCell && !e.ctrlKey && !e.altKey) {
                let newRow = selectedCell.row;
                let newCol = selectedCell.col;
                let isArrowKey = false;

                if (e.key === "ArrowUp") {
                    newRow = Math.max(0, selectedCell.row - 1);
                    e.preventDefault();
                    isArrowKey = true;
                } else if (e.key === "ArrowDown") {
                    newRow = Math.min(filteredData.length - 1, selectedCell.row + 1);
                    e.preventDefault();
                    isArrowKey = true;
                } else if (e.key === "ArrowLeft") {
                    newCol = Math.max(0, selectedCell.col - 1);
                    e.preventDefault();
                    isArrowKey = true;
                } else if (e.key === "ArrowRight") {
                    newCol = Math.min(headers.length - 1, selectedCell.col + 1);
                    e.preventDefault();
                    isArrowKey = true;
                }

                if (isArrowKey && (newRow !== selectedCell.row || newCol !== selectedCell.col)) {
                    if (e.shiftKey) {
                        // Shift+arrow: extend selection range
                        if (selectedRange) {
                            setSelectedRange(selectedRange.startRow, selectedRange.startCol, newRow, newCol);
                        } else {
                            setSelectedRange(selectedCell.row, selectedCell.col, newRow, newCol);
                        }
                    } else {
                        // Normal arrow: move selection and scroll to cell
                        setSelectedCell(newRow, newCol);
                        rowVirtualizer.scrollToIndex(newRow, { align: "center" });
                    }
                }
            }

            // F2 or Enter to edit
            if ((e.key === "F2" || e.key === "Enter") && !e.ctrlKey) {
                if (selectedCell && !selectedRange) {
                    const value = filteredData[selectedCell.row]?.[selectedCell.col] || "";
                    handleStartEdit(selectedCell.row, selectedCell.col, value);
                    e.preventDefault();
                }
            }

            // Delete or Backspace to clear cells
            if ((e.key === "Delete" || e.key === "Backspace") && (selectedCell || selectedRange)) {
                clearCells();
                setCutCells(null); // Cancel any cut operation
                e.preventDefault();
            }

            // Escape to clear selection and cancel cut operation
            if (e.key === "Escape") {
                clearSelection();
                setCutCells(null);
            }

            // Ctrl+C to copy to both internal and system clipboard
            if (e.ctrlKey && e.key === "c") {
                handleCopyToClipboard();
                e.preventDefault();
            }

            // Ctrl+X to cut to clipboard and clear cells
            if (e.ctrlKey && e.key === "x") {
                handleCutToClipboard();
                e.preventDefault();
            }

            // Ctrl+V to paste from system clipboard
            if (e.ctrlKey && e.key === "v") {
                handlePasteFromSystemClipboard();
                e.preventDefault();
            }

            // Type to overwrite: if a printable character is typed, clear cell and start editing
            if (selectedCell && !selectedRange) {
                const isPrintableChar = e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey;

                if (isPrintableChar) {
                    handleStartEdit(selectedCell.row, selectedCell.col, e.key);
                    e.preventDefault();
                }
            }
        };

        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
        // Disabled: Missing handleStartEdit dependency
        // Reason: handleStartEdit is a stable function defined in component scope. Adding it would cause
        //         the effect to re-run on every render, constantly detaching/reattaching event listeners.
        // Alternative: Wrap handleStartEdit in useCallback to memoize it, then add to dependencies.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        editingCell,
        editingSource,
        selectedCell,
        selectedRange,
        filteredData,
        headers,
        clearSelection,
        setSelectedCell,
        setSelectedRange,
        rowVirtualizer,
    ]);

    // Scroll to row when editing from Print view
    useEffect(() => {
        if (editingCell && editingSource === "print" && cellFollowsPrintEdit) {
            rowVirtualizer.scrollToIndex(editingCell.row, { align: "center" });
        }
    }, [editingCell, editingSource, cellFollowsPrintEdit, rowVirtualizer]);

    // Position cursor at end when editing starts
    useEffect(() => {
        if (editingCell && editingInputRef.current) {
            const length = editingInputRef.current.value.length;
            editingInputRef.current.setSelectionRange(length, length);
        } else if (!editingCell) {
            editingInputRef.current = null;
        }
    }, [editingCell]);

    // Auto-focus grid when data loads
    useEffect(() => {
        if (filteredData.length > 0 && gridFocusRef.current) {
            gridFocusRef.current.focus();
        }
    }, [filteredData.length]);

    // Cleanup RAF on unmount or when selection ends
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

    // ===== CELL EDITING HANDLERS =====

    const handleStartEdit = (row: number, col: number, value: string) => {
        setIsSelecting(false);
        setSelectionStart(null);
        setEditingCell(row, col, value);
    };

    const handleSaveEdit = (row: number, col: number) => {
        if (editingCell) {
            updateCell(row, col, editingValue);
            if (onCellEdit) {
                onCellEdit(row, col, editingValue);
            }
        }
        clearEditingCell();

        // Restore focus to grid
        if (gridFocusRef.current) {
            gridFocusRef.current.focus();
        }
    };

    const handleKeyDown = (
        e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
        row: number,
        col: number
    ) => {
        const isTextarea = e.currentTarget instanceof HTMLTextAreaElement;

        if (e.key === "Enter") {
            if (isTextarea && e.ctrlKey) {
                // Allow Ctrl+Enter to create newlines in textarea
                return;
            }

            e.preventDefault();
            e.stopPropagation();
            handleSaveEdit(row, col);

            // Move selection to next row if not Shift
            if (!e.shiftKey && row < filteredData.length - 1) {
                setTimeout(() => {
                    setSelectedCell(row + 1, col);
                    rowVirtualizer.scrollToIndex(row + 1, { align: "center" });
                }, 0);
            } else if (e.shiftKey && row > 0) {
                setTimeout(() => {
                    setSelectedCell(row - 1, col);
                    rowVirtualizer.scrollToIndex(row - 1, { align: "center" });
                }, 0);
            }
        } else if (e.key === "Tab") {
            e.preventDefault();
            e.stopPropagation();
            handleSaveEdit(row, col);

            if (!e.shiftKey) {
                if (col < headers.length - 1) {
                    setTimeout(() => setSelectedCell(row, col + 1), 0);
                } else if (row < filteredData.length - 1) {
                    setTimeout(() => {
                        setSelectedCell(row + 1, 0);
                        rowVirtualizer.scrollToIndex(row + 1, { align: "center" });
                    }, 0);
                }
            } else {
                if (col > 0) {
                    setTimeout(() => setSelectedCell(row, col - 1), 0);
                } else if (row > 0) {
                    setTimeout(() => {
                        setSelectedCell(row - 1, headers.length - 1);
                        rowVirtualizer.scrollToIndex(row - 1, { align: "center" });
                    }, 0);
                }
            }
        } else if (e.key === "Escape") {
            e.stopPropagation();
            clearEditingCell();
            if (gridFocusRef.current) {
                gridFocusRef.current.focus();
            }
        }
    };

    // ===== CLIPBOARD OPERATIONS =====

    // Copy selection to both internal and system clipboard
    const handleCopyToClipboard = async () => {
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
        } catch (err) {
            console.error("Failed to copy to system clipboard:", err);
        }
    };

    // Cut selection to clipboard and mark cells for later clearing
    const handleCutToClipboard = async () => {
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
    };

    // Paste from system clipboard
    const handlePasteFromSystemClipboard = async () => {
        try {
            // Read text from system clipboard using Tauri's clipboard API
            const text = await readText();

            if (!text || !selectedCell) {
                return;
            }

            // Parse clipboard text - treat tabs as column separators, newlines as row separators
            const rows = text.split("\n").map((row) => row.split("\t"));

            // Remove trailing empty row if the clipboard text ended with a newline
            if (rows.length > 0 && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0] === "") {
                rows.pop();
            }

            // Build array of cell updates
            const { row: startRow, col: startCol } = selectedCell;
            const cellUpdates: Array<{ row: number; col: number; value: string }> = [];

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
        } catch (err) {
            console.error("Failed to paste from system clipboard:", err);
        }
    };

    // ===== CONTEXT MENU HANDLERS =====

    const handleCellContextMenu = (e: React.MouseEvent, row: number, col: number) => {
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
    };

    const handleContextMenuAction = (action: string) => {
        setContextMenu(null);

        switch (action) {
            case "copy":
                handleCopyToClipboard();
                break;
            case "cut":
                handleCutToClipboard();
                break;
            case "paste":
                handlePasteFromSystemClipboard();
                break;
            case "clear":
                clearCells();
                setCutCells(null);
                break;
            case "fill":
                if (selectedRange) {
                    setShowFillDialog(true);
                }
                break;
            case "edit":
                if (selectedCell) {
                    const value = filteredData[selectedCell.row]?.[selectedCell.col] || "";
                    handleStartEdit(selectedCell.row, selectedCell.col, value);
                }
                break;
        }
    };

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

    // ===== COLUMN RESIZE HANDLERS =====

    const handleColumnResizeStart = (e: React.MouseEvent, colIndex: number) => {
        e.preventDefault();
        e.stopPropagation();

        // Convert current proportion to pixel width for resize tracking
        const currentWidth = getPixelWidth(colIndex);
        setResizingColumn(colIndex);
        setResizeStartX(e.clientX);
        setResizeStartWidth(currentWidth);
        setIsShiftResize(e.shiftKey);

        // For zero-sum resizing, capture starting pixel widths (converted from proportions)
        if (autoFitColumns) {
            if (e.shiftKey) {
                // Distributed resize: capture all column pixel widths
                const allWidths: Record<number, number> = {};
                for (let i = 0; i < headers.length; i++) {
                    allWidths[i] = getPixelWidth(i);
                }
                setResizeAllStartWidths(allWidths);
            } else if (colIndex + 1 < headers.length) {
                // Normal zero-sum: capture next column's starting pixel width
                const nextWidth = getPixelWidth(colIndex + 1);
                setResizeNextStartWidth(nextWidth);
            }
        }
    };

    // Handle mouse move during resize
    useEffect(() => {
        if (resizingColumn === null) return;

        // Prevent text selection while resizing
        document.body.style.userSelect = "none";
        document.body.style.cursor = "col-resize";

        const handleMouseMove = (e: MouseEvent) => {
            const deltaX = e.clientX - resizeStartX;

            if (autoFitColumns) {
                if (isShiftResize) {
                    // Distributed resize: distribute delta across all other columns
                    const otherColumnCount = headers.length - 1;

                    if (otherColumnCount > 0) {
                        const deltaPerColumn = -deltaX / otherColumnCount;
                        const minWidth = 100;

                        // Calculate new pixel widths for all columns
                        const newPixelWidths: Record<number, number> = {};
                        let totalAdjustment = 0;

                        // First pass: calculate new widths and track violations
                        for (let i = 0; i < headers.length; i++) {
                            if (i === resizingColumn) {
                                newPixelWidths[i] = resizeStartWidth + deltaX;
                            } else {
                                const startWidth = resizeAllStartWidths[i];
                                newPixelWidths[i] = startWidth + deltaPerColumn;
                            }

                            // Enforce minimum width
                            if (newPixelWidths[i] < minWidth) {
                                totalAdjustment += minWidth - newPixelWidths[i];
                                newPixelWidths[i] = minWidth;
                            }
                        }

                        // Second pass: distribute the adjustment if needed
                        if (totalAdjustment > 0) {
                            newPixelWidths[resizingColumn] = Math.max(minWidth, newPixelWidths[resizingColumn] - totalAdjustment);
                        }

                        // Convert pixel widths to proportions
                        const newProportions = convertPixelsToProportions(newPixelWidths);
                        setColumnWidths(newProportions);
                    } else {
                        // Only one column - just resize normally
                        const newWidth = Math.max(100, resizeStartWidth + deltaX);
                        const currentPixelWidths: Record<number, number> = {};
                        headers.forEach((_, i) => {
                            currentPixelWidths[i] = i === resizingColumn ? newWidth : getPixelWidth(i);
                        });
                        setColumnWidths(convertPixelsToProportions(currentPixelWidths));
                    }
                } else {
                    // Zero-sum resizing: making one column larger makes the next one smaller
                    const nextColumnIndex = resizingColumn + 1;

                    if (nextColumnIndex < headers.length) {
                        // Calculate new pixel widths
                        let newCurrentWidth = resizeStartWidth + deltaX;
                        let newNextWidth = resizeNextStartWidth - deltaX;

                        // Enforce minimum widths
                        const minWidth = 100;
                        if (newCurrentWidth < minWidth) {
                            const diff = minWidth - newCurrentWidth;
                            newCurrentWidth = minWidth;
                            newNextWidth -= diff;
                        }
                        if (newNextWidth < minWidth) {
                            const diff = minWidth - newNextWidth;
                            newNextWidth = minWidth;
                            newCurrentWidth -= diff;
                        }

                        // Build full pixel widths object
                        const currentPixelWidths: Record<number, number> = {};
                        headers.forEach((_, i) => {
                            if (i === resizingColumn) {
                                currentPixelWidths[i] = newCurrentWidth;
                            } else if (i === nextColumnIndex) {
                                currentPixelWidths[i] = newNextWidth;
                            } else {
                                currentPixelWidths[i] = getPixelWidth(i);
                            }
                        });
                        setColumnWidths(convertPixelsToProportions(currentPixelWidths));
                    } else {
                        // Last column - just resize normally
                        const newWidth = Math.max(100, resizeStartWidth + deltaX);
                        const currentPixelWidths: Record<number, number> = {};
                        headers.forEach((_, i) => {
                            currentPixelWidths[i] = i === resizingColumn ? newWidth : getPixelWidth(i);
                        });
                        setColumnWidths(convertPixelsToProportions(currentPixelWidths));
                    }
                }
            } else {
                // Normal resizing (non-zero-sum)
                const newWidth = Math.max(100, resizeStartWidth + deltaX);
                const currentPixelWidths: Record<number, number> = {};
                headers.forEach((_, i) => {
                    currentPixelWidths[i] = i === resizingColumn ? newWidth : getPixelWidth(i);
                });
                setColumnWidths(convertPixelsToProportions(currentPixelWidths));
            }
        };

        const handleMouseUp = () => {
            setResizingColumn(null);
            document.body.style.userSelect = "";
            document.body.style.cursor = "";
        };

        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);

        return () => {
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
            document.body.style.userSelect = "";
            document.body.style.cursor = "";
        };
        // Disabled: Missing getPixelWidth, convertPixelsToProportions dependencies
        // Reason: These are stable helper functions defined in component scope. Adding them would cause the resize effect to re-run unnecessarily, creating performance issues
        // Alternative: Move these functions outside component scope or wrap in useCallback
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [resizingColumn, resizeStartX, resizeStartWidth, resizeNextStartWidth, resizeAllStartWidths, isShiftResize, autoFitColumns, headers.length, headers, columnWidths, setColumnWidths]);

    // Disable text selection during drag operations
    useEffect(() => {
        if (!isDraggingRow && !isDraggingColumn) return;

        // Prevent text selection while dragging
        document.body.style.userSelect = "none";
        document.body.style.cursor = "grabbing";

        return () => {
            document.body.style.userSelect = "";
            document.body.style.cursor = "";
        };
    }, [isDraggingRow, isDraggingColumn]);

    // ===== ROW DRAG-AND-DROP HANDLERS =====

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

    // ===== COLUMN DRAG-AND-DROP HANDLERS =====

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

    // ===== CELL SELECTION HANDLERS =====

    const handleCellMouseDown = (e: React.MouseEvent, row: number, col: number) => {
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

        // Shift-click: extend selection
        if (e.shiftKey && selectedCell) {
            e.preventDefault();
            setSelectedRange(selectedCell.row, selectedCell.col, row, col);
            return;
        }

        // Normal click: start new selection
        setIsSelecting(true);
        setSelectionStart({ row, col });
        setSelectedCell(row, col);
    };

    const handleCellMouseEnter = (row: number, col: number) => {
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
    };

    const handleCellMouseLeave = () => {
        setHoveredColumn(null);
    };

    // ===== RENDER =====

    if (headers.length === 0) {
        return (
            <div className="flex items-center justify-center h-full text-base-content/50">
                <p>No data to display</p>
            </div>
        );
    }

    const virtualRows = rowVirtualizer.getVirtualItems();
    const totalSize = rowVirtualizer.getTotalSize();

    // Get corrected pixel widths that sum exactly to available width
    const pixelWidths = getAllPixelWidths();

    const isEditingCell = editingCell && editingSource === "cell";
    const summaryRowHeight = 60;
    const containerStyle: React.CSSProperties = {
        width: "100%",
        height: `calc(100% - ${summaryRowHeight}px)`,
        paddingBottom: "20px",
        userSelect: !isEditingCell && isSelecting ? "none" : "auto",
        WebkitUserSelect: !isEditingCell && isSelecting ? "none" : "auto",
        position: "relative",
    };

    return (
        <div
            className={`cell-grid-container relative outline-none ${autoFitColumns ? "overflow-y-scroll overflow-x-hidden" : "overflow-scroll"}`}
            ref={(el) => {
                if (parentRef.current !== el) {
                    (parentRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
                }
                if (gridFocusRef.current !== el) {
                    (gridFocusRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
                }
            }}
            tabIndex={0}
            style={containerStyle}
            onClick={(e) => {
                // Don't interfere with draggable elements
                const target = e.target as HTMLElement;
                const draggableElement = target.closest('[draggable="true"]');
                if (draggableElement) {
                    return; // Let the drag operation handle it
                }

                // Don't steal focus if clicking inside the editing cell
                if (editingCellRef.current && editingCellRef.current.contains(target)) {
                    return;
                }

                // Keep focus on grid when clicking anywhere inside it
                if (gridFocusRef.current) {
                    gridFocusRef.current.focus();
                }
            }}
            onMouseDown={(e) => {
                const target = e.target as HTMLElement;

                // Don't interfere with draggable elements
                const draggableElement = target.closest('[draggable="true"]');
                if (draggableElement) {
                    return; // Let the drag operation handle it
                }

                // Don't interfere with text selection inside editing cell
                const isClickInsideEditor = target instanceof HTMLInputElement ||
                    target instanceof HTMLTextAreaElement ||
                    target.closest("input[type='text']") !== null ||
                    target.closest("textarea") !== null;

                if (isClickInsideEditor) {
                    // Allow normal text selection behavior inside the editor
                    return;
                }

                if (gridFocusRef.current) {
                    gridFocusRef.current.focus();
                }
            }}
        >
            <style>{`
                .cell-grid-container {
                    scrollbar-width: thin;
                    scrollbar-gutter: stable both-edges;
                    -webkit-overflow-scrolling: touch;
                }

                .cell-grid-container::-webkit-scrollbar {
                    -webkit-appearance: none;
                    width: 14px;
                    height: 14px;
                }

                .cell-grid-container::-webkit-scrollbar-track {
                    background: oklch(var(--b2));
                    border: 1px solid oklch(var(--bc) / 0.1);
                }

                .cell-grid-container::-webkit-scrollbar-thumb {
                    background: oklch(var(--bc) / 0.4);
                    border-radius: 7px;
                    border: 2px solid oklch(var(--b2));
                    min-height: 30px;
                    min-width: 30px;
                }

                .cell-grid-container::-webkit-scrollbar-thumb:hover {
                    background: oklch(var(--bc) / 0.6);
                }

                .cell-grid-container::-webkit-scrollbar-thumb:active {
                    background: oklch(var(--bc) / 0.7);
                }

                .editing-cell,
                .editing-cell *,
                .editing-cell input,
                .editing-cell textarea {
                    user-select: text !important;
                    -webkit-user-select: text !important;
                }
            `}</style>

            {/* Header (sticky) */}
            <div className="sticky top-0 z-10 bg-base-300 border-b-2 border-base-300">
                <div className="flex">
                    {/* Row number column header */}
                    <div
                        className={`p-2 text-center font-bold border-r bg-base-300 ${showColumnSeparators ? "border-base-300" : "border-base-content/10"}`}
                        style={{ width: "64px", minWidth: "64px", maxWidth: "64px" }}
                    >
                        #
                    </div>

                    {/* Data column headers */}
                    {headers.map((header, colIndex) => {
                        const columnWidth = pixelWidths[colIndex];
                        const headerClass = `bg-base-300 font-bold p-2 border-r relative ${showColumnSeparators ? "border-base-300" : "border-base-content/10"} ${
                            hoveredColumn === colIndex ? "bg-base-200/70" : ""
                        } ${dropTargetColumn === colIndex ? "border-l-4 border-primary" : ""}`;
                        return (
                            <div
                                key={colIndex}
                                className={headerClass}
                                style={{
                                    width: `${columnWidth}px`,
                                    minWidth: `${columnWidth}px`,
                                    maxWidth: `${columnWidth}px`,
                                }}
                                onDragOver={(e) => handleColumnDragOver(e, colIndex)}
                                onDrop={(e) => handleColumnDrop(e, colIndex)}
                            >
                                {/* Header content with drag handle and filter */}
                                <div className="flex items-center gap-2 justify-between">
                                    {/* Drag handle */}
                                    <div
                                        draggable={true}
                                        onMouseDown={(e) => {
                                            // Only allow left-click to initiate drag
                                            if (e.button !== 0) {
                                                e.preventDefault();
                                                return;
                                            }
                                            e.stopPropagation();
                                            // Don't preventDefault - it blocks drag start
                                        }}
                                        onDragStart={(e) => handleColumnDragStart(e, colIndex)}
                                        onDragEnd={handleColumnDragEnd}
                                        className="cursor-move text-base-content/30 hover:text-base-content relative z-10"
                                        style={{ userSelect: "none", WebkitUserSelect: "none" }}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ pointerEvents: "none" }}>
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                                        </svg>
                                    </div>

                                    {/* Header text */}
                                    <span className="flex-1 truncate">{header}</span>

                                    {/* Filter dropdown */}
                                    <ColumnFilterDropdown
                                        columnName={header}
                                        operation={columnFilters.find((f) => f.column === header)?.operation || "contains"}
                                        value={columnFilters.find((f) => f.column === header)?.value || ""}
                                        onFilterChange={(operation, value) => setColumnFilter(header, operation, value)}
                                        onClearFilter={() => clearColumnFilter(header)}
                                        columnData={data.map((row) => row[colIndex] || "")}
                                    />
                                </div>

                                {/* Resize handle */}
                                <div
                                    className={`absolute top-0 right-0 bottom-0 w-2 cursor-col-resize select-none z-20 ${resizingColumn === colIndex ? "bg-primary/50" : "hover:bg-primary/30"}`}
                                    style={{ marginRight: "-4px", paddingLeft: "3px", paddingRight: "3px" }}
                                    onMouseDown={(e) => {
                                        e.stopPropagation();
                                        handleColumnResizeStart(e, colIndex);
                                    }}
                                    onDragStart={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                    }}
                                >
                                    <div className={`w-px h-full transition-colors ${resizingColumn === colIndex ? "bg-primary" : "bg-base-content/20 hover:bg-primary/70"}`} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Virtualized rows */}
            <div
                style={{
                    height: `${totalSize}px`,
                    width: "100%",
                    position: "relative",
                }}
            >
                {virtualRows.map((virtualRow) => {
                    const rowIndex = virtualRow.index;
                    const row = filteredData[rowIndex];

                    // Determine row background color
                    const rowStyle: React.CSSProperties = {};
                    let rowBgClass = "";

                    if (rowColoringMode === "by-field" && rowMatchesFilter(row)) {
                        rowStyle.backgroundColor = rowColorFilter?.color;
                    } else if (rowColoringMode === "alternating" && rowIndex % 2 === 1) {
                        rowBgClass = "bg-base-200/50";
                    }

                    const rowHoverClass =
                        hoverHighlightMode === "row" || hoverHighlightMode === "row-and-column"
                            ? "hover:bg-base-200/70"
                            : "";

                    return (
                        <div
                            key={virtualRow.key}
                            data-index={virtualRow.index}
                            ref={rowVirtualizer.measureElement}
                            style={{
                                position: "absolute",
                                top: 0,
                                left: 0,
                                width: "100%",
                                transform: `translateY(${virtualRow.start}px)`,
                                ...rowStyle,
                            }}
                            className={`flex ${rowHoverClass} ${rowBgClass} ${dropTargetRow === rowIndex ? "border-t-4 border-primary" : ""}`}
                            onDragOver={(e) => handleRowDragOver(e, rowIndex)}
                            onDrop={(e) => handleRowDrop(e, rowIndex)}
                        >
                            {/* Row number */}
                            <div
                                className={`p-2 text-center font-mono text-sm bg-base-200/50 border-b border-r cursor-move ${showColumnSeparators ? "border-base-300" : "border-base-content/10"}`}
                                style={{
                                    width: "64px",
                                    minWidth: "64px",
                                    maxWidth: "64px",
                                    userSelect: "none",
                                    WebkitUserSelect: "none",
                                }}
                                draggable={true}
                                onMouseDown={(e) => {
                                    // Only allow left-click to initiate drag
                                    if (e.button !== 0) {
                                        e.preventDefault();
                                        return;
                                    }
                                    e.stopPropagation();
                                    // Don't preventDefault - it blocks drag start
                                }}
                                onDragStart={(e) => handleRowDragStart(e, rowIndex)}
                                onDragEnd={handleRowDragEnd}
                            >
                                <div className="flex items-center justify-center gap-1" style={{ pointerEvents: "none" }}>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-base-content/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                    </svg>
                                    {rowIndex + 1}
                                </div>
                            </div>

                            {/* Data cells */}
                            {headers.map((_, colIndex) => {
                                const value = row[colIndex] || "";
                                const isEditing = editingCell?.row === rowIndex && editingCell?.col === colIndex;

                                // Check if this cell is selected
                                const isSingleSelected =
                                    selectedCell?.row === rowIndex &&
                                    selectedCell?.col === colIndex &&
                                    !selectedRange;
                                const isInRange =
                                    selectedRange &&
                                    rowIndex >= Math.min(selectedRange.startRow, selectedRange.endRow) &&
                                    rowIndex <= Math.max(selectedRange.startRow, selectedRange.endRow) &&
                                    colIndex >= Math.min(selectedRange.startCol, selectedRange.endCol) &&
                                    colIndex <= Math.max(selectedRange.startCol, selectedRange.endCol);

                                // Check if this cell is a search match
                                const isMatch = matches.some((match) => match.row === rowIndex && match.col === colIndex);
                                const isCurrentMatch =
                                    currentMatchIndex >= 0 &&
                                    matches[currentMatchIndex]?.row === rowIndex &&
                                    matches[currentMatchIndex]?.col === colIndex;

                                // Check if this cell is cut
                                const isCut = cutCells?.some(
                                    (cutCell) => cutCell.row === rowIndex && cutCell.col === colIndex
                                );

                                // Determine cell class with grid borders
                                let cellClass = `p-0 border-b border-r ${showColumnSeparators ? "border-base-300" : "border-base-content/10"}`;

                                if (hoveredColumn === colIndex) {
                                    cellClass += " bg-base-200/70";
                                }

                                if (isSingleSelected) {
                                    cellClass += " ring-2 ring-primary ring-inset";
                                } else if (isInRange) {
                                    cellClass += " bg-primary/20";
                                }

                                if (isCurrentMatch) {
                                    cellClass += " bg-warning/60";
                                } else if (isMatch) {
                                    cellClass += " bg-warning/20";
                                }

                                // Add class for cut cells (dotted outline will be added via inline style)
                                if (isCut) {
                                    cellClass += " cut-cell";
                                }

                                const columnWidth = pixelWidths[colIndex];
                                const cellHasNewlines = value.includes("\n");
                                const shouldUseTextarea = wrapText || cellHasNewlines;

                                return (
                                    <div
                                        key={colIndex}
                                        className={`${cellClass} relative ${isEditing && editingSource === "cell" ? "editing-cell" : ""}`}
                                        style={{
                                            width: `${columnWidth}px`,
                                            minWidth: `${columnWidth}px`,
                                            maxWidth: `${columnWidth}px`,
                                            ...(isEditing && editingSource === "cell"
                                                ? { userSelect: "text", WebkitUserSelect: "text" }
                                                : {}),
                                            ...(isCut
                                                ? {
                                                      outline: "2px dashed oklch(var(--p))",
                                                      outlineOffset: "-2px",
                                                      opacity: 0.7,
                                                  }
                                                : {}),
                                        }}
                                        data-row={rowIndex}
                                        data-col={colIndex}
                                        ref={(el) => {
                                            if (isEditing && editingSource === "cell") {
                                                editingCellRef.current = el;
                                            } else if (editingCellRef.current === el) {
                                                editingCellRef.current = null;
                                            }
                                        }}
                                        onMouseDown={(e) => handleCellMouseDown(e, rowIndex, colIndex)}
                                        onMouseEnter={() => handleCellMouseEnter(rowIndex, colIndex)}
                                        onMouseLeave={handleCellMouseLeave}
                                        onDoubleClick={() => {
                                            const value = row[colIndex] || "";
                                            handleStartEdit(rowIndex, colIndex, value);
                                        }}
                                        onContextMenu={(e) => handleCellContextMenu(e, rowIndex, colIndex)}
                                    >
                                        {/* "Editing from Print" overlay indicator */}
                                        {isEditing && editingSource === "print" && (
                                            <div className="absolute -top-5 left-0 text-xs text-primary/70 italic bg-base-100/90 px-2 py-0.5 rounded shadow-sm border border-primary/20 z-10 whitespace-nowrap">
                                                (editing from Print)
                                            </div>
                                        )}

                                        {isEditing && editingSource === "cell" ? (
                                            shouldUseTextarea ? (
                                                <textarea
                                                    ref={(el) => {
                                                        editingInputRef.current = el;
                                                    }}
                                                    className="w-full focus:outline-none border-none bg-transparent px-3 py-2 min-h-[40px] text-sm leading-tight resize-none overflow-hidden"
                                                    style={{ userSelect: "text", WebkitUserSelect: "text" }}
                                                    value={editingValue}
                                                    onChange={(e) => {
                                                        updateEditingValue(e.target.value);
                                                        e.target.style.height = "auto";
                                                        e.target.style.height = `${e.target.scrollHeight}px`;
                                                    }}
                                                    onClick={(e) => e.stopPropagation()}
                                                    onMouseDown={(e) => {
                                                        e.stopPropagation();
                                                        e.nativeEvent.stopImmediatePropagation();
                                                    }}
                                                    onKeyDown={(e) => handleKeyDown(e, rowIndex, colIndex)}
                                                    onInput={(e) => {
                                                        const target = e.target as HTMLTextAreaElement;
                                                        target.style.height = "auto";
                                                        target.style.height = `${target.scrollHeight}px`;
                                                    }}
                                                    autoFocus
                                                />
                                            ) : (
                                                <input
                                                    ref={(el) => {
                                                        editingInputRef.current = el;
                                                    }}
                                                    type="text"
                                                    className="w-full focus:outline-none border-none bg-transparent px-3 py-2 min-h-[40px] text-sm leading-tight"
                                                    style={{ userSelect: "text", WebkitUserSelect: "text" }}
                                                    value={editingValue}
                                                    onChange={(e) => updateEditingValue(e.target.value)}
                                                    onClick={(e) => e.stopPropagation()}
                                                    onMouseDown={(e) => {
                                                        e.stopPropagation();
                                                        e.nativeEvent.stopImmediatePropagation();
                                                    }}
                                                    onKeyDown={(e) => handleKeyDown(e, rowIndex, colIndex)}
                                                    autoFocus
                                                />
                                            )
                                        ) : (
                                            <div
                                                className={`px-3 py-2 min-h-[40px] text-sm leading-tight flex items-center ${wrapText ? "whitespace-normal" : "whitespace-nowrap overflow-hidden text-ellipsis"} ${isEditing && editingSource === "print" ? "bg-primary/10" : ""}`}
                                            >
                                                {isEditing && editingSource === "print" ? editingValue : value}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    );
                })}
            </div>

            {/* Empty state when no rows */}
            {filteredData.length === 0 && (
                <div className="text-center py-8 text-base-content/50">
                    <p>No rows match the current filters</p>
                </div>
            )}

            {/* Context Menu */}
            {contextMenu && (() => {
                const isMultiCell = selectedRange !== null;

                return (
                    <div
                        className="fixed z-50 bg-base-100 border border-base-300 rounded-lg shadow-lg py-1 min-w-[180px]"
                        style={{
                            left: `${contextMenu.x}px`,
                            top: `${contextMenu.y}px`,
                        }}
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                    >
                        {/* Single cell: Edit option */}
                        {!isMultiCell && (
                            <>
                                <button
                                    className="w-full px-4 py-2 text-left hover:bg-base-200 text-sm flex items-center gap-2"
                                    onClick={() => handleContextMenuAction("edit")}
                                >
                                    <span className="w-4">✏️</span>
                                    Edit Cell
                                </button>
                                <div className="border-t border-base-300 my-1"></div>
                            </>
                        )}

                        {/* Multi-cell: Fill option at top */}
                        {isMultiCell && (
                            <>
                                <button
                                    className="w-full px-4 py-2 text-left hover:bg-base-200 text-sm flex items-center gap-2"
                                    onClick={() => handleContextMenuAction("fill")}
                                >
                                    <span className="w-4">🔄</span>
                                    Fill Selected Cells...
                                </button>
                                <div className="border-t border-base-300 my-1"></div>
                            </>
                        )}

                        {/* Common: Clipboard operations */}
                        <button
                            className="w-full px-4 py-2 text-left hover:bg-base-200 text-sm flex items-center gap-2"
                            onClick={() => handleContextMenuAction("copy")}
                        >
                            <span className="w-4">📋</span>
                            Copy
                            <span className="ml-auto text-xs text-base-content/50">Ctrl+C</span>
                        </button>
                        <button
                            className="w-full px-4 py-2 text-left hover:bg-base-200 text-sm flex items-center gap-2"
                            onClick={() => handleContextMenuAction("cut")}
                        >
                            <span className="w-4">✂️</span>
                            Cut
                            <span className="ml-auto text-xs text-base-content/50">Ctrl+X</span>
                        </button>
                        <button
                            className="w-full px-4 py-2 text-left hover:bg-base-200 text-sm flex items-center gap-2"
                            onClick={() => handleContextMenuAction("paste")}
                        >
                            <span className="w-4">📄</span>
                            Paste
                            <span className="ml-auto text-xs text-base-content/50">Ctrl+V</span>
                        </button>

                        <div className="border-t border-base-300 my-1"></div>

                        {/* Common: Clear */}
                        <button
                            className="w-full px-4 py-2 text-left hover:bg-base-200 text-sm flex items-center gap-2"
                            onClick={() => handleContextMenuAction("clear")}
                        >
                            <span className="w-4">🗑️</span>
                            {isMultiCell ? "Clear Selected Cells" : "Clear"}
                            <span className="ml-auto text-xs text-base-content/50">Del</span>
                        </button>
                    </div>
                );
            })()}

            {/* Multi-Cell Fill Dialog */}
            {showFillDialog && selectedRange && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="bg-base-100 rounded-lg shadow-xl p-6 w-96">
                        <h3 className="text-lg font-bold mb-4">Fill Selected Cells</h3>
                        <p className="text-sm text-base-content/70 mb-4">
                            Enter a value to fill all selected cells:
                        </p>
                        <input
                            type="text"
                            className="input input-bordered w-full mb-4"
                            placeholder="Enter value..."
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    const value = (e.target as HTMLInputElement).value;
                                    const { startRow, startCol, endRow, endCol } = selectedRange;
                                    const minRow = Math.min(startRow, endRow);
                                    const maxRow = Math.max(startRow, endRow);
                                    const minCol = Math.min(startCol, endCol);
                                    const maxCol = Math.max(startCol, endCol);

                                    const cellUpdates: Array<{ row: number; col: number; value: string }> = [];
                                    for (let r = minRow; r <= maxRow; r++) {
                                        for (let c = minCol; c <= maxCol; c++) {
                                            cellUpdates.push({ row: r, col: c, value });
                                        }
                                    }
                                    updateCells(cellUpdates);
                                    triggerAutosave();
                                    setShowFillDialog(false);
                                } else if (e.key === "Escape") {
                                    setShowFillDialog(false);
                                }
                            }}
                        />
                        <div className="flex gap-2 justify-end">
                            <button
                                className="btn btn-ghost"
                                onClick={() => setShowFillDialog(false)}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={(e) => {
                                    const input = (e.target as HTMLElement)
                                        .closest(".bg-base-100")
                                        ?.querySelector("input") as HTMLInputElement;
                                    if (input) {
                                        const value = input.value;
                                        const { startRow, startCol, endRow, endCol } = selectedRange;
                                        const minRow = Math.min(startRow, endRow);
                                        const maxRow = Math.max(startRow, endRow);
                                        const minCol = Math.min(startCol, endCol);
                                        const maxCol = Math.max(startCol, endCol);

                                        const cellUpdates: Array<{ row: number; col: number; value: string }> = [];
                                        for (let r = minRow; r <= maxRow; r++) {
                                            for (let c = minCol; c <= maxCol; c++) {
                                                cellUpdates.push({ row: r, col: c, value });
                                            }
                                        }
                                        updateCells(cellUpdates);
                                        triggerAutosave();
                                    }
                                    setShowFillDialog(false);
                                }}
                            >
                                Fill
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Summary row */}
            <div
                className="fixed bg-base-300 border-t-2 border-base-300 shadow-lg z-40"
                style={{
                    left: 0,
                    right: drawerPosition === "right" ? `${rightDrawerSize}px` : 0,
                    bottom: 0,
                    height: "60px",
                    overflow: "hidden"
                }}
            >
                {/* Row number column placeholder (left) - sticky */}
                <div className="absolute left-0 h-full bg-base-300 border-r-2 border-base-300 z-10" style={{ width: "64px" }}></div>

                <div
                    ref={summaryRowContentRef}
                    className="h-full summary-row-scroll"
                    style={{
                        overflowX: autoFitColumns ? "hidden" : "scroll",
                        overflowY: "hidden",
                        scrollbarWidth: "none",
                        msOverflowStyle: "none",
                        paddingLeft: "64px",
                    }}
                >
                    <div className="flex items-center h-full" style={{ width: `${pixelWidths.reduce((sum, w) => sum + w, 0)}px` }}>
                        {/* Summary dropdowns for each column */}
                        {headers.map((columnName, colIndex) => {
                            const summaryType = columnSummaries[columnName] || "count";
                            const columnData = filteredData.map((row) => row[colIndex] || "");
                            const summaryValue = calculateSummary(columnData, summaryType);
                            const columnWidth = pixelWidths[colIndex];

                            // Apply hover highlight to summary row as well
                            const summaryClass = `flex-shrink-0 h-full flex items-center border-r-2 ${hoveredColumn === colIndex ? "bg-base-200/70" : ""} ${showColumnSeparators ? "border-base-300" : "border-transparent"}`;

                            return (
                                <div
                                    key={colIndex}
                                    className={summaryClass}
                                    style={{ width: `${columnWidth}px`, minWidth: `${columnWidth}px`, maxWidth: `${columnWidth}px` }}
                                >
                                    <div className="flex flex-col-reverse gap-1 p-2">
                                        {/* Summary value (displayed above dropdown) */}
                                        <div className="text-sm font-semibold text-primary truncate min-h-[20px]" title={summaryValue}>
                                            {summaryValue || "\u00A0"}
                                        </div>

                                        {/* Summary type selector (opens upward) */}
                                        <div className="relative">
                                            <select
                                                className="select select-xs select-bordered w-full bg-base-100"
                                                value={summaryType}
                                                onChange={(e) => setColumnSummary(columnName, e.target.value as "count" | "unique" | "mode" | "average" | "min" | "max" | "sum")}
                                                style={{
                                                    appearance: "none",
                                                    backgroundImage: 'url("data:image/svg+xml,%3csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 20 20\'%3e%3cpath stroke=\'%236b7280\' stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'1.5\' d=\'M6 8l4-4 4 4\'/%3e%3c/svg%3e")',
                                                    backgroundPosition: "right 0.5rem center",
                                                    backgroundRepeat: "no-repeat",
                                                    backgroundSize: "1.5em 1.5em",
                                                    paddingRight: "2.5rem"
                                                }}
                                            >
                                                <option value="count">Count</option>
                                                <option value="unique">Unique</option>
                                                <option value="mode">Mode</option>
                                                <option value="average">Average</option>
                                                <option value="min">Min</option>
                                                <option value="max">Max</option>
                                                <option value="sum">Sum</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Scrollbar styling - hide scrollbar for summary row */}
            <style>{`
                .summary-row-scroll::-webkit-scrollbar {
                    display: none;
                }
            `}</style>
        </div>
    );
}

export default CellGridVirtualized;
