/**
 * CSV Grid Component
 *
 * Editable spreadsheet-like grid for viewing and editing CSV data.
 * Uses TanStack Table for data management and rendering.
 */

import { useState, useMemo, useEffect } from "react";
import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    flexRender,
    ColumnDef,
    ColumnResizeMode,
    SortingState,
} from "@tanstack/react-table";
import { useCSVStore } from "@stores/csvStore";
import { useSettingsStore } from "@stores/settingsStore";
import { useFindReplaceStore } from "@stores/findReplaceStore";
import { useDrag } from "@/contexts/DragContext";

interface CSVGridProps {
    onCellEdit?: (row: number, col: number, value: string) => void;
}

/**
 * CSVGrid component - displays CSV data in an editable table
 */
function CSVGrid({ onCellEdit }: CSVGridProps) {
    const { headers, data, updateCell } = useCSVStore();
    const {
        showColumnSeparators,
        wrapText,
        rowColoringMode,
        rowColorFilter,
    } = useSettingsStore();
    const { matches, currentMatchIndex } = useFindReplaceStore();
    const { isDragging, startDrag, endDrag } = useDrag();
    const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null);
    const [editValue, setEditValue] = useState("");
    const [sorting, setSorting] = useState<SortingState>([]);

    // Create columns from headers
    const columns = useMemo<ColumnDef<string[]>[]>(() => {
        return headers.map((header, colIndex) => ({
            id: `col-${colIndex}`,
            header: header,
            accessorFn: (row) => row[colIndex],
            cell: ({ row: tableRow }) => {
                const rowIndex = tableRow.index;
                const value = tableRow.original[colIndex] || "";
                const isEditing =
                    editingCell?.row === rowIndex && editingCell?.col === colIndex;

                // Check if this cell is a search match
                const isMatch = matches.some(
                    (match) => match.row === rowIndex && match.col === colIndex
                );
                const isCurrentMatch =
                    currentMatchIndex >= 0 &&
                    matches[currentMatchIndex]?.row === rowIndex &&
                    matches[currentMatchIndex]?.col === colIndex;

                // Determine background class for highlighting
                let highlightClass = "";
                if (isCurrentMatch) {
                    highlightClass = "bg-warning/60"; // Current match - bright highlight
                } else if (isMatch) {
                    highlightClass = "bg-warning/20"; // Other matches - dimmer highlight
                }

                return (
                    <div
                        className="cell-wrapper w-full"
                        onClick={() => handleStartEdit(rowIndex, colIndex, value)}
                    >
                        {isEditing ? (
                            <input
                                type="text"
                                className="w-full focus:outline-none border-none bg-transparent px-2 py-1 min-h-[32px] text-sm"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={() => handleSaveEdit(rowIndex, colIndex)}
                                onKeyDown={(e) => handleKeyDown(e, rowIndex, colIndex)}
                                autoFocus
                            />
                        ) : (
                            <div
                                className={`cell-content px-2 py-1 min-h-[32px] cursor-pointer text-sm ${wrapText ? "break-words" : "truncate"} ${highlightClass}`}
                            >
                                {value}
                            </div>
                        )}
                    </div>
                );
            },
        }));
    }, [headers, editingCell, editValue, matches, currentMatchIndex, wrapText]);

    // Column resize mode
    const [columnResizeMode] = useState<ColumnResizeMode>("onChange");

    // Check if row matches filter
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

    // Create table instance
    const table = useReactTable({
        data,
        columns,
        columnResizeMode,
        defaultColumn: {
            size: 200,
            minSize: 100,
            maxSize: 800,
        },
        state: {
            sorting,
        },
        onSortingChange: setSorting,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
    });

    // Track column resize state
    useEffect(() => {
        const isResizing = table.getState().columnSizingInfo.isResizingColumn;

        if (isResizing) {
            startDrag("column-resize");
        } else if (isDragging) {
            // Only end drag if we were dragging columns
            endDrag();
        }
    }, [table.getState().columnSizingInfo.isResizingColumn]);

    // Start editing a cell
    const handleStartEdit = (row: number, col: number, value: string) => {
        setEditingCell({ row, col });
        setEditValue(value);
    };

    // Save edited cell value
    const handleSaveEdit = (row: number, col: number) => {
        if (editingCell) {
            updateCell(row, col, editValue);
            if (onCellEdit) {
                onCellEdit(row, col, editValue);
            }
        }
        setEditingCell(null);
        setEditValue("");
    };

    // Handle keyboard navigation and shortcuts
    const handleKeyDown = (
        e: React.KeyboardEvent<HTMLInputElement>,
        row: number,
        col: number
    ) => {
        if (e.key === "Enter") {
            e.preventDefault();
            handleSaveEdit(row, col);

            if (e.shiftKey) {
                // Shift+Enter: Move to previous row, same column
                if (row > 0) {
                    const prevValue = data[row - 1][col] || "";
                    handleStartEdit(row - 1, col, prevValue);
                }
            } else {
                // Enter: Move to next row, same column
                if (row < data.length - 1) {
                    const nextValue = data[row + 1][col] || "";
                    handleStartEdit(row + 1, col, nextValue);
                }
            }
        } else if (e.key === "Escape") {
            e.preventDefault();
            setEditingCell(null);
            setEditValue("");
        } else if (e.key === "Tab") {
            e.preventDefault();
            handleSaveEdit(row, col);

            if (e.shiftKey) {
                // Shift+Tab: Move to previous column (or previous row if at start)
                if (col > 0) {
                    const prevValue = data[row][col - 1] || "";
                    handleStartEdit(row, col - 1, prevValue);
                } else if (row > 0) {
                    const prevValue = data[row - 1][headers.length - 1] || "";
                    handleStartEdit(row - 1, headers.length - 1, prevValue);
                }
            } else {
                // Tab: Move to next column (or next row if at end)
                if (col < headers.length - 1) {
                    const nextValue = data[row][col + 1] || "";
                    handleStartEdit(row, col + 1, nextValue);
                } else if (row < data.length - 1) {
                    const nextValue = data[row + 1][0] || "";
                    handleStartEdit(row + 1, 0, nextValue);
                }
            }
        }
    };

    if (headers.length === 0) {
        return (
            <div className="flex items-center justify-center h-full text-base-content/50">
                <p>No data to display</p>
            </div>
        );
    }

    return (
        <div className="csv-grid-container overflow-auto w-full h-full">
            <table className="table table-pin-rows table-pin-cols" style={{ tableLayout: "fixed", width: `${table.getTotalSize() + 64}px` }}>
                <thead>
                    {table.getHeaderGroups().map((headerGroup) => (
                        <tr key={headerGroup.id}>
                            {/* Row number column */}
                            <th className="bg-base-300 text-center w-16">#</th>

                            {/* Data columns */}
                            {headerGroup.headers.map((header) => {
                                const sortIndex = sorting.findIndex((s) => s.id === header.id);
                                const isSorted = sortIndex !== -1;
                                const sortDirection = isSorted ? sorting[sortIndex].desc ? "desc" : "asc" : null;

                                return (
                                    <th
                                        key={header.id}
                                        className="bg-base-300 font-bold relative cursor-pointer hover:bg-base-200"
                                        style={{
                                            width: `${header.getSize()}px`,
                                        }}
                                        onClick={(e) => {
                                            // Don't sort if we're dragging
                                            if (isDragging) {
                                                e.preventDefault();
                                                return;
                                            }
                                            const handler = header.column.getToggleSortingHandler();
                                            if (handler) handler(e);
                                        }}
                                    >
                                        <div className="flex items-center gap-2">
                                            {flexRender(
                                                header.column.columnDef.header,
                                                header.getContext()
                                            )}
                                            {/* Sort indicator */}
                                            {isSorted && (
                                                <div className="flex items-center gap-1">
                                                    {sortDirection === "asc" ? (
                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                                        </svg>
                                                    ) : (
                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                        </svg>
                                                    )}
                                                    {sorting.length > 1 && (
                                                        <span className="text-xs bg-primary text-primary-content rounded-full w-5 h-5 flex items-center justify-center">
                                                            {sortIndex + 1}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        {/* Resize handle */}
                                        <div
                                            onMouseDown={(e) => {
                                                e.stopPropagation();
                                                header.getResizeHandler()(e);
                                            }}
                                            onTouchStart={(e) => {
                                                e.stopPropagation();
                                                header.getResizeHandler()(e);
                                            }}
                                            className={`absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none hover:bg-primary ${
                                                header.column.getIsResizing() ? "bg-primary" : ""
                                            }`}
                                        />
                                    </th>
                                );
                            })}
                        </tr>
                    ))}
                </thead>
                <tbody>
                    {table.getRowModel().rows.map((row, idx) => {
                        // Determine row background color
                        let rowBgClass = "";
                        let rowStyle: React.CSSProperties = {};

                        if (rowColoringMode === "by-field" && rowMatchesFilter(row.original)) {
                            rowStyle.backgroundColor = rowColorFilter?.color;
                        } else if (rowColoringMode === "alternating" && idx % 2 === 1) {
                            rowBgClass = "bg-base-150";
                        }

                        return (
                            <tr key={row.id} className={`hover:bg-base-250 ${rowBgClass}`} style={rowStyle}>
                                {/* Row number */}
                                <td className={`bg-base-200 text-center font-mono text-sm border-r-2 ${showColumnSeparators ? "border-base-300" : "border-transparent"}`}>
                                    {row.index + 1}
                                </td>

                                {/* Data cells */}
                                {row.getVisibleCells().map((cell, cellIdx) => (
                                    <td
                                        key={cell.id}
                                        className={`p-0 ${cellIdx < row.getVisibleCells().length - 1 ? `border-r-2 ${showColumnSeparators ? "border-base-300" : "border-transparent"}` : ""}`}
                                    >
                                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                    </td>
                                ))}
                            </tr>
                        );
                    })}
                </tbody>
            </table>

            {/* Empty state when no rows */}
            {data.length === 0 && (
                <div className="text-center py-8 text-base-content/50">
                    <p>No rows in this CSV file</p>
                </div>
            )}
        </div>
    );
}

export default CSVGrid;
