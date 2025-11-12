/**
 * CSV Grid Component
 *
 * Editable spreadsheet-like grid for viewing and editing CSV data.
 * Supports cell selection, multi-cell selection, copy/paste, drag-and-drop reordering,
 * filtering, summaries, and comprehensive keyboard shortcuts.
 */

import { useState, useMemo, useEffect, useRef } from "react";
import { useCSVStore } from "@stores/csvStore";
import { useSettingsStore } from "@stores/settingsStore";
import { useFindReplaceStore } from "@stores/findReplaceStore";
import { useDrawerStore } from "@stores/drawerStore";
import ColumnFilterDropdown from "./ColumnFilterDropdown";
import { calculateSummary } from "@utils/summaryCalculations";

interface CSVGridProps {
    onCellEdit?: (row: number, col: number, value: string) => void;
}

/**
 * CSVGrid component - displays CSV data in an editable table
 */
function CSVGrid({ onCellEdit }: CSVGridProps) {
    const {
        headers,
        data,
        updateCell,
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
        pasteClipboard,
        columnFilters,
        setColumnFilter,
        clearColumnFilter,
        columnSummaries,
        setColumnSummary,
        reorderRows,
        reorderColumns,
        addRow,
        addColumn,
    } = useCSVStore();

    const {
        showColumnSeparators,
        wrapText,
        rowColoringMode,
        rowColorFilter,
        csvFollowsPrintEdit,
    } = useSettingsStore();

    const { matches, currentMatchIndex } = useFindReplaceStore();

    const { position: drawerPosition, rightDrawerSize, bottomDrawerSize } = useDrawerStore();

    // Selection state for drag selection
    const [isSelecting, setIsSelecting] = useState(false);
    const [selectionStart, setSelectionStart] = useState<{ row: number; col: number } | null>(null);

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

    // Scroll indicators
    const [showLeftScrollIndicator, setShowLeftScrollIndicator] = useState(false);
    const [showRightScrollIndicator, setShowRightScrollIndicator] = useState(false);

    // Summary row positioning
    const [summaryRowLeftOffset, setSummaryRowLeftOffset] = useState(0);
    const [summaryRowScrollLeft, setSummaryRowScrollLeft] = useState(0);

    // Column resizing
    const [columnWidths, setColumnWidths] = useState<Record<number, number>>({});
    const [resizingColumn, setResizingColumn] = useState<number | null>(null);
    const [resizeStartX, setResizeStartX] = useState(0);
    const [resizeStartWidth, setResizeStartWidth] = useState(0);

    // Refs
    const tableContainerRef = useRef<HTMLDivElement>(null);
    const gridFocusRef = useRef<HTMLDivElement>(null);
    const summaryRowRef = useRef<HTMLDivElement>(null);
    const summaryRowContentRef = useRef<HTMLDivElement>(null);
    const rowRefs = useRef<Map<number, HTMLTableRowElement>>(new Map());

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

    // Handle global mouseup for selection
    useEffect(() => {
        const handleMouseUp = () => {
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
            if (editingCell && editingSource === "csv") {
                const target = e.target as HTMLElement;
                // Check if click is outside the editing input/textarea
                if (!target.closest("input[type='text']") && !target.closest("textarea")) {
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
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

            // Ignore if editing cell from Print view
            if (editingCell && editingSource === "print") return;

            // Ignore if the grid doesn't have focus (e.g., Print view is focused)
            if (gridFocusRef.current && document.activeElement !== gridFocusRef.current) {
                // Only handle if we're not focused, unless we have a selected cell and no other element has focus
                const hasFocus = gridFocusRef.current.contains(document.activeElement);
                if (!hasFocus && document.activeElement !== document.body) {
                    return;
                }
            }

            // Ignore if editing cell
            if (editingCell) return;

            // Arrow key navigation
            if (selectedCell && !e.ctrlKey && !e.shiftKey && !e.altKey) {
                let newRow = selectedCell.row;
                let newCol = selectedCell.col;

                if (e.key === "ArrowUp") {
                    newRow = Math.max(0, selectedCell.row - 1);
                    e.preventDefault();
                } else if (e.key === "ArrowDown") {
                    newRow = Math.min(filteredData.length - 1, selectedCell.row + 1);
                    e.preventDefault();
                } else if (e.key === "ArrowLeft") {
                    newCol = Math.max(0, selectedCell.col - 1);
                    e.preventDefault();
                } else if (e.key === "ArrowRight") {
                    newCol = Math.min(headers.length - 1, selectedCell.col + 1);
                    e.preventDefault();
                }

                if (newRow !== selectedCell.row || newCol !== selectedCell.col) {
                    setSelectedCell(newRow, newCol);
                }
            }

            // F2 or Enter to edit
            if ((e.key === "F2" || e.key === "Enter") && selectedCell && !e.ctrlKey) {
                const value = filteredData[selectedCell.row]?.[selectedCell.col] || "";
                handleStartEdit(selectedCell.row, selectedCell.col, value);
                e.preventDefault();
            }

            // Escape to clear selection
            if (e.key === "Escape") {
                clearSelection();
            }

            // Ctrl+C to copy
            if (e.ctrlKey && e.key === "c") {
                copySelection();
                e.preventDefault();
            }

            // Ctrl+V to paste
            if (e.ctrlKey && e.key === "v") {
                pasteClipboard();
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
        };

        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [editingCell, editingSource, selectedCell, selectedRange, filteredData, headers, copySelection, pasteClipboard, clearSelection, setSelectedCell, addRow]);

    // Scroll to row when editing from Print view
    useEffect(() => {
        if (editingCell && editingSource === "print" && tableContainerRef.current && csvFollowsPrintEdit) {
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
    }, [editingCell, editingSource, csvFollowsPrintEdit]);

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

    // Column resizing effect
    useEffect(() => {
        if (resizingColumn === null) return;

        // Prevent text selection while resizing
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'col-resize';

        const handleMouseMove = (e: MouseEvent) => {
            const deltaX = e.clientX - resizeStartX;
            const newWidth = Math.max(100, resizeStartWidth + deltaX);
            setColumnWidths(prev => ({
                ...prev,
                [resizingColumn]: newWidth
            }));
        };

        const handleMouseUp = () => {
            setResizingColumn(null);
            document.body.style.userSelect = '';
            document.body.style.cursor = '';
        };

        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);

        return () => {
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
            document.body.style.userSelect = '';
            document.body.style.cursor = '';
        };
    }, [resizingColumn, resizeStartX, resizeStartWidth]);

    // Disable text selection during drag operations
    useEffect(() => {
        if (!isDraggingRow && !isDraggingColumn) return;

        // Prevent text selection while dragging
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'grabbing';

        return () => {
            document.body.style.userSelect = '';
            document.body.style.cursor = '';
        };
    }, [isDraggingRow, isDraggingColumn]);

    // Column resize handlers
    const handleColumnResizeStart = (e: React.MouseEvent, colIndex: number) => {
        e.preventDefault();
        e.stopPropagation();

        const currentWidth = columnWidths[colIndex] || 150; // Default width
        setResizingColumn(colIndex);
        setResizeStartX(e.clientX);
        setResizeStartWidth(currentWidth);
    };

    // Start editing a cell
    const handleStartEdit = (row: number, col: number, value: string) => {
        setEditingCell(row, col, value);
    };

    // Save edited cell value
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
    const handleCellMouseDown = (row: number, col: number) => {
        if (gridFocusRef.current) {
            gridFocusRef.current.focus();
        }
        setIsSelecting(true);
        setSelectionStart({ row, col });
        setSelectedCell(row, col);
    };

    const handleCellMouseEnter = (row: number, col: number) => {
        if (isSelecting && selectionStart) {
            // Only create range if moved to different cell
            if (row !== selectionStart.row || col !== selectionStart.col) {
                setSelectedRange(selectionStart.row, selectionStart.col, row, col);
            }
        }
    };

    // Row drag and drop handlers
    const handleRowDragStart = (e: React.DragEvent, rowIndex: number) => {
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
    const containerStyle: React.CSSProperties = {
        width: drawerPosition === "right" ? `calc(100% - ${rightDrawerSize}px)` : '100%',
        height: drawerPosition === "bottom"
            ? `calc(100% - ${bottomDrawerSize}px - ${summaryRowHeight}px)`
            : `calc(100% - ${summaryRowHeight}px)`,
        paddingBottom: '20px', // Small padding for content breathing room
        userSelect: (isSelecting || isDraggingRow || isDraggingColumn) ? 'none' : 'auto',
        WebkitUserSelect: (isSelecting || isDraggingRow || isDraggingColumn) ? 'none' : 'auto',
        position: 'relative',
    };

    return (
        <div
            className="csv-grid-container overflow-scroll relative outline-none"
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

                // Keep focus on grid when clicking anywhere inside it
                if (gridFocusRef.current) {
                    gridFocusRef.current.focus();
                }
            }}
            onMouseDown={(e) => {
                // Don't interfere with draggable elements
                const target = e.target as HTMLElement;
                const draggableElement = target.closest('[draggable="true"]');
                if (draggableElement) {
                    return; // Let the drag operation handle it
                }

                // Ensure grid gets focus on any mousedown
                if (gridFocusRef.current) {
                    gridFocusRef.current.focus();
                }
            }}
            onWheel={(e) => {
                // Shift + scroll for horizontal scrolling
                if (e.shiftKey && tableContainerRef.current) {
                    e.preventDefault();
                    tableContainerRef.current.scrollLeft += e.deltaY;
                }
            }}
            style={containerStyle}
        >
            {/* Force scrollbars to always be visible and hide scrollbar for summary row */}
            <style>{`
                .csv-grid-container {
                    overflow: scroll !important;
                    scrollbar-width: thin; /* Firefox - always show */
                    scrollbar-gutter: stable both-edges; /* Reserve space for scrollbar */
                    -webkit-overflow-scrolling: touch;
                }

                /* Force scrollbar to always be visible in Webkit browsers */
                .csv-grid-container::-webkit-scrollbar {
                    -webkit-appearance: none;
                    width: 14px;
                    height: 14px;
                }

                .csv-grid-container::-webkit-scrollbar-track {
                    background: oklch(var(--b2));
                    border: 1px solid oklch(var(--bc) / 0.1);
                }

                .csv-grid-container::-webkit-scrollbar-thumb {
                    background: oklch(var(--bc) / 0.4);
                    border-radius: 7px;
                    border: 2px solid oklch(var(--b2));
                    min-height: 30px;
                    min-width: 30px;
                }

                .csv-grid-container::-webkit-scrollbar-thumb:hover {
                    background: oklch(var(--bc) / 0.6);
                }

                .csv-grid-container::-webkit-scrollbar-thumb:active {
                    background: oklch(var(--bc) / 0.7);
                }

                .csv-grid-container::-webkit-scrollbar-corner {
                    background: oklch(var(--b2));
                }

                .summary-row-scroll::-webkit-scrollbar {
                    display: none;
                }
            `}</style>
            {/* Left scroll indicator */}
            {showLeftScrollIndicator && (
                <div
                    className="absolute left-0 top-0 bottom-0 w-8 pointer-events-none z-30"
                    style={{
                        background: 'linear-gradient(to right, rgba(0, 0, 0, 0.15), transparent)',
                    }}
                />
            )}

            {/* Right scroll indicator */}
            {showRightScrollIndicator && (
                <div
                    className="absolute right-0 top-0 bottom-0 w-8 pointer-events-none z-30"
                    style={{
                        background: 'linear-gradient(to left, rgba(0, 0, 0, 0.15), transparent)',
                    }}
                />
            )}

            <table
                className="table table-xs"
                style={{
                    tableLayout: 'fixed',
                    width: `${64 + headers.reduce((sum, _, idx) => sum + (columnWidths[idx] || 150), 0)}px`
                }}
            >
                <thead>
                    <tr>
                        {/* Row number header */}
                        <th className="bg-base-300 text-center sticky left-0 top-0 z-30" style={{ width: '64px', minWidth: '64px', maxWidth: '64px' }}>#</th>

                        {/* Column headers */}
                        {headers.map((header, colIndex) => {
                            const columnWidth = columnWidths[colIndex] || 150;
                            return (
                                <th
                                    key={colIndex}
                                    className={`bg-base-300 font-bold relative sticky top-0 z-20 ${dropTargetColumn === colIndex ? "border-l-4 border-primary" : ""}`}
                                    style={{ width: `${columnWidth}px`, minWidth: `${columnWidth}px`, maxWidth: `${columnWidth}px` }}
                                    onDragOver={(e) => handleColumnDragOver(e, colIndex)}
                                    onDrop={(e) => handleColumnDrop(e, colIndex)}
                                >
                                    <div className="flex items-center gap-2 justify-between">
                                        {/* Drag handle */}
                                        <div
                                            draggable={true}
                                            onMouseDown={(e) => {
                                                e.stopPropagation();
                                                // Don't preventDefault - it blocks drag start
                                            }}
                                            onDragStart={(e) => handleColumnDragStart(e, colIndex)}
                                            onDragEnd={handleColumnDragEnd}
                                            className="cursor-move text-base-content/30 hover:text-base-content relative z-10"
                                            style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ pointerEvents: 'none' }}>
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
                                        style={{ marginRight: '-4px', paddingLeft: '3px', paddingRight: '3px' }}
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
                        let rowStyle: React.CSSProperties = {};

                        if (rowColoringMode === "by-field" && rowMatchesFilter(row)) {
                            rowStyle.backgroundColor = rowColorFilter?.color;
                        } else if (rowColoringMode === "alternating" && rowIndex % 2 === 1) {
                            rowBgClass = "bg-base-200/50";
                        }

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
                                className={`hover:bg-base-200/70 ${rowBgClass} ${dropTargetRow === rowIndex ? "border-t-4 border-primary" : ""}`}
                                style={rowStyle}
                                onDragOver={(e) => handleRowDragOver(e, rowIndex)}
                                onDrop={(e) => handleRowDrop(e, rowIndex)}
                            >
                                {/* Row number */}
                                <td
                                    className={`bg-base-200 text-center font-mono text-sm border-r-2 ${showColumnSeparators ? "border-base-300" : "border-transparent"} sticky left-0 z-10 cursor-move`}
                                    style={{ width: '64px', minWidth: '64px', maxWidth: '64px', userSelect: 'none', WebkitUserSelect: 'none' }}
                                    draggable={true}
                                    onMouseDown={(e) => {
                                        e.stopPropagation();
                                        // Don't preventDefault - it blocks drag start
                                    }}
                                    onDragStart={(e) => handleRowDragStart(e, rowIndex)}
                                    onDragEnd={handleRowDragEnd}
                                    onContextMenu={(e) => handleContextMenu(e, rowIndex, undefined)}
                                >
                                    <div className="flex items-center justify-center gap-1" style={{ pointerEvents: 'none' }}>
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

                                    // Determine cell class
                                    let cellClass = "p-0";
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

                                    // Add drop target indicator (full height column line)
                                    if (dropTargetColumn === colIndex) {
                                        cellClass += " border-l-4 border-primary";
                                    }

                                    if (colIndex < row.length - 1) {
                                        cellClass += ` border-r-2 ${showColumnSeparators ? "border-base-300" : "border-transparent"}`;
                                    }

                                    const columnWidth = columnWidths[colIndex] || 150;

                                    // Determine if this cell should be edited with multi-line support
                                    const cellHasNewlines = cell.includes('\n');
                                    const shouldUseTextarea = wrapText || cellHasNewlines;

                                    return (
                                        <td
                                            key={colIndex}
                                            className={`${cellClass} relative`}
                                            style={{ width: `${columnWidth}px`, minWidth: `${columnWidth}px`, maxWidth: `${columnWidth}px` }}
                                            onMouseDown={() => handleCellMouseDown(rowIndex, colIndex)}
                                            onMouseEnter={() => handleCellMouseEnter(rowIndex, colIndex)}
                                            onContextMenu={(e) => handleContextMenu(e, rowIndex, colIndex)}
                                        >
                                            {/* "Editing from Print" overlay indicator */}
                                            {isEditing && editingSource === "print" && (
                                                <div className="absolute -top-5 left-0 text-xs text-primary/70 italic bg-base-100/90 px-2 py-0.5 rounded shadow-sm border border-primary/20 z-10 whitespace-nowrap">
                                                    (editing from Print)
                                                </div>
                                            )}

                                            {isEditing && editingSource === "csv" ? (
                                                shouldUseTextarea ? (
                                                    <textarea
                                                        className="w-full focus:outline-none border-none bg-transparent px-3 py-2 min-h-[40px] text-sm leading-tight resize-none overflow-hidden"
                                                        value={editingValue}
                                                        onChange={(e) => {
                                                            updateEditingValue(e.target.value);
                                                            // Auto-resize textarea to fit content
                                                            e.target.style.height = "auto";
                                                            e.target.style.height = `${e.target.scrollHeight}px`;
                                                        }}
                                                        onBlur={() => handleSaveEdit(rowIndex, colIndex)}
                                                        onKeyDown={(e) => handleKeyDown(e, rowIndex, colIndex)}
                                                        onInput={(e) => {
                                                            // Auto-resize on input as well
                                                            const target = e.target as HTMLTextAreaElement;
                                                            target.style.height = "auto";
                                                            target.style.height = `${target.scrollHeight}px`;
                                                        }}
                                                        autoFocus
                                                        ref={(el) => {
                                                            if (el) {
                                                                // Initial resize
                                                                el.style.height = "auto";
                                                                el.style.height = `${el.scrollHeight}px`;
                                                                // Place cursor at end
                                                                el.setSelectionRange(el.value.length, el.value.length);
                                                            }
                                                        }}
                                                    />
                                                ) : (
                                                    <input
                                                        type="text"
                                                        className="w-full focus:outline-none border-none bg-transparent px-3 py-2 min-h-[40px] text-sm leading-tight"
                                                        value={editingValue}
                                                        onChange={(e) => updateEditingValue(e.target.value)}
                                                        onBlur={() => handleSaveEdit(rowIndex, colIndex)}
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
                    height: '60px',
                    overflow: 'hidden'
                }}
            >
                {/* Row number column placeholder - sticky */}
                <div className="absolute left-0 h-full bg-base-300 border-r-2 border-base-300 z-10" style={{ width: '64px' }}></div>

                <div
                    ref={summaryRowContentRef}
                    className="h-full summary-row-scroll"
                    style={{
                        overflowX: 'scroll',
                        overflowY: 'hidden',
                        scrollbarWidth: 'none', /* Firefox */
                        msOverflowStyle: 'none', /* IE and Edge */
                        paddingLeft: '64px'
                    }}
                >
                    <div className="flex items-center h-full" style={{ width: `${headers.reduce((sum, _, idx) => sum + (columnWidths[idx] || 150), 0)}px` }}>
                    {/* Summary dropdowns for each column */}
                    {headers.map((columnName, colIndex) => {
                        const summaryType = columnSummaries[columnName] || "count";
                        const columnData = filteredData.map((row) => row[colIndex] || "");
                        const summaryValue = calculateSummary(columnData, summaryType);
                        const columnWidth = columnWidths[colIndex] || 150;

                        return (
                            <div
                                key={colIndex}
                                className={`flex-shrink-0 h-full flex items-center border-r-2 ${showColumnSeparators ? "border-base-300" : "border-transparent"}`}
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
                                            onChange={(e) => setColumnSummary(columnName, e.target.value as any)}
                                            style={{
                                                appearance: 'none',
                                                backgroundImage: 'url("data:image/svg+xml,%3csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 20 20\'%3e%3cpath stroke=\'%236b7280\' stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'1.5\' d=\'M6 8l4-4 4 4\'/%3e%3c/svg%3e")',
                                                backgroundPosition: 'right 0.5rem center',
                                                backgroundRepeat: 'no-repeat',
                                                backgroundSize: '1.5em 1.5em',
                                                paddingRight: '2.5rem'
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
                        <li>
                            <a
                                onClick={() => {
                                    copySelection();
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
                                    pasteClipboard();
                                    setContextMenu(null);
                                }}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                </svg>
                                Paste
                            </a>
                        </li>
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
        </div>
    );
}

export default CSVGrid;
