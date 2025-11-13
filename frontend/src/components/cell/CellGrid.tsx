/**
 * Cell Grid Component
 *
 * Editable spreadsheet-like grid for viewing and editing Cell data.
 * Supports cell selection, multi-cell selection, copy/paste, drag-and-drop reordering,
 * filtering, summaries, and comprehensive keyboard shortcuts.
 */

import { useState, useMemo, useEffect, useRef } from "react";
import { useCellStore } from "@stores/cellStore";
import { useSettingsStore } from "@stores/settingsStore";
import { useFindReplaceStore } from "@stores/findReplaceStore";
import { useDrawerStore } from "@stores/drawerStore";
import ColumnFilterDropdown from "../toolbar/ColumnFilterDropdown";
import MultiCellEditDialog from "./MultiCellEditDialog";
import { calculateSummary } from "@utils/summaryCalculations";
import { debouncedSaveCurrentFileConfig } from "@utils/configPersistence";
import { writeText, readText } from "@tauri-apps/plugin-clipboard-manager";
import { useAutosave } from "@utils/useAutosave";

interface CellGridProps {
    onCellEdit?: (row: number, col: number, value: string) => void;
}

/**
 * CellGrid component - displays Cell Data in an editable table
 */
function CellGrid({ onCellEdit }: CellGridProps) {
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
        addRow,
        addColumn,
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

    const { position: drawerPosition, rightDrawerSize, bottomDrawerSize } = useDrawerStore();

    // Autosave hook
    const { triggerAutosave } = useAutosave();

    // Selection state for drag selection
    const [isSelecting, setIsSelecting] = useState(false);
    const [selectionStart, setSelectionStart] = useState<{ row: number; col: number } | null>(null);

    // Cut cells state - tracks cells that have been cut but not yet pasted
    const [cutCells, setCutCells] = useState<{ row: number; col: number }[] | null>(null);

    // Drag and drop state
    const [draggedRow, setDraggedRow] = useState<number | null>(null);
    const [draggedColumn, setDraggedColumn] = useState<number | null>(null);
    const [dropTargetRow, setDropTargetRow] = useState<number | null>(null);
    const [dropTargetColumn, setDropTargetColumn] = useState<number | null>(null);
    const [isDraggingRow, setIsDraggingRow] = useState(false);
    const [isDraggingColumn, setIsDraggingColumn] = useState(false);

    // Context menu state
    const [contextMenu, setContextMenu] = useState<{
        x: number;
        y: number;
        row?: number;
        col?: number;
    } | null>(null);

    // Multi-cell edit dialog state
    const [multiCellEditDialog, setMultiCellEditDialog] = useState<{
        position: { top: number; left: number; width: number; height: number };
    } | null>(null);

    // Hover state for column highlighting
    const [hoveredColumn, setHoveredColumn] = useState<number | null>(null);

    // Scroll indicators
    const [showLeftScrollIndicator, setShowLeftScrollIndicator] = useState(false);
    const [showRightScrollIndicator, setShowRightScrollIndicator] = useState(false);

    // Summary row positioning
    const [summaryRowLeftOffset, setSummaryRowLeftOffset] = useState(0);
    const [summaryRowScrollLeft, setSummaryRowScrollLeft] = useState(0);

    // Column resizing
    const [resizingColumn, setResizingColumn] = useState<number | null>(null);
    const [resizeStartX, setResizeStartX] = useState(0);
    const [resizeStartWidth, setResizeStartWidth] = useState(0);
    const [resizeNextStartWidth, setResizeNextStartWidth] = useState(0);
    const [resizeAllStartWidths, setResizeAllStartWidths] = useState<Record<number, number>>({});
    const [isShiftResize, setIsShiftResize] = useState(false);

    // Refs
    const tableContainerRef = useRef<HTMLDivElement>(null);
    const gridFocusRef = useRef<HTMLDivElement>(null);
    const summaryRowRef = useRef<HTMLDivElement>(null);
    const summaryRowContentRef = useRef<HTMLDivElement>(null);
    const rowRefs = useRef<Map<number, HTMLTableRowElement>>(new Map());
    const editingCellRef = useRef<HTMLTableCellElement | null>(null);
    const editingInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

    // Filter data based on column filters
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

    // Check if row matches color filter
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

    /**
     * Helper: Get available width for columns
     * Calculates container width minus row number column (64px)
     */
    const getAvailableWidth = (): number => {
        if (!tableContainerRef.current) return 800; // Default fallback
        const containerWidth = tableContainerRef.current.clientWidth;
        const rowNumberWidth = 64;
        return Math.max(containerWidth - rowNumberWidth, 200);
    };

    /**
     * Helper: Convert column proportion to pixel width
     * @param colIndex - Column index
     * @returns Pixel width for the column
     */
    const getPixelWidth = (colIndex: number): number => {
        const availableWidth = getAvailableWidth();
        const proportion = columnWidths[colIndex];

        // If no proportion saved, use equal distribution
        if (proportion === undefined || proportion === 0) {
            const equalProportion = 1 / headers.length;
            return Math.floor(equalProportion * availableWidth);
        }

        return Math.floor(proportion * availableWidth);
    };

    /**
     * Helper: Calculate total pixel width of all columns
     */
    const getTotalPixelWidth = (): number => {
        return headers.reduce((sum, _, idx) => sum + getPixelWidth(idx), 0);
    };

    /**
     * Helper: Convert pixel widths to proportions
     * @param pixelWidths - Object mapping column index to pixel width
     * @returns Object mapping column index to proportion (0-1)
     */
    const convertPixelsToProportions = (pixelWidths: Record<number, number>): Record<number, number> => {
        const totalWidth = Object.values(pixelWidths).reduce((sum, w) => sum + w, 0);
        if (totalWidth === 0) return {};

        const proportions: Record<number, number> = {};
        for (const [colIndex, pixelWidth] of Object.entries(pixelWidths)) {
            proportions[Number(colIndex)] = pixelWidth / totalWidth;
        }
        return proportions;
    };

    // Handle global mouseup for selection
    useEffect(() => {
        const handleMouseUp = (e: MouseEvent) => {
            // Don't clear selection state if mouseup is inside the editing cell
            // This prevents re-renders that could clear text selection
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

    // Handle global click to close context menu
    useEffect(() => {
        const handleClick = () => setContextMenu(null);
        if (contextMenu) {
            document.addEventListener("click", handleClick);
            return () => document.removeEventListener("click", handleClick);
        }
    }, [contextMenu]);

    // Handle clicking outside editing cell to save
    useEffect(() => {
        const handleMouseDown = (e: MouseEvent) => {
            if (editingCell && editingSource === "cell" && editingCellRef.current) {
                const target = e.target as Node;
                // Check if click is inside the editing cell element (including padding and input)
                const isClickInsideEditingCell = editingCellRef.current.contains(target);

                // Only save and close if clicking outside the editing cell
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

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if event came from an input or textarea element (cell being edited)
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
                return;
            }

            // Ignore if editing cell from Print view
            if (editingCell && editingSource === "print") {
                return;
            }

            // Ignore if the grid doesn't have focus (e.g., Print view is focused)
            if (gridFocusRef.current && document.activeElement !== gridFocusRef.current) {
                // Only handle if we're not focused, unless we have a selected cell and no other element has focus
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
                            // Extend existing range
                            setSelectedRange(selectedRange.startRow, selectedRange.startCol, newRow, newCol);
                        } else {
                            // Create new range from current cell to new cell
                            setSelectedRange(selectedCell.row, selectedCell.col, newRow, newCol);
                        }
                    } else {
                        // Normal arrow: move selection
                        setSelectedCell(newRow, newCol);
                    }
                }
            }

            // F2 or Enter to edit
            if ((e.key === "F2" || e.key === "Enter") && !e.ctrlKey) {
                if (selectedRange) {
                    // Open multi-cell edit dialog
                    handleOpenMultiCellEdit();
                    e.preventDefault();
                } else if (selectedCell) {
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

            // Ctrl+Enter to add row
            if (e.ctrlKey && e.key === "Enter") {
                if (selectedCell) {
                    addRow(selectedCell.row + 1);
                } else {
                    addRow();
                }
                e.preventDefault();
            }

            // Type to overwrite: if a printable character is typed, clear cell and start editing
            // This allows users to start typing to immediately replace cell contents
            if (selectedCell && !selectedRange) {
                // Check if this is a printable character (single character, no ctrl/alt modifiers)
                // Shift is allowed (for uppercase/symbols)
                const isPrintableChar = e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey;

                if (isPrintableChar) {
                    // Start editing with the typed character as the initial value
                    // This clears the previous cell content and begins editing with the new character
                    handleStartEdit(selectedCell.row, selectedCell.col, e.key);
                    e.preventDefault(); // Prevent the character from being typed twice
                }
            }
        };

        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Missing handleStartEdit, handleCopyToClipboard, handleCutToClipboard, and handlePasteFromSystemClipboard dependencies. These are stable functions defined in component scope. Adding them would cause the effect to re-run on every render, constantly detaching/reattaching event listeners. Alternative: Wrap in useCallback to memoize them, then add to dependencies.
    }, [editingCell, editingSource, selectedCell, selectedRange, filteredData, headers, copySelection, clearCells, clearSelection, setSelectedCell, addRow]);

    // Scroll to row when editing from Print view
    useEffect(() => {
        if (editingCell && editingSource === "print" && tableContainerRef.current && cellFollowsPrintEdit) {
            const row = rowRefs.current.get(editingCell.row);
            if (row) {
                // Scroll to the row smoothly and center it
                row.scrollIntoView({
                    behavior: "smooth",
                    block: "center",
                    inline: "nearest",
                });
            }
        }
    }, [editingCell, editingSource, cellFollowsPrintEdit]);

    // Position cursor at end when editing starts (for type-to-overwrite feature)
    useEffect(() => {
        if (editingCell && editingInputRef.current) {
            const length = editingInputRef.current.value.length;
            editingInputRef.current.setSelectionRange(length, length);
        } else if (!editingCell) {
            // Clear the ref when editing ends
            editingInputRef.current = null;
        }
    }, [editingCell]);

    // Auto-focus grid when data loads
    useEffect(() => {
        if (filteredData.length > 0 && gridFocusRef.current) {
            gridFocusRef.current.focus();
        }
    }, [filteredData.length]);

    // Scroll indicators and summary row sync
    useEffect(() => {
        const tableContainer = tableContainerRef.current;
        if (!tableContainer) return;

        const checkScrollIndicators = () => {
            const { scrollLeft, scrollWidth, clientWidth } = tableContainer;

            // Show left indicator if scrolled right (content hidden on left)
            setShowLeftScrollIndicator(scrollLeft > 0);

            // Show right indicator if there's more content to scroll to
            setShowRightScrollIndicator(scrollLeft + clientWidth < scrollWidth - 1);

            // Sync summary row horizontal scroll
            setSummaryRowScrollLeft(scrollLeft);
        };

        // Check on mount and scroll
        checkScrollIndicators();
        tableContainer.addEventListener("scroll", checkScrollIndicators);

        // Use ResizeObserver to detect table size changes
        const resizeObserver = new ResizeObserver(checkScrollIndicators);
        resizeObserver.observe(tableContainer);

        return () => {
            tableContainer.removeEventListener("scroll", checkScrollIndicators);
            resizeObserver.disconnect();
        };
    }, [headers, filteredData]);

    // Update summary row left offset to align with table
    useEffect(() => {
        const updateSummaryPosition = () => {
            if (tableContainerRef.current) {
                const rect = tableContainerRef.current.getBoundingClientRect();
                setSummaryRowLeftOffset(rect.left);
            }
        };

        // Update on mount and when window resizes
        updateSummaryPosition();
        window.addEventListener("resize", updateSummaryPosition);

        // Use ResizeObserver to detect sidebar width changes
        const resizeObserver = new ResizeObserver(updateSummaryPosition);
        if (tableContainerRef.current) {
            resizeObserver.observe(tableContainerRef.current);
        }

        return () => {
            window.removeEventListener("resize", updateSummaryPosition);
            resizeObserver.disconnect();
        };
    }, []);

    // Sync summary row horizontal scroll with table scroll
    useEffect(() => {
        if (summaryRowContentRef.current) {
            summaryRowContentRef.current.scrollLeft = summaryRowScrollLeft;
        }
    }, [summaryRowScrollLeft]);

    // Auto-fit columns effect - set initial equal proportions if needed
    useEffect(() => {
        if (!autoFitColumns || headers.length === 0) return;

        // Check if we already have column proportions set (e.g., from loaded config)
        const hasExistingProportions = Object.keys(columnWidths).length === headers.length &&
            Object.values(columnWidths).every(p => p > 0);

        // Only set initial proportions if we don't have existing ones
        // When drawer/window resizes, proportions stay the same - pixel widths recalculate automatically
        if (!hasExistingProportions) {
            // Set equal proportions for all columns
            const equalProportion = 1 / headers.length;
            const newProportions: Record<number, number> = {};
            for (let i = 0; i < headers.length; i++) {
                newProportions[i] = equalProportion;
            }
            setColumnWidths(newProportions);
        }

        // No resize listeners needed! Proportions stay constant, pixels recalculate on render
    }, [autoFitColumns, headers.length, columnWidths, setColumnWidths]);

    // Column resizing effect
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Missing getPixelWidth, convertPixelsToProportions dependencies. These are stable helper functions defined in component scope. Adding them would cause the resize effect to re-run unnecessarily, creating performance issues. Alternative: Move these functions outside component scope or wrap in useCallback.
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

    // Save config when column widths change
    useEffect(() => {
        // Only save if we have column widths set (not empty object)
        if (Object.keys(columnWidths).length > 0) {
            debouncedSaveCurrentFileConfig(1000);
        }
    }, [columnWidths]);

    // Column resize handlers
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

    // Start editing a cell
    const handleStartEdit = (row: number, col: number, value: string) => {
        // Clear selection state to prevent interference with text selection inside the editor
        setIsSelecting(false);
        setSelectionStart(null);
        setEditingCell(row, col, value);
    };

    // Save edited cell value
    const handleSaveEdit = (row: number, col: number) => {
        if (editingCell) {
            updateCell(row, col, editingValue);
            if (onCellEdit) {
                onCellEdit(row, col, editingValue);
            }
            // Trigger autosave after cell edit
            triggerAutosave();
        }
        clearEditingCell();

        // Restore focus to grid
        if (gridFocusRef.current) {
            gridFocusRef.current.focus();
        }
    };

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
            const rows = text.split("\n").map(row => row.split("\t"));

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
                            value: rows[r][c]
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
                const clearUpdates = cutCells.map(cell => ({
                    row: cell.row,
                    col: cell.col,
                    value: ""
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

    // Open multi-cell edit dialog
    const handleOpenMultiCellEdit = () => {
        if (!selectedRange || !tableContainerRef.current) return;

        const { startRow, startCol, endRow, endCol } = selectedRange;
        const minRow = Math.min(startRow, endRow);
        const minCol = Math.min(startCol, endCol);

        // Find the cell element to position the dialog
        const cellElement = tableContainerRef.current.querySelector(
            `[data-row="${minRow}"][data-col="${minCol}"]`
        ) as HTMLElement;

        if (cellElement) {
            const rect = cellElement.getBoundingClientRect();
            const containerRect = tableContainerRef.current.getBoundingClientRect();

            setMultiCellEditDialog({
                position: {
                    top: rect.top - containerRect.top,
                    left: rect.left - containerRect.left,
                    width: rect.width,
                    height: rect.height,
                },
            });
        }
    };

    // Save multi-cell edit
    const handleSaveMultiCellEdit = (value: string) => {
        if (!selectedRange) return;

        const { startRow, startCol, endRow, endCol } = selectedRange;
        const minRow = Math.min(startRow, endRow);
        const maxRow = Math.max(startRow, endRow);
        const minCol = Math.min(startCol, endCol);
        const maxCol = Math.max(startCol, endCol);

        // Build array of all cells to update
        const cellsToUpdate: Array<{ row: number; col: number; value: string }> = [];
        for (let r = minRow; r <= maxRow; r++) {
            for (let c = minCol; c <= maxCol; c++) {
                if (r < filteredData.length && c < headers.length) {
                    cellsToUpdate.push({ row: r, col: c, value });
                }
            }
        }

        // Update all cells in a single operation (creates single undo snapshot)
        updateCells(cellsToUpdate);

        // Trigger autosave after multi-cell edit
        triggerAutosave();

        setMultiCellEditDialog(null);

        // Restore focus to grid
        if (gridFocusRef.current) {
            gridFocusRef.current.focus();
        }
    };

    // Cancel multi-cell edit
    const handleCancelMultiCellEdit = () => {
        setMultiCellEditDialog(null);

        // Restore focus to grid
        if (gridFocusRef.current) {
            gridFocusRef.current.focus();
        }
    };

    // Handle keyboard navigation within editing cell
    const handleKeyDown = (
        e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
        row: number,
        col: number
    ) => {
        const isTextarea = e.currentTarget instanceof HTMLTextAreaElement;

        // For textareas, Ctrl+Enter creates newlines; Enter saves
        // For inputs, Enter always saves
        if (e.key === "Enter") {
            if (isTextarea && e.ctrlKey) {
                // Allow Ctrl+Enter to create newlines in textarea
                return;
            }

            e.preventDefault();
            e.stopPropagation(); // Prevent event from bubbling to global handler
            handleSaveEdit(row, col);

            // Move selection to next row if not Shift
            if (!e.shiftKey && row < filteredData.length - 1) {
                setTimeout(() => {
                    setSelectedCell(row + 1, col);
                }, 0);
            } else if (e.shiftKey && row > 0) {
                // Shift+Enter moves selection to previous row
                setTimeout(() => {
                    setSelectedCell(row - 1, col);
                }, 0);
            }
        } else if (e.key === "Tab") {
            e.preventDefault();
            e.stopPropagation(); // Prevent event from bubbling to global handler
            handleSaveEdit(row, col);

            // Move selection to next column if not Shift
            if (!e.shiftKey) {
                if (col < headers.length - 1) {
                    setTimeout(() => {
                        setSelectedCell(row, col + 1);
                    }, 0);
                } else if (row < filteredData.length - 1) {
                    // Wrap to next row
                    setTimeout(() => {
                        setSelectedCell(row + 1, 0);
                    }, 0);
                }
            } else {
                // Shift+Tab moves selection to previous column
                if (col > 0) {
                    setTimeout(() => {
                        setSelectedCell(row, col - 1);
                    }, 0);
                } else if (row > 0) {
                    // Wrap to previous row
                    setTimeout(() => {
                        setSelectedCell(row - 1, headers.length - 1);
                    }, 0);
                }
            }
        } else if (e.key === "Escape") {
            e.stopPropagation(); // Prevent event from bubbling to global handler
            clearEditingCell();
            // Restore focus to grid
            if (gridFocusRef.current) {
                gridFocusRef.current.focus();
            }
        }
    };

    // Cell selection handlers
    const handleCellMouseDown = (e: React.MouseEvent, row: number, col: number) => {
        // Only handle left-click for selection (button 0)
        if (e.button !== 0) return;

        // Don't interfere with text selection inside editing cell
        // Check if we're clicking inside an input or textarea
        const target = e.target as HTMLElement;
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

        // Shift-click: extend selection from current selected cell to clicked cell
        if (e.shiftKey && selectedCell) {
            e.preventDefault(); // Prevent default text selection behavior
            setSelectedRange(selectedCell.row, selectedCell.col, row, col);
            // Don't start new drag selection on shift-click
            return;
        }

        // Normal click: start new selection
        setIsSelecting(true);
        setSelectionStart({ row, col });
        setSelectedCell(row, col);
    };

    const handleCellMouseEnter = (row: number, col: number) => {
        // Set hovered column for column highlighting (only if column highlighting is enabled)
        if (hoverHighlightMode === "column" || hoverHighlightMode === "row-and-column") {
            setHoveredColumn(col);
        }

        // Don't handle drag selection if we're currently editing a cell
        // This prevents interference with text selection inside the editor
        if (editingCell && editingSource === "cell") {
            return;
        }

        // Handle drag selection
        if (isSelecting && selectionStart) {
            // Only create range if moved to different cell
            if (row !== selectionStart.row || col !== selectionStart.col) {
                setSelectedRange(selectionStart.row, selectionStart.col, row, col);
            }
        }
    };

    const handleCellMouseLeave = () => {
        // Clear hovered column when mouse leaves a cell
        setHoveredColumn(null);
    };

    // Row drag and drop handlers
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

    // Column drag and drop handlers
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

    // Context menu handlers
    const handleContextMenu = (e: React.MouseEvent, row?: number, col?: number) => {
        e.preventDefault();
        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            row,
            col,
        });
    };

    // Empty state
    if (headers.length === 0) {
        return (
            <div className="flex items-center justify-center h-full text-base-content/50">
                <p>No data to display</p>
            </div>
        );
    }

    // Calculate container dimensions based on drawer position
    // Summary row is 60px tall and fixed at the bottom
    // Container height is reduced so scrollbar appears above summary row
    const summaryRowHeight = 60;
    // Only disable text selection when doing cell selection, not when editing
    const isEditingCell = editingCell && editingSource === "cell";
    const containerStyle: React.CSSProperties = {
        width: drawerPosition === "right" ? `calc(100% - ${rightDrawerSize}px)` : "100%",
        height: drawerPosition === "bottom"
            ? `calc(100% - ${bottomDrawerSize}px - ${summaryRowHeight}px)`
            : `calc(100% - ${summaryRowHeight}px)`,
        paddingBottom: "20px", // Small padding for content breathing room
        userSelect: (!isEditingCell && (isSelecting || isDraggingRow || isDraggingColumn)) ? "none" : "auto",
        WebkitUserSelect: (!isEditingCell && (isSelecting || isDraggingRow || isDraggingColumn)) ? "none" : "auto",
        position: "relative",
    };

    return (
        <div
            className={`cell-grid-container relative outline-none ${autoFitColumns ? "overflow-y-scroll overflow-x-hidden" : "overflow-scroll"}`}
            ref={(el) => {
                if (tableContainerRef.current !== el) {
                    (tableContainerRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
                }
                if (gridFocusRef.current !== el) {
                    (gridFocusRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
                }
            }}
            tabIndex={0}
            onClick={(e) => {
                // Don't interfere with draggable elements
                const target = e.target as HTMLElement;
                const draggableElement = target.closest('[draggable="true"]');
                if (draggableElement) {
                    return; // Let the drag operation handle it
                }

                // Don't steal focus if clicking inside the editing cell
                // This allows text selection to work properly
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

                // Ensure grid gets focus on any mousedown
                if (gridFocusRef.current) {
                    gridFocusRef.current.focus();
                }
            }}
            onWheel={(e) => {
                // Shift + scroll for horizontal scrolling (only when Auto-Fit is disabled)
                if (e.shiftKey && !autoFitColumns && tableContainerRef.current) {
                    e.preventDefault();
                    tableContainerRef.current.scrollLeft += e.deltaY;
                }
            }}
            style={containerStyle}
        >
            {/* Force scrollbars to always be visible and hide scrollbar for summary row */}
            <style>{`
                .cell-grid-container {
                    scrollbar-width: thin; /* Firefox - always show */
                    scrollbar-gutter: stable both-edges; /* Reserve space for scrollbar */
                    -webkit-overflow-scrolling: touch;
                }

                /* Force scrollbar to always be visible in Webkit browsers */
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

                .cell-grid-container::-webkit-scrollbar-corner {
                    background: oklch(var(--b2));
                }

                .summary-row-scroll::-webkit-scrollbar {
                    display: none;
                }

                /* Ensure text selection works in editing cells */
                .editing-cell,
                .editing-cell *,
                .editing-cell input,
                .editing-cell textarea {
                    user-select: text !important;
                    -webkit-user-select: text !important;
                    -moz-user-select: text !important;
                    -ms-user-select: text !important;
                }
            `}</style>
            {/* Left scroll indicator (only show when Auto-Fit is disabled) */}
            {!autoFitColumns && showLeftScrollIndicator && (
                <div
                    className="absolute left-0 top-0 bottom-0 w-8 pointer-events-none z-30"
                    style={{
                        background: "linear-gradient(to right, rgba(0, 0, 0, 0.15), transparent)",
                    }}
                />
            )}

            {/* Right scroll indicator (only show when Auto-Fit is disabled) */}
            {!autoFitColumns && showRightScrollIndicator && (
                <div
                    className="absolute right-0 top-0 bottom-0 w-8 pointer-events-none z-30"
                    style={{
                        background: "linear-gradient(to left, rgba(0, 0, 0, 0.15), transparent)",
                    }}
                />
            )}

            <table
                className="table table-xs"
                style={{
                    tableLayout: "fixed",
                    width: `${64 + getTotalPixelWidth()}px`
                }}
            >
                <thead>
                    <tr>
                        {/* Row number header */}
                        <th className="bg-base-300 text-center sticky left-0 top-0 z-30" style={{ width: "64px", minWidth: "64px", maxWidth: "64px" }}>#</th>

                        {/* Column headers */}
                        {headers.map((header, colIndex) => {
                            const columnWidth = getPixelWidth(colIndex);
                            // Apply hover highlight to header as well
                            const headerClass = `bg-base-300 font-bold relative sticky top-0 z-20 ${hoveredColumn === colIndex ? "bg-base-200/70" : ""} ${dropTargetColumn === colIndex ? "border-l-4 border-primary" : ""}`;
                            return (
                                <th
                                    key={colIndex}
                                    className={headerClass}
                                    style={{ width: `${columnWidth}px`, minWidth: `${columnWidth}px`, maxWidth: `${columnWidth}px` }}
                                    onDragOver={(e) => handleColumnDragOver(e, colIndex)}
                                    onDrop={(e) => handleColumnDrop(e, colIndex)}
                                >
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
                                </th>
                            );
                        })}
                    </tr>
                </thead>
                <tbody>
                    {filteredData.map((row, rowIndex) => {
                        // Determine row background color
                        let rowBgClass = "";
                        const rowStyle: React.CSSProperties = {};

                        if (rowColoringMode === "by-field" && rowMatchesFilter(row)) {
                            rowStyle.backgroundColor = rowColorFilter?.color;
                        } else if (rowColoringMode === "alternating" && rowIndex % 2 === 1) {
                            rowBgClass = "bg-base-200/50";
                        }

                        // Apply row hover class only if row highlighting is enabled
                        const rowHoverClass = (hoverHighlightMode === "row" || hoverHighlightMode === "row-and-column") ? "hover:bg-base-200/70" : "";

                        return (
                            <tr
                                key={rowIndex}
                                ref={(el) => {
                                    if (el) {
                                        rowRefs.current.set(rowIndex, el);
                                    } else {
                                        rowRefs.current.delete(rowIndex);
                                    }
                                }}
                                className={`${rowHoverClass} ${rowBgClass} ${dropTargetRow === rowIndex ? "border-t-4 border-primary" : ""}`}
                                style={rowStyle}
                                onDragOver={(e) => handleRowDragOver(e, rowIndex)}
                                onDrop={(e) => handleRowDrop(e, rowIndex)}
                            >
                                {/* Row number */}
                                <td
                                    className={`bg-base-200 text-center font-mono text-sm border-r-2 ${showColumnSeparators ? "border-base-300" : "border-transparent"} sticky left-0 z-10 cursor-move`}
                                    style={{ width: "64px", minWidth: "64px", maxWidth: "64px", userSelect: "none", WebkitUserSelect: "none" }}
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
                                    onContextMenu={(e) => handleContextMenu(e, rowIndex, undefined)}
                                >
                                    <div className="flex items-center justify-center gap-1" style={{ pointerEvents: "none" }}>
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-base-content/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                        </svg>
                                        {rowIndex + 1}
                                    </div>
                                </td>

                                {/* Data cells */}
                                {row.map((cell, colIndex) => {
                                    const isEditing = editingCell?.row === rowIndex && editingCell?.col === colIndex;

                                    // Check if this cell is selected
                                    const isSingleSelected = selectedCell?.row === rowIndex && selectedCell?.col === colIndex && !selectedRange;
                                    const isInRange = selectedRange &&
                                        rowIndex >= Math.min(selectedRange.startRow, selectedRange.endRow) &&
                                        rowIndex <= Math.max(selectedRange.startRow, selectedRange.endRow) &&
                                        colIndex >= Math.min(selectedRange.startCol, selectedRange.endCol) &&
                                        colIndex <= Math.max(selectedRange.startCol, selectedRange.endCol);

                                    // Check if this cell is a search match
                                    const isMatch = matches.some(
                                        (match) => match.row === rowIndex && match.col === colIndex
                                    );
                                    const isCurrentMatch =
                                        currentMatchIndex >= 0 &&
                                        matches[currentMatchIndex]?.row === rowIndex &&
                                        matches[currentMatchIndex]?.col === colIndex;

                                    // Check if this cell is cut
                                    const isCut = cutCells?.some(
                                        (cutCell) => cutCell.row === rowIndex && cutCell.col === colIndex
                                    );

                                    // Determine cell class
                                    let cellClass = "p-0";

                                    // Column hover highlight (same as row hover)
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

                                    // Add drop target indicator (full height column line)
                                    if (dropTargetColumn === colIndex) {
                                        cellClass += " border-l-4 border-primary";
                                    }

                                    if (colIndex < row.length - 1) {
                                        cellClass += ` border-r-2 ${showColumnSeparators ? "border-base-300" : "border-transparent"}`;
                                    }

                                    const columnWidth = getPixelWidth(colIndex);

                                    // Determine if this cell should be edited with multi-line support
                                    const cellHasNewlines = cell.includes("\n");
                                    const shouldUseTextarea = wrapText || cellHasNewlines;

                                    return (
                                        <td
                                            key={colIndex}
                                            className={`${cellClass} relative ${isEditing && editingSource === "cell" ? "editing-cell" : ""}`}
                                            style={{
                                                width: `${columnWidth}px`,
                                                minWidth: `${columnWidth}px`,
                                                maxWidth: `${columnWidth}px`,
                                                ...(isEditing && editingSource === "cell" ? { userSelect: "text", WebkitUserSelect: "text" } : {}),
                                                ...(isCut ? {
                                                    outline: "2px dashed oklch(var(--p))",
                                                    outlineOffset: "-2px",
                                                    opacity: 0.7
                                                } : {})
                                            }}
                                            data-row={rowIndex}
                                            data-col={colIndex}
                                            ref={(el) => {
                                                // Set ref to the currently editing cell
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
                                            onContextMenu={(e) => handleContextMenu(e, rowIndex, colIndex)}
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
                                                            // Auto-resize textarea to fit content
                                                            e.target.style.height = "auto";
                                                            e.target.style.height = `${e.target.scrollHeight}px`;
                                                        }}
                                                        onClick={(e) => {
                                                            // Stop click propagation to prevent grid container from stealing focus
                                                            e.stopPropagation();
                                                        }}
                                                        onMouseDown={(e) => {
                                                            // Stop both React synthetic event and native event propagation
                                                            // This prevents the document-level mousedown listener from closing the editor
                                                            e.stopPropagation();
                                                            e.nativeEvent.stopImmediatePropagation();
                                                        }}
                                                        onKeyDown={(e) => handleKeyDown(e, rowIndex, colIndex)}
                                                        onInput={(e) => {
                                                            // Auto-resize on input as well
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
                                                        onClick={(e) => {
                                                            // Stop click propagation to prevent grid container from stealing focus
                                                            e.stopPropagation();
                                                        }}
                                                        onMouseDown={(e) => {
                                                            // Stop both React synthetic event and native event propagation
                                                            // This prevents the document-level mousedown listener from closing the editor
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
                                                    {isEditing && editingSource === "print" ? editingValue : cell}
                                                </div>
                                            )}
                                        </td>
                                    );
                                })}
                            </tr>
                        );
                    })}
                </tbody>
            </table>

            {/* Summary row */}
            <div
                ref={summaryRowRef}
                className="fixed bg-base-300 border-t-2 border-base-300 shadow-lg z-40"
                style={{
                    left: `${summaryRowLeftOffset}px`,
                    right: drawerPosition === "right" ? `${rightDrawerSize}px` : 0,
                    bottom: drawerPosition === "bottom" ? `${bottomDrawerSize}px` : 0,
                    height: "60px",
                    overflow: "hidden"
                }}
            >
                {/* Row number column placeholder - sticky */}
                <div className="absolute left-0 h-full bg-base-300 border-r-2 border-base-300 z-10" style={{ width: "64px" }}></div>

                <div
                    ref={summaryRowContentRef}
                    className="h-full summary-row-scroll"
                    style={{
                        overflowX: autoFitColumns ? "hidden" : "scroll",
                        overflowY: "hidden",
                        scrollbarWidth: "none", /* Firefox */
                        msOverflowStyle: "none", /* IE and Edge */
                        paddingLeft: "64px"
                    }}
                >
                    <div className="flex items-center h-full" style={{ width: `${getTotalPixelWidth()}px` }}>
                        {/* Summary dropdowns for each column */}
                        {headers.map((columnName, colIndex) => {
                            const summaryType = columnSummaries[columnName] || "count";
                            const columnData = filteredData.map((row) => row[colIndex] || "");
                            const summaryValue = calculateSummary(columnData, summaryType);
                            const columnWidth = getPixelWidth(colIndex);

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
                                                    backgroundImage: 'url("data:image/svg+xml,%3cellg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 20 20\'%3e%3cpath stroke=\'%236b7280\' stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'1.5\' d=\'M6 8l4-4 4 4\'/%3e%3c/svg%3e")',
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

            {/* Empty state when no rows */}
            {filteredData.length === 0 && (
                <div className="text-center py-8 text-base-content/50">
                    <p>No rows match the current filters</p>
                </div>
            )}

            {/* Context menu */}
            {contextMenu && (
                <div
                    className="fixed bg-base-100 border border-base-300 rounded-lg shadow-lg z-50 min-w-[160px]"
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <ul className="menu menu-sm p-2">
                        {contextMenu.row !== undefined && contextMenu.col !== undefined && (
                            <>
                                <li>
                                    <a
                                        onClick={() => {
                                            const value = filteredData[contextMenu.row!]?.[contextMenu.col!] || "";
                                            handleStartEdit(contextMenu.row!, contextMenu.col!, value);
                                            setContextMenu(null);
                                        }}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                        Edit
                                    </a>
                                </li>
                                <div className="divider my-1"></div>
                            </>
                        )}
                        <li>
                            <a
                                onClick={() => {
                                    handleCopyToClipboard();
                                    setContextMenu(null);
                                }}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                                Copy
                            </a>
                        </li>
                        <li>
                            <a
                                onClick={() => {
                                    handleCutToClipboard();
                                    setContextMenu(null);
                                }}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z" />
                                </svg>
                                Cut
                            </a>
                        </li>
                        <li>
                            <a
                                onClick={() => {
                                    handlePasteFromSystemClipboard();
                                    setContextMenu(null);
                                }}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                </svg>
                                Paste
                            </a>
                        </li>
                        {/* Multi-cell operations (only show when range is selected) */}
                        {selectedRange && (
                            <>
                                <div className="divider my-1"></div>
                                <li>
                                    <a
                                        onClick={() => {
                                            clearCells();
                                            setContextMenu(null);
                                        }}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                        Clear Selected Cells
                                    </a>
                                </li>
                                <li>
                                    <a
                                        onClick={() => {
                                            setContextMenu(null);
                                            handleOpenMultiCellEdit();
                                        }}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                        Fill Selected Cells...
                                    </a>
                                </li>
                            </>
                        )}
                        <div className="divider my-1"></div>
                        {contextMenu.row !== undefined && (
                            <>
                                <li>
                                    <a
                                        onClick={() => {
                                            addRow(contextMenu.row);
                                            setContextMenu(null);
                                        }}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                        </svg>
                                        Insert Row Above
                                    </a>
                                </li>
                                <li>
                                    <a
                                        onClick={() => {
                                            addRow((contextMenu.row || 0) + 1);
                                            setContextMenu(null);
                                        }}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                        </svg>
                                        Insert Row Below
                                    </a>
                                </li>
                            </>
                        )}
                        {contextMenu.col !== undefined && (
                            <>
                                <li>
                                    <a
                                        onClick={() => {
                                            addColumn(`Column ${headers.length + 1}`, contextMenu.col);
                                            setContextMenu(null);
                                        }}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                        </svg>
                                        Insert Column Left
                                    </a>
                                </li>
                                <li>
                                    <a
                                        onClick={() => {
                                            addColumn(`Column ${headers.length + 1}`, (contextMenu.col || 0) + 1);
                                            setContextMenu(null);
                                        }}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                        </svg>
                                        Insert Column Right
                                    </a>
                                </li>
                            </>
                        )}
                    </ul>
                </div>
            )}

            {/* Multi-cell edit dialog */}
            {multiCellEditDialog && (
                <MultiCellEditDialog
                    position={multiCellEditDialog.position}
                    onSave={handleSaveMultiCellEdit}
                    onCancel={handleCancelMultiCellEdit}
                />
            )}
        </div>
    );
}

export default CellGrid;
