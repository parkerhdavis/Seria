/**
 * Virtualized Cell Grid Component (Enhanced)
 *
 * Performance-optimized version of CellGrid using virtualization
 * for handling large Cell files efficiently with dynamic row heights.
 *
 * PHASE HISTORY:
 * ============================================================================
 * Phase 1 Complete: Selection system, keyboard shortcuts, dynamic sizing
 * Phase 2 Complete: Copy/paste/cut, context menus, multi-cell fill
 * Phase 3 Complete: Column resizing, column filtering UI, column summaries with fixed bottom row
 * Phase 4 Complete: Row/column drag-and-drop reordering
 * Phase 5 Complete: Performance optimizations for large files (1k-10k rows)
 *
 * PHASE 5 PERFORMANCE OPTIMIZATIONS:
 * ============================================================================
 * 1. Column Width Memoization (frontend/src/components/cell/CellGridVirtualized.tsx:228-280)
 *    - Wrapped column width calculation functions in useCallback/useMemo
 *    - Prevents unnecessary recalculations during resize/render
 *    - Impact: Faster column resizing and reduced CPU usage
 *
 * 2. Web Worker CSV Parsing (frontend/src/utils/cellParser.worker.ts)
 *    - Offloads CSV parsing to background thread
 *    - Prevents UI freeze during large file loads
 *    - Supports chunked parsing with progress updates
 *    - Impact: Non-blocking file loading for files > 5MB
 *
 * 3. Progressive/Incremental Loading (frontend/src/stores/cellStore.ts:360-558)
 *    - New loadCellsProgressive() function using web worker
 *    - Three-phase loading strategy:
 *      a) Phase 1: Parse headers, show empty grid skeleton
 *      b) Phase 2: Load data in chunks, update grid progressively
 *      c) Phase 3: Apply config, mark as fully loaded
 *    - Shows non-blocking progress banner with percentage and row count
 *    - Impact: Immediate visual feedback, perceived faster load times
 *
 * 4. Loading State Management
 *    - New store fields: loadingProgress (0-100), isFullyLoaded (boolean)
 *    - Non-blocking progress banner at top of grid (line 1319-1351)
 *    - App.tsx only shows LoadingScreen during initialization, not file loads
 *
 * NOTE: Column resize measurement optimization was reverted due to visual
 * glitches with wrapped text. Current implementation uses standard dynamic
 * measurement which works correctly but may be slower with very large files.
 *
 * USAGE RECOMMENDATIONS:
 * ============================================================================
 * - Use loadCells() for files < 5MB or < 5000 rows (synchronous)
 * - Use loadCellsProgressive() for files > 5MB or > 5000 rows (async with progress)
 * - Column resizing performance improved regardless of file size
 * - Selection dragging uses RAF batching (max 60fps) - already optimized
 *
 * TECHNICAL NOTES:
 * ============================================================================
 * - Row virtualization: @tanstack/react-virtual (line 165-175)
 *   Only renders visible rows + 10 overscan rows
 * - Column width calculations: Memoized with containerWidth dependency
 *   Recalculates only when container resizes
 * - Web worker: Vite automatically bundles cellParser.worker.ts
 *   Worker terminates automatically after parsing completes
 * - Progress updates: Throttled to prevent excessive re-renders
 *   Worker sends chunks, main thread batches state updates
 */

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useCellStore } from "@stores/cellStore";
import { useCellSelectionStore } from "@stores/cellSelectionStore";
import { useCellEditStore } from "@stores/cellEditStore";
import { useCellColumnStore } from "@stores/cellColumnStore";
import { useCellFilterStore } from "@stores/cellFilterStore";
import { useSettingsStore, type FilterOperation } from "@stores/settingsStore";
import { useFindReplaceStore } from "@stores/findReplaceStore";
import { useDrawerStore } from "@stores/drawerStore";
import ColumnFilterDropdown from "../toolbar/ColumnFilterDropdown";
import { useClipboard } from "@/hooks/useClipboard";
import { useAutosave } from "@utils/useAutosave";
import { useAutocomplete } from "@/hooks/useAutocomplete";
import AutocompleteDropdown from "./AutocompleteDropdown";
import PopoutEditBox from "./PopoutEditBox";
import SummaryRow from "./SummaryRow";
import ContextMenu from "./ContextMenu";
import RowColumnContextMenu from "./RowColumnContextMenu";
import FillDialog from "./FillDialog";
import { useContextMenu } from "@/hooks/useContextMenu";
import { useCellSelection } from "@/hooks/useCellSelection";
import { useFilteredData } from "@/hooks/useFilteredData";
import { useColumnWidths } from "@/hooks/useColumnWidths";
import { useColumnResize } from "@/hooks/useColumnResize";
import { useRowDragAndDrop } from "@/hooks/useRowDragAndDrop";
import { useColumnDragAndDrop } from "@/hooks/useColumnDragAndDrop";

interface CellGridVirtualizedProps {
    onCellEdit?: (row: number, col: number, value: string) => void;
}

/**
 * Virtualized Cell Grid - only renders visible rows for performance
 * Now with full selection system and keyboard navigation
 */
function CellGridVirtualized({ onCellEdit }: CellGridVirtualizedProps) {
    // ===== STORE INTEGRATION =====
    // Use Zustand selectors to reduce subscription scope and prevent unnecessary re-renders
    const headers = useCellStore((state) => state.headers);
    const data = useCellStore((state) => state.data);
    const updateCell = useCellStore((state) => state.updateCell);
    const updateCells = useCellStore((state) => state.updateCells);
    // Editing state from cellEditStore
    const editingCell = useCellEditStore((state) => state.editingCell);
    const editingValue = useCellEditStore((state) => state.editingValue);
    const editingSource = useCellEditStore((state) => state.editingSource);
    const setEditingCell = useCellEditStore((state) => state.setEditingCell);
    const updateEditingValue = useCellEditStore((state) => state.updateEditingValue);
    const clearEditingCell = useCellEditStore((state) => state.clearEditingCell);
    // Selection state from cellSelectionStore
    const selectedCell = useCellSelectionStore((state) => state.selectedCell);
    const selectedRange = useCellSelectionStore((state) => state.selectedRange);
    const setSelectedCell = useCellSelectionStore((state) => state.setSelectedCell);
    const setSelectedRange = useCellSelectionStore((state) => state.setSelectedRange);
    const clearSelection = useCellSelectionStore((state) => state.clearSelection);
    // Multi-cursor state from cellSelectionStore
    const multiCursors = useCellSelectionStore((state) => state.multiCursors);
    const toggleCursor = useCellSelectionStore((state) => state.toggleCursor);
    const clearCursors = useCellSelectionStore((state) => state.clearCursors);
    const hasMultipleCursors = useCellSelectionStore((state) => state.hasMultipleCursors);
    const getAllCursors = useCellSelectionStore((state) => state.getAllCursors);
    // Actions that modify data stay in cellStore
    const copySelection = useCellStore((state) => state.copySelection);
    const clearCells = useCellStore((state) => state.clearCells);
    const setColumnWidths = useCellColumnStore((state) => state.setColumnWidths);
    const setColumnFilter = useCellFilterStore((state) => state.setColumnFilter);
    const clearColumnFilter = useCellFilterStore((state) => state.clearColumnFilter);
    const setColumnSummary = useCellFilterStore((state) => state.setColumnSummary);
    const addRow = useCellStore((state) => state.addRow);
    const deleteRows = useCellStore((state) => state.deleteRows);
    const addColumn = useCellStore((state) => state.addColumn);
    const deleteColumn = useCellStore((state) => state.deleteColumn);
    const reorderRows = useCellStore((state) => state.reorderRows);
    const reorderColumns = useCellStore((state) => state.reorderColumns);
    const isLoading = useCellStore((state) => state.isLoading);
    const loadingProgress = useCellStore((state) => state.loadingProgress);
    const isFullyLoaded = useCellStore((state) => state.isFullyLoaded);
    // Column display state from cellColumnStore
    const columnWidths = useCellColumnStore((state) => state.columnWidths);
    const columnCache = useCellColumnStore((state) => state.columnCache);
    // Filter/summary state from cellFilterStore
    const columnFilters = useCellFilterStore((state) => state.columnFilters);
    const columnSummaries = useCellFilterStore((state) => state.columnSummaries);

    const showColumnSeparators = useSettingsStore((state) => state.showColumnSeparators);
    const wrapText = useSettingsStore((state) => state.wrapText);
    const autoFitColumns = useSettingsStore((state) => state.autoFitColumns);
    const rowColoringMode = useSettingsStore((state) => state.rowColoringMode);
    const rowColorFilter = useSettingsStore((state) => state.rowColorFilter);
    const setRowColoringMode = useSettingsStore((state) => state.setRowColoringMode);
    const setRowColorFilter = useSettingsStore((state) => state.setRowColorFilter);
    const cellFollowsPrintEdit = useSettingsStore((state) => state.cellFollowsPrintEdit);
    const hoverHighlightMode = useSettingsStore((state) => state.hoverHighlightMode);
    const autocompleteEnabled = useSettingsStore((state) => state.autocompleteEnabled);
    const autocompleteMinChars = useSettingsStore((state) => state.autocompleteMinChars);
    const groupByColumn = useSettingsStore((state) => state.groupByColumn);

    const matches = useFindReplaceStore((state) => state.matches);
    const currentMatchIndex = useFindReplaceStore((state) => state.currentMatchIndex);
    const searchContext = useFindReplaceStore((state) => state.searchOptions.searchContext);

    const drawerPosition = useDrawerStore((state) => state.position);
    const rightDrawerSize = useDrawerStore((state) => state.rightDrawerSize);

    // Autosave hook
    const { triggerAutosave } = useAutosave();

    // ===== LOCAL STATE =====

    // Multi-cell fill dialog state
    const [showFillDialog, setShowFillDialog] = useState(false);

    // Row/column context menu state
    const [rcContextMenu, setRcContextMenu] = useState<{
        x: number;
        y: number;
        type: "row" | "column";
        index: number;
    } | null>(null);

    // Row coloring filter popover state (which column index is open, null = closed)
    const [rowColorPopoverCol, setRowColorPopoverCol] = useState<number | null>(null);
    const rowColorPopoverRef = useRef<HTMLDivElement>(null);

    // Popout edit box position (for multi-line editing when wrap text is off)
    const [popoutEditPosition, setPopoutEditPosition] = useState<{
        top: number;
        left: number;
        width: number;
    } | null>(null);



    // ===== REFS =====
    const parentRef = useRef<HTMLDivElement>(null);
    const gridFocusRef = useRef<HTMLDivElement>(null);
    const editingCellRef = useRef<HTMLDivElement | null>(null);
    const editingInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

    // Sticky group header: tracks which group label is currently at the top of the viewport
    const [stickyGroupLabel, setStickyGroupLabel] = useState<string | null>(null);

    // ===== EXTRACTED HOOKS =====
    // Filtered data
    const filteredData = useFilteredData(data, headers, columnFilters);

    // ===== GROUP BY =====
    const collapsedGroups = useSettingsStore((state) => state.collapsedGroups);
    const toggleGroupCollapsed = useSettingsStore((state) => state.toggleGroupCollapsed);

    // Height of the group-by divider element in pixels
    const GROUP_DIVIDER_HEIGHT = 32;

    /**
     * Compute group information from filteredData:
     *   - groupForRow: maps each filteredData index to its group value
     *   - allGroupValues: ordered list of unique non-empty group values
     *   - dividerRows: set of filteredData indices that start a new group
     *   - dividerLabels: map of filteredData index -> group label text
     */
    const { groupForRow, dividerRows, dividerLabels } = useMemo(() => {
        const groupForRow = new Map<number, string>();
        const dividerRows = new Set<number>();
        const dividerLabels = new Map<number, string>();

        if (!groupByColumn) {
            return { groupForRow, dividerRows, dividerLabels };
        }

        const colIndex = headers.indexOf(groupByColumn);
        if (colIndex === -1) {
            return { groupForRow, dividerRows, dividerLabels };
        }

        let currentGroupValue = ""; // the running non-empty group value
        for (let i = 0; i < filteredData.length; i++) {
            const cellValue = filteredData[i][colIndex] || "";
            if (cellValue !== "") {
                if (cellValue !== currentGroupValue) {
                    // New group begins
                    if (currentGroupValue !== "") {
                        // Not the very first group — add a divider
                        dividerRows.add(i);
                    }
                    currentGroupValue = cellValue;
                    dividerLabels.set(i, cellValue);
                }
            }
            // Assign every row to its current group (empty rows inherit)
            groupForRow.set(i, currentGroupValue);
        }

        return { groupForRow, dividerRows, dividerLabels };
    }, [filteredData, headers, groupByColumn]);

    /**
     * Build visible row indices — filters out rows belonging to collapsed groups.
     * Each entry is a filteredData index. The virtualizer iterates over these.
     * Divider rows are always included (so collapsed group headers remain visible).
     */
    const visibleRowIndices = useMemo(() => {
        if (!groupByColumn || collapsedGroups.size === 0) {
            // No collapsing — return identity mapping
            return filteredData.map((_, i) => i);
        }
        const indices: number[] = [];
        for (let i = 0; i < filteredData.length; i++) {
            const group = groupForRow.get(i) || "";
            if (collapsedGroups.has(group)) {
                // Only include the divider row itself (if this row starts the group)
                if (dividerRows.has(i)) {
                    indices.push(i);
                }
                // skip all other rows in the collapsed group
            } else {
                indices.push(i);
            }
        }
        return indices;
    }, [filteredData, groupByColumn, collapsedGroups, groupForRow, dividerRows]);

    // Column widths hook
    const {
        getPixelWidth,
        pixelWidths: getAllPixelWidths,
        convertPixelsToProportions,
    } = useColumnWidths(parentRef, columnWidths, setColumnWidths, headers.length, autoFitColumns);

    // Column resize hook
    const {
        resizingColumn,
        handleColumnResizeStart,
    } = useColumnResize(headers, columnWidths, setColumnWidths, getPixelWidth, convertPixelsToProportions, autoFitColumns);

    // Row drag-and-drop hook
    const {
        dropTargetRow,
        handleRowDragStart,
        handleRowDragOver,
        handleRowDrop,
        handleRowDragEnd,
    } = useRowDragAndDrop(reorderRows, triggerAutosave);

    // Column drag-and-drop hook
    const {
        dropTargetColumn,
        handleColumnDragStart,
        handleColumnDragOver,
        handleColumnDrop,
        handleColumnDragEnd,
    } = useColumnDragAndDrop(reorderColumns, triggerAutosave);

    // Clipboard operations hook
    const {
        cutCells,
        setCutCells,
        handleCopyToClipboard,
        handleCutToClipboard,
        handlePasteFromSystemClipboard,
    } = useClipboard({
        selectedCell,
        selectedRange,
        filteredData,
        headers,
        copySelection,
        updateCells,
        triggerAutosave,
        hasMultipleCursors,
        getAllCursors,
    });

    // Context menu hook
    const {
        contextMenu,
        closeContextMenu,
        handleCellContextMenu,
    } = useContextMenu({
        selectedCell,
        selectedRange,
        setSelectedCell,
    });

    // Cell selection hook
    const {
        isSelecting,
        hoveredColumn,
        handleCellMouseDown,
        handleCellMouseEnter,
        handleCellMouseLeave,
        stopSelecting,
    } = useCellSelection({
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
    });

    // Autocomplete hook
    const {
        autocompleteSuggestions,
        autocompleteSelectedIndex,
        showAutocomplete,
        updateAutocompleteSuggestions,
        closeAutocomplete,
        navigateAutocomplete,
        getSelectedSuggestion,
        handleAutocompleteKeyDown,
    } = useAutocomplete({
        autocompleteEnabled,
        autocompleteMinChars,
        columnCache,
    });

    // ===== VIRTUALIZER SETUP WITH DYNAMIC SIZING =====
    const rowVirtualizer = useVirtualizer({
        count: visibleRowIndices.length,
        getScrollElement: () => parentRef.current,
        estimateSize: (displayIndex) => {
            const dataIndex = visibleRowIndices[displayIndex];
            const base = 40;
            const hasDivider = dividerRows.has(dataIndex);
            // Collapsed groups show only the divider, no row content
            const isCollapsed = groupByColumn !== null && collapsedGroups.has(groupForRow.get(dataIndex) || "");
            if (isCollapsed && hasDivider) {
                return GROUP_DIVIDER_HEIGHT;
            }
            return hasDivider ? base + GROUP_DIVIDER_HEIGHT : base;
        },
        overscan: 10, // Pre-render 10 rows above/below for smoother scrolling
        // Enable dynamic sizing for wrapText support
        measureElement: (element) => {
            // Measure actual row height after render
            return element?.getBoundingClientRect().height ?? 40;
        },
    });

    // Column width helpers provided by useColumnWidths hook

    // ===== STICKY GROUP HEADER =====
    // Track the current group label that should be shown in the sticky header.
    // Updated on scroll by checking which group the topmost visible row belongs to.
    useEffect(() => {
        if (!groupByColumn || !parentRef.current) {
            setStickyGroupLabel(null);
            return;
        }

        const scrollEl = parentRef.current;
        const handleScroll = () => {
            const virtualItems = rowVirtualizer.getVirtualItems();
            if (virtualItems.length === 0) {
                setStickyGroupLabel(null);
                return;
            }
            // Find the first visible virtual item
            const firstVisible = virtualItems[0];
            const dataIndex = visibleRowIndices[firstVisible.index];
            const group = groupForRow.get(dataIndex) || "";
            setStickyGroupLabel(group || null);
        };

        // Set initial value
        handleScroll();

        scrollEl.addEventListener("scroll", handleScroll, { passive: true });
        return () => scrollEl.removeEventListener("scroll", handleScroll);
    }, [groupByColumn, groupForRow, visibleRowIndices, rowVirtualizer]);

    // ===== MEMOIZED SUMMARY CALCULATIONS =====
    // Prevents expensive recalculation on every render - only recalculates when data changes
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


    // Container resize observer and auto-fit initialization handled by useColumnWidths hook

    // ===== GLOBAL EVENT HANDLERS =====

    // Handle clicking outside editing cell to save
    useEffect(() => {
        const handleMouseDown = (e: MouseEvent) => {
            if (editingCell && editingSource === "cell") {
                const target = e.target as Node;

                // Check if click is inside the editing cell or the editing input (portal or inline)
                const isClickInsideEditingCell = editingCellRef.current?.contains(target);
                const isClickInsideEditingInput = editingInputRef.current?.contains(target);

                if (!isClickInsideEditingCell && !isClickInsideEditingInput) {
                    const value = editingValue;
                    updateCell(editingCell.row, editingCell.col, value);
                    clearEditingCell();
                    closeAutocomplete();
                }
            }
        };

        document.addEventListener("mousedown", handleMouseDown);
        return () => document.removeEventListener("mousedown", handleMouseDown);
    }, [editingCell, editingSource, editingValue, updateCell, clearEditingCell, closeAutocomplete]);

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
                        // Normal arrow: move selection, scroll only if not already visible
                        setSelectedCell(newRow, newCol);
                        rowVirtualizer.scrollToIndex(newRow, { align: "auto" });
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
            if ((e.key === "Delete" || e.key === "Backspace") && (selectedCell || selectedRange || hasMultipleCursors())) {
                // If multiple cursors are active, clear all cursor cells
                if (hasMultipleCursors()) {
                    const allCursors = getAllCursors();
                    const cellUpdates = allCursors.map((cursor) => ({
                        row: cursor.row,
                        col: cursor.col,
                        value: "",
                    }));
                    updateCells(cellUpdates);
                } else {
                    // Normal clear
                    clearCells();
                }
                setCutCells(null); // Cancel any cut operation
                e.preventDefault();
            }

            // Escape to clear selection and cancel cut operation
            if (e.key === "Escape") {
                clearSelection();
                clearCursors();
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

    // Scroll to row when requested by external components (e.g. Print view scroll-to-group)
    const scrollToRow = useCellSelectionStore(state => state.scrollToRow);
    const clearScrollToRow = useCellSelectionStore(state => state.clearScrollToRow);
    useEffect(() => {
        if (scrollToRow !== null) {
            // Find the virtual index for this data row
            const virtualIndex = visibleRowIndices.indexOf(scrollToRow);
            if (virtualIndex >= 0) {
                rowVirtualizer.scrollToIndex(virtualIndex, { align: "center" });
            }
            clearScrollToRow();
        }
    }, [scrollToRow, clearScrollToRow, rowVirtualizer, visibleRowIndices]);

    // Calculate popout position when editing starts (BEFORE rendering input)
    useEffect(() => {
        if (editingCell && editingSource === "cell") {
            // Calculate popout position if needed (for multi-line edit when wrap text is off)
            const cellValue = filteredData[editingCell.row]?.[editingCell.col] || "";
            const cellHasNewlines = cellValue.includes("\n");

            // Estimate if text is long enough to wrap to multiple lines
            // Average character width for text-sm (14px) is approximately 7-8px
            // Account for padding (3 on each side = 24px total)
            const columnWidth = getAllPixelWidths[editingCell.col] || 150;
            const availableWidth = columnWidth - 24; // subtract padding
            const avgCharWidth = 7.5; // approximate average character width
            const charsPerLine = Math.floor(availableWidth / avgCharWidth);
            const wouldWrapMultipleLines = cellValue.length > charsPerLine;

            const isMultiLine = cellHasNewlines || wouldWrapMultipleLines;
            const needsPopout = !wrapText && isMultiLine;

            if (needsPopout && editingCellRef.current) {
                const cellRect = editingCellRef.current.getBoundingClientRect();
                setPopoutEditPosition({
                    top: cellRect.top,
                    left: cellRect.left,
                    width: Math.max(cellRect.width, 200),
                });
            } else {
                setPopoutEditPosition(null);
            }
        } else {
            setPopoutEditPosition(null);
        }
    // Disabled: pixelWidths dependency
    // Reason: pixelWidths is defined later in the component (line 1313), adding it here causes
    //         "Cannot access uninitialized variable" error. The current value is accessed when
    //         editingCell changes, which is the main trigger we need.
    // Alternative: Refactor to move pixelWidths calculation earlier, or use a ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editingCell, wrapText, editingSource, filteredData]);

    // Position cursor at end when editing input is ready
    useEffect(() => {
        if (editingCell && editingInputRef.current) {
            // Position cursor at end
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


    // ===== CELL EDITING HANDLERS =====
    // Wrapped in useCallback to prevent recreation on every render

    const handleStartEdit = useCallback((row: number, col: number, value: string) => {
        stopSelecting();
        setEditingCell(row, col, value);
    }, [setEditingCell, stopSelecting]);

    const handleSaveEdit = useCallback((row: number, col: number) => {
        if (editingCell) {
            // Check if we have multiple cursors - if so, update all of them
            if (hasMultipleCursors()) {
                const allCursors = getAllCursors();
                const cellUpdates = allCursors.map((cursor) => ({
                    row: cursor.row,
                    col: cursor.col,
                    value: editingValue,
                }));
                updateCells(cellUpdates);

                // Call onCellEdit for each cursor
                if (onCellEdit) {
                    allCursors.forEach((cursor) => {
                        onCellEdit(cursor.row, cursor.col, editingValue);
                    });
                }
            } else {
                // Single cursor - normal update
                updateCell(row, col, editingValue);
                if (onCellEdit) {
                    onCellEdit(row, col, editingValue);
                }
            }
        }
        clearEditingCell();
        closeAutocomplete();

        // Restore focus to grid
        if (gridFocusRef.current) {
            gridFocusRef.current.focus();
        }
    }, [editingCell, editingValue, updateCell, updateCells, onCellEdit, clearEditingCell, closeAutocomplete, hasMultipleCursors, getAllCursors]);

    const handleKeyDown = (
        e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
        row: number,
        col: number
    ) => {
        const isTextarea = e.currentTarget instanceof HTMLTextAreaElement;

        // Handle autocomplete keyboard navigation
        if (handleAutocompleteKeyDown(e)) {
            return; // Event fully consumed by autocomplete (arrow nav or escape)
        }
        // For Enter/Tab with autocomplete open, accept the suggestion and continue
        if (showAutocomplete && (e.key === "Enter" || e.key === "Tab")) {
            const selectedValue = getSelectedSuggestion();
            if (selectedValue) {
                updateEditingValue(selectedValue);
            }
            closeAutocomplete();
            // Don't return - let normal Enter/Tab handling commit the edit
        }

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
                        rowVirtualizer.scrollToIndex(row + 1, { align: "auto" });
                    }, 0);
                } else if (e.shiftKey && row > 0) {
                    setTimeout(() => {
                        setSelectedCell(row - 1, col);
                        rowVirtualizer.scrollToIndex(row - 1, { align: "auto" });
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
                        rowVirtualizer.scrollToIndex(row + 1, { align: "auto" });
                    }, 0);
                }
            } else {
                if (col > 0) {
                    setTimeout(() => setSelectedCell(row, col - 1), 0);
                } else if (row > 0) {
                    setTimeout(() => {
                        setSelectedCell(row - 1, headers.length - 1);
                        rowVirtualizer.scrollToIndex(row - 1, { align: "auto" });
                    }, 0);
                }
            }
        } else if (e.key === "Escape") {
            e.stopPropagation();
            clearEditingCell();
            closeAutocomplete();
            if (gridFocusRef.current) {
                gridFocusRef.current.focus();
            }
        }
    };

    // Context menu action handler
    const handleContextMenuAction = useCallback((action: string) => {
        closeContextMenu();

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
    }, [closeContextMenu, handleCopyToClipboard, handleCutToClipboard, handlePasteFromSystemClipboard, clearCells, setCutCells, selectedRange, selectedCell, filteredData, handleStartEdit]);

    // Row/column context menu handlers
    const handleRowContextMenu = useCallback((e: React.MouseEvent, rowIndex: number) => {
        e.preventDefault();
        e.stopPropagation();
        setRcContextMenu({ x: e.clientX, y: e.clientY, type: "row", index: rowIndex });
    }, []);

    const handleColumnContextMenu = useCallback((e: React.MouseEvent, colIndex: number) => {
        e.preventDefault();
        e.stopPropagation();
        setRcContextMenu({ x: e.clientX, y: e.clientY, type: "column", index: colIndex });
    }, []);

    const handleRcContextMenuAction = useCallback((action: string) => {
        if (!rcContextMenu) return;
        const { type, index } = rcContextMenu;
        setRcContextMenu(null);

        if (type === "row") {
            switch (action) {
                case "insertBefore":
                    addRow(index);
                    break;
                case "insertAfter":
                    addRow(index + 1);
                    break;
                case "duplicate": {
                    const rowData = filteredData[index];
                    if (rowData) {
                        addRow(index + 1);
                        // After adding, copy the data into the new row
                        const newRowIndex = index + 1;
                        const cellUpdates = rowData.map((value, col) => ({
                            row: newRowIndex,
                            col,
                            value,
                        }));
                        // Use setTimeout to ensure the row is added first
                        setTimeout(() => updateCells(cellUpdates), 0);
                    }
                    break;
                }
                case "delete":
                    deleteRows([index]);
                    break;
            }
        } else {
            switch (action) {
                case "insertBefore":
                    addColumn(`Column ${headers.length + 1}`, index);
                    break;
                case "insertAfter":
                    addColumn(`Column ${headers.length + 1}`, index + 1);
                    break;
                case "duplicate": {
                    const colName = headers[index];
                    addColumn(`${colName} (copy)`, index + 1);
                    // Copy data from original column to new column
                    const cellUpdates = data.map((row, rowIdx) => ({
                        row: rowIdx,
                        col: index + 1,
                        value: row[index] || "",
                    }));
                    setTimeout(() => updateCells(cellUpdates), 0);
                    break;
                }
                case "delete":
                    deleteColumn(index);
                    break;
            }
        }
        triggerAutosave();
    }, [rcContextMenu, addRow, deleteRows, addColumn, deleteColumn, filteredData, headers, data, updateCells, triggerAutosave]);

    // Close row/column context menu on click outside
    useEffect(() => {
        if (!rcContextMenu) return;

        const handleClickOutside = () => {
            setRcContextMenu(null);
        };

        const timeoutId = setTimeout(() => {
            document.addEventListener("click", handleClickOutside);
            document.addEventListener("contextmenu", handleClickOutside);
        }, 0);

        return () => {
            clearTimeout(timeoutId);
            document.removeEventListener("click", handleClickOutside);
            document.removeEventListener("contextmenu", handleClickOutside);
        };
    }, [rcContextMenu]);

    // Close row coloring popover on click outside or Esc
    useEffect(() => {
        if (rowColorPopoverCol === null) return;

        const handleClickOutside = (event: MouseEvent) => {
            if (rowColorPopoverRef.current && !rowColorPopoverRef.current.contains(event.target as Node)) {
                setRowColorPopoverCol(null);
            }
        };

        const handleEsc = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setRowColorPopoverCol(null);
            }
        };

        const timeoutId = setTimeout(() => {
            document.addEventListener("mousedown", handleClickOutside);
        }, 0);
        document.addEventListener("keydown", handleEsc);

        return () => {
            clearTimeout(timeoutId);
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("keydown", handleEsc);
        };
    }, [rowColorPopoverCol]);

    // Row coloring filter handlers
    const handleRowColorOperationChange = useCallback((operation: FilterOperation) => {
        const filter = useSettingsStore.getState().rowColorFilter;
        if (filter) {
            setRowColorFilter({ ...filter, operation });
        }
    }, [setRowColorFilter]);

    const handleRowColorValueChange = useCallback((value: string) => {
        const filter = useSettingsStore.getState().rowColorFilter;
        if (filter) {
            setRowColorFilter({ ...filter, value });
        }
    }, [setRowColorFilter]);

    const handleRowColorColorChange = useCallback((color: string) => {
        const filter = useSettingsStore.getState().rowColorFilter;
        if (filter) {
            setRowColorFilter({ ...filter, color });
        }
    }, [setRowColorFilter]);

    // Column resize hook (see useColumnResize)

    // Row and column drag-and-drop hooks (see useRowDragAndDrop / useColumnDragAndDrop)

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
    // Note: getAllPixelWidths is a memoized value (useMemo), not a function
    const pixelWidths = getAllPixelWidths;

    const isEditingCell = editingCell && editingSource === "cell";
    const summaryRowHeight = 60;
    const containerStyle: React.CSSProperties = {
        width: drawerPosition === "right" ? `calc(100% - ${rightDrawerSize}px)` : "100%",
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
                    ${autoFitColumns ? "" : "scrollbar-gutter: stable both-edges;"}
                    -webkit-overflow-scrolling: touch;
                }

                .cell-grid-container::-webkit-scrollbar {
                    -webkit-appearance: none;
                    width: ${autoFitColumns ? "10px" : "14px"};
                    height: ${autoFitColumns ? "10px" : "14px"};
                }

                .cell-grid-container::-webkit-scrollbar-track {
                    background: ${autoFitColumns ? "oklch(var(--b2) / 0.5)" : "oklch(var(--b2))"};
                    border: ${autoFitColumns ? "none" : "1px solid oklch(var(--bc) / 0.1)"};
                }

                .cell-grid-container::-webkit-scrollbar-thumb {
                    background: oklch(var(--bc) / ${autoFitColumns ? "0.5" : "0.4"});
                    border-radius: ${autoFitColumns ? "5px" : "7px"};
                    border: ${autoFitColumns ? "1px solid oklch(var(--b2))" : "2px solid oklch(var(--b2))"};
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

            {/* ===== LOADING PROGRESS BANNER ===== */}
            {/*
                Non-blocking progress banner for progressive file loading.
                Shows at top of grid without blocking interaction.
                Allows viewing grid skeleton and watching rows fill in real-time.
            */}
            {isLoading && loadingProgress > 0 && !isFullyLoaded && (
                <div className="absolute top-0 left-0 right-0 z-30 bg-primary/10 border-b-2 border-primary/30 backdrop-blur-sm">
                    <div className="flex items-center gap-4 px-6 py-3">
                        {/* Spinner */}
                        <div className="loading loading-spinner loading-sm text-primary"></div>

                        {/* Progress info */}
                        <div className="flex-1 flex items-center gap-4">
                            <span className="text-sm font-medium text-primary">
                                Loading file... {loadingProgress}%
                            </span>
                            <span className="text-xs text-base-content/70">
                                {data.length.toLocaleString()} rows
                            </span>
                        </div>

                        {/* Compact progress bar */}
                        <div className="w-48">
                            <progress
                                className="progress progress-primary w-full h-2"
                                value={loadingProgress}
                                max="100"
                            ></progress>
                        </div>
                    </div>
                </div>
            )}

            {/* Header (sticky) — includes column headers and optional group label */}
            <div className="sticky top-0 z-10 bg-base-300 border-b-2 border-base-300">
                <div className="flex">
                    {/* Row number column header (left) */}
                    <div
                        className={`px-2 py-1 text-center text-xs font-bold border-r bg-base-300 ${showColumnSeparators ? "border-base-300" : "border-base-content/10"}`}
                        style={{ width: "64px", minWidth: "64px", maxWidth: "64px" }}
                    >
                        #
                    </div>

                    {/* Data column headers */}
                    {headers.map((header, colIndex) => {
                        const columnWidth = pixelWidths[colIndex];
                        const headerClass = `bg-base-300 font-bold px-1.5 py-1 border-r relative ${showColumnSeparators ? "border-base-300" : "border-base-content/10"} ${
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
                                onContextMenu={(e) => handleColumnContextMenu(e, colIndex)}
                            >
                                {/* Header content with drag handle and filter */}
                                <div className="flex items-center gap-1 justify-between">
                                    {/* Drag handle */}
                                    <div
                                        draggable={true}
                                        onMouseDown={(e) => {
                                            // Only allow left-click to initiate drag
                                            if (e.button !== 0) {
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
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ pointerEvents: "none" }}>
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                                        </svg>
                                    </div>

                                    {/* Header text */}
                                    <span className="flex-1 truncate text-xs">{header}</span>

                                    {/* Row coloring paintbrush button (always visible) */}
                                    {(() => {
                                        const isHighlightActive = rowColoringMode === "by-field" && rowColorFilter?.field === header;
                                        return (
                                            <div className="relative flex-shrink-0" ref={isHighlightActive && rowColorPopoverCol === colIndex ? rowColorPopoverRef : undefined}>
                                                <button
                                                    className={`btn btn-ghost btn-xs px-1 min-h-0 h-6 ${isHighlightActive ? "text-success" : "text-base-content/30 hover:text-base-content/60"} transition-colors`}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (isHighlightActive) {
                                                            // Toggle popover on the active column
                                                            setRowColorPopoverCol(rowColorPopoverCol === colIndex ? null : colIndex);
                                                        } else {
                                                            // Activate highlighting for this column and open popover
                                                            setRowColoringMode("by-field");
                                                            setRowColorFilter({
                                                                field: header,
                                                                operation: "contains",
                                                                value: "",
                                                                color: "rgba(59, 130, 246, 0.2)",
                                                            });
                                                            setRowColorPopoverCol(colIndex);
                                                        }
                                                    }}
                                                    title={isHighlightActive ? `Row highlighting filter for ${header}` : `Highlight rows by ${header}`}
                                                >
                                                    <svg
                                                        xmlns="http://www.w3.org/2000/svg"
                                                        className="h-3.5 w-3.5"
                                                        fill="none"
                                                        viewBox="0 0 24 24"
                                                        stroke="currentColor"
                                                    >
                                                        <path
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                            strokeWidth={2}
                                                            d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42"
                                                        />
                                                    </svg>
                                                </button>
                                                {/* Row highlighting dropdown */}
                                                {isHighlightActive && rowColorPopoverCol === colIndex && rowColorFilter && (
                                                    <div
                                                        className="absolute top-full mt-1 left-0 bg-base-100 border border-base-300 rounded-lg shadow-lg z-50 w-64 p-3"
                                                        onClick={(e) => e.stopPropagation()}
                                                        onMouseDown={(e) => e.stopPropagation()}
                                                    >
                                                        <div className="flex flex-col gap-3">
                                                            {/* Operation */}
                                                            <div>
                                                                <label className="text-xs text-base-content/60 font-medium mb-1 block">Operation</label>
                                                                <button
                                                                    className="btn btn-sm btn-outline w-full justify-start gap-2 font-mono"
                                                                    onClick={() => handleRowColorOperationChange(
                                                                        (["contains", "not-contains", "equals", "not-equals"] as const)[
                                                                            ((["contains", "not-contains", "equals", "not-equals"] as const).indexOf(rowColorFilter.operation) + 1) % 4
                                                                        ]
                                                                    )}
                                                                    title="Click to cycle operation"
                                                                >
                                                                    <span className="text-lg min-w-[1.5rem]">
                                                                        {{ "contains": "\u220B", "not-contains": "!\u220B", "equals": "=", "not-equals": "!=" }[rowColorFilter.operation]}
                                                                    </span>
                                                                    <span className="text-xs font-sans">
                                                                        {{ "contains": "Contains", "not-contains": "Not Contains", "equals": "Equals", "not-equals": "Not Equals" }[rowColorFilter.operation]}
                                                                    </span>
                                                                </button>
                                                            </div>

                                                            {/* Highlight text */}
                                                            <div>
                                                                <label className="text-xs text-base-content/60 font-medium mb-1 block">Highlight text</label>
                                                                <input
                                                                    type="text"
                                                                    className="input input-sm input-bordered w-full"
                                                                    placeholder="Filter text..."
                                                                    value={rowColorFilter.value}
                                                                    onChange={(e) => handleRowColorValueChange(e.target.value)}
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === "Escape") {
                                                                            setRowColorPopoverCol(null);
                                                                        }
                                                                    }}
                                                                    autoFocus
                                                                />
                                                            </div>

                                                            {/* Highlight color */}
                                                            <div>
                                                                <label className="text-xs text-base-content/60 font-medium mb-1 block">Highlight color</label>
                                                                <div className="grid grid-cols-6 gap-1.5">
                                                                    {[
                                                                        "rgba(239, 68, 68, 0.2)",
                                                                        "rgba(249, 115, 22, 0.2)",
                                                                        "rgba(234, 179, 8, 0.2)",
                                                                        "rgba(34, 197, 94, 0.2)",
                                                                        "rgba(59, 130, 246, 0.2)",
                                                                        "rgba(168, 85, 247, 0.2)",
                                                                    ].map((presetColor) => (
                                                                        <button
                                                                            key={presetColor}
                                                                            className={`w-8 h-8 rounded border-2 transition-colors ${rowColorFilter.color === presetColor ? "border-primary" : "border-base-300 hover:border-base-content/40"}`}
                                                                            style={{ backgroundColor: presetColor }}
                                                                            onClick={() => handleRowColorColorChange(presetColor)}
                                                                        />
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })()}

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

                    {/* Row number column header (right) */}
                    <div
                        className={`px-2 py-1 text-center text-xs font-bold border-l bg-base-300 ${showColumnSeparators ? "border-base-300" : "border-base-content/10"}`}
                        style={{ width: "64px", minWidth: "64px", maxWidth: "64px" }}
                    >
                        #
                    </div>
                </div>

                {/* Sticky group header - shows current group when scrolling */}
                {groupByColumn && stickyGroupLabel && (
                    <div
                        className="toolbar-bg border-t border-base-content/10 flex items-center gap-2 px-3 cursor-pointer select-none hover:bg-base-200/30 transition-colors"
                        style={{ height: `${GROUP_DIVIDER_HEIGHT}px` }}
                        onClick={() => stickyGroupLabel && toggleGroupCollapsed(stickyGroupLabel)}
                        title={collapsedGroups.has(stickyGroupLabel) ? `Expand "${stickyGroupLabel}"` : `Collapse "${stickyGroupLabel}"`}
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className={`h-3.5 w-3.5 text-base-content/50 transition-transform flex-shrink-0 ${collapsedGroups.has(stickyGroupLabel) ? "" : "rotate-90"}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        <span className="text-xs font-semibold text-base-content/70 truncate">
                            {stickyGroupLabel}
                        </span>
                        <div className="flex-1 border-b border-base-content/10" />
                    </div>
                )}
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
                    const rowIndex = visibleRowIndices[virtualRow.index];
                    const row = filteredData[rowIndex];
                    const hasDivider = dividerRows.has(rowIndex);
                    const dividerLabel = dividerLabels.get(rowIndex);
                    // Show inline divider for group transitions (but NOT for the first group,
                    // since the sticky header already shows the current group label)
                    const showDivider = hasDivider;
                    const groupValue = groupForRow.get(rowIndex) || "";
                    const isGroupCollapsed = groupByColumn !== null && collapsedGroups.has(groupValue);

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
                            }}
                        >
                            {/* Group-by divider with label and collapse toggle */}
                            {showDivider && dividerLabel && (
                                <div
                                    className={`flex items-center gap-2 px-3 cursor-pointer select-none toolbar-bg border-base-content/10 hover:bg-base-200/30 transition-colors ${hasDivider ? "border-t" : ""}`}
                                    style={{ height: `${GROUP_DIVIDER_HEIGHT}px` }}
                                    onClick={() => toggleGroupCollapsed(dividerLabel)}
                                    title={isGroupCollapsed ? `Expand "${dividerLabel}"` : `Collapse "${dividerLabel}"`}
                                >
                                    {/* Collapse/expand chevron */}
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        className={`h-3.5 w-3.5 text-base-content/50 transition-transform flex-shrink-0 ${isGroupCollapsed ? "" : "rotate-90"}`}
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                    {/* Group label */}
                                    <span className="text-xs font-semibold text-base-content/70 truncate">
                                        {dividerLabel}
                                    </span>
                                    {/* Horizontal line fill */}
                                    <div className="flex-1 border-b border-base-content/10" />
                                </div>
                            )}
                            {/* Only render the data row if the group is not collapsed */}
                            {!isGroupCollapsed && (
                            <div
                            style={rowStyle}
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
                                        return;
                                    }
                                    e.stopPropagation();
                                    // Don't preventDefault - it blocks drag start
                                }}
                                onDragStart={(e) => handleRowDragStart(e, rowIndex)}
                                onDragEnd={handleRowDragEnd}
                                onContextMenu={(e) => handleRowContextMenu(e, rowIndex)}
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

                                // Check if this cell is a search match (only highlight in cell view or all views)
                                const isCellSearch = searchContext === "cell" || searchContext === "all";
                                const isMatch = isCellSearch && matches.some((match) => match.row === rowIndex && match.col === colIndex);
                                const isCurrentMatch = isCellSearch &&
                                    currentMatchIndex >= 0 &&
                                    matches[currentMatchIndex]?.row === rowIndex &&
                                    matches[currentMatchIndex]?.col === colIndex;

                                // Check if this cell is cut
                                const isCut = cutCells?.some(
                                    (cutCell) => cutCell.row === rowIndex && cutCell.col === colIndex
                                );

                                // Check if this cell is a multi-cursor
                                const isMultiCursor = multiCursors.some(
                                    (cursor) => cursor.row === rowIndex && cursor.col === colIndex
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
                                } else if (isMultiCursor) {
                                    // Multi-cursor: dashed outline with lighter background
                                    cellClass += " ring-2 ring-dashed ring-primary/60 bg-primary/5";
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

                                // Check if text is long enough to wrap to multiple lines
                                const availableWidth = columnWidth - 24; // subtract padding
                                const avgCharWidth = 7.5; // approximate average character width
                                const charsPerLine = Math.floor(availableWidth / avgCharWidth);
                                const wouldWrapMultipleLines = value.length > charsPerLine;

                                const shouldUseTextarea = wrapText || cellHasNewlines || wouldWrapMultipleLines;

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

                                        {isEditing && editingSource === "cell" && !popoutEditPosition ? (
                                            <>
                                                {/* Invisible spacer div: keeps the cell at the exact same height
                                                    as before editing started, preventing any visual resizing. */}
                                                <div
                                                    className={`px-3 py-2 min-h-[40px] text-sm leading-tight flex items-center ${wrapText ? "whitespace-normal" : "whitespace-nowrap overflow-hidden text-ellipsis"}`}
                                                    style={{ visibility: "hidden" }}
                                                    aria-hidden="true"
                                                >
                                                    {editingValue || value}
                                                </div>
                                                {shouldUseTextarea ? (
                                                    <textarea
                                                        ref={(el) => {
                                                            editingInputRef.current = el;
                                                        }}
                                                        rows={1}
                                                        className="absolute inset-0 w-full h-full focus:outline-none border-none bg-transparent px-3 py-2 text-sm leading-tight resize-none overflow-hidden"
                                                        style={{ userSelect: "text", WebkitUserSelect: "text" }}
                                                        value={editingValue}
                                                        onChange={(e) => {
                                                            updateEditingValue(e.target.value);
                                                            if (editingCell) {
                                                                updateAutocompleteSuggestions(editingCell.col, e.target.value);
                                                            }
                                                        }}
                                                        onClick={(e) => e.stopPropagation()}
                                                        onMouseDown={(e) => {
                                                            e.stopPropagation();
                                                            e.nativeEvent.stopImmediatePropagation();
                                                        }}
                                                        onKeyDown={(e) => handleKeyDown(e, rowIndex, colIndex)}
                                                        autoFocus
                                                    />
                                                ) : (
                                                    <input
                                                        ref={(el) => {
                                                            editingInputRef.current = el;
                                                        }}
                                                        type="text"
                                                        className="absolute inset-0 w-full h-full focus:outline-none border-none bg-transparent px-3 py-2 text-sm leading-tight"
                                                        style={{ userSelect: "text", WebkitUserSelect: "text" }}
                                                        value={editingValue}
                                                        onChange={(e) => {
                                                            updateEditingValue(e.target.value);
                                                            if (editingCell) {
                                                                updateAutocompleteSuggestions(editingCell.col, e.target.value);
                                                            }
                                                        }}
                                                        onClick={(e) => e.stopPropagation()}
                                                        onMouseDown={(e) => {
                                                            e.stopPropagation();
                                                            e.nativeEvent.stopImmediatePropagation();
                                                        }}
                                                        onKeyDown={(e) => handleKeyDown(e, rowIndex, colIndex)}
                                                        autoFocus
                                                    />
                                                )}
                                            </>
                                        ) : (
                                            <div
                                                className={`px-3 py-2 min-h-[40px] text-sm leading-tight flex items-center ${wrapText ? "whitespace-normal" : "whitespace-nowrap overflow-hidden text-ellipsis"} ${isEditing && editingSource === "print" ? "bg-primary/10" : ""} ${isEditing && editingSource === "cell" && popoutEditPosition ? "bg-primary/10 ring-2 ring-primary/30 ring-inset" : ""}`}
                                            >
                                                {isEditing && editingSource === "print" ? editingValue : value}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}

                            {/* Row number (right) */}
                            <div
                                className={`p-2 text-center font-mono text-sm bg-base-200/50 border-b border-l cursor-move ${showColumnSeparators ? "border-base-300" : "border-base-content/10"}`}
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
                                        return;
                                    }
                                    e.stopPropagation();
                                    // Don't preventDefault - it blocks drag start
                                }}
                                onDragStart={(e) => handleRowDragStart(e, rowIndex)}
                                onDragEnd={handleRowDragEnd}
                                onContextMenu={(e) => handleRowContextMenu(e, rowIndex)}
                            >
                                <div className="flex items-center justify-center gap-1" style={{ pointerEvents: "none" }}>
                                    {rowIndex + 1}
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-base-content/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                    </svg>
                                </div>
                            </div>
                        </div>
                        )}
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
            {contextMenu && (
                <ContextMenu
                    position={{ x: contextMenu.x, y: contextMenu.y }}
                    isMultiCell={selectedRange !== null}
                    onAction={handleContextMenuAction}
                />
            )}

            {/* Row/Column Context Menu */}
            {rcContextMenu && (
                <RowColumnContextMenu
                    position={{ x: rcContextMenu.x, y: rcContextMenu.y }}
                    type={rcContextMenu.type}
                    onAction={handleRcContextMenuAction}
                />
            )}

            {/* Multi-Cell Fill Dialog */}
            {showFillDialog && selectedRange && (
                <FillDialog
                    selectedRange={selectedRange}
                    updateCells={updateCells}
                    triggerAutosave={triggerAutosave}
                    onClose={() => setShowFillDialog(false)}
                />
            )}

            {/* Summary row */}
            <SummaryRow
                parentRef={parentRef}
                headers={headers}
                filteredData={filteredData}
                pixelWidths={pixelWidths}
                columnSummaries={columnSummaries}
                setColumnSummary={setColumnSummary}
                hoveredColumn={hoveredColumn}
                showColumnSeparators={showColumnSeparators}
                autoFitColumns={autoFitColumns}
                drawerPosition={drawerPosition}
                rightDrawerSize={rightDrawerSize}
            />

            {/* Popout edit box for multi-line cells when wrap text is off */}
            {popoutEditPosition && editingCell && (
                <PopoutEditBox
                    position={popoutEditPosition}
                    editingValue={editingValue}
                    editingCell={editingCell}
                    updateEditingValue={updateEditingValue}
                    inputRefCallback={(el) => { editingInputRef.current = el; }}
                    onKeyDown={handleKeyDown}
                    onInputChange={updateAutocompleteSuggestions}
                />
            )}

            {/* Autocomplete dropdown */}
            {showAutocomplete && editingCell && editingCellRef.current && (
                <AutocompleteDropdown
                    suggestions={autocompleteSuggestions}
                    selectedIndex={autocompleteSelectedIndex}
                    onSelect={(value) => {
                        updateEditingValue(value);
                        closeAutocomplete();
                    }}
                    onClose={closeAutocomplete}
                    onNavigate={navigateAutocomplete}
                    position={{
                        top: editingCellRef.current.getBoundingClientRect().bottom + window.scrollY,
                        left: editingCellRef.current.getBoundingClientRect().left + window.scrollX,
                        width: editingCellRef.current.getBoundingClientRect().width,
                        maxHeight: 300,
                    }}
                />
            )}
        </div>
    );
}

export default CellGridVirtualized;
