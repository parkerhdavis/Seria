/**
 * Virtualized CSV Grid Component
 *
 * Performance-optimized version of CSVGrid using virtualization
 * for handling large CSV files (1000+ rows) efficiently.
 */

import { useState, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useCSVStore } from "@stores/csvStore";

interface CSVGridVirtualizedProps {
    onCellEdit?: (row: number, col: number, value: string) => void;
}

/**
 * Virtualized CSV Grid - only renders visible rows for performance
 */
function CSVGridVirtualized({ onCellEdit }: CSVGridVirtualizedProps) {
    const { headers, data, updateCell } = useCSVStore();
    const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null);
    const [editValue, setEditValue] = useState("");

    // Ref for the scrollable container
    const parentRef = useRef<HTMLDivElement>(null);

    // Set up row virtualizer
    const rowVirtualizer = useVirtualizer({
        count: data.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 40, // Estimated row height in pixels
        overscan: 10, // Number of items to render outside visible area
    });

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

    // Handle keyboard navigation
    const handleKeyDown = (
        e: React.KeyboardEvent<HTMLInputElement>,
        row: number,
        col: number
    ) => {
        if (e.key === "Enter") {
            e.preventDefault();
            handleSaveEdit(row, col);
            if (row < data.length - 1) {
                const nextValue = data[row + 1][col] || "";
                handleStartEdit(row + 1, col, nextValue);
                // Scroll to next row if needed
                rowVirtualizer.scrollToIndex(row + 1, { align: "center" });
            }
        } else if (e.key === "Escape") {
            e.preventDefault();
            setEditingCell(null);
            setEditValue("");
        } else if (e.key === "Tab") {
            e.preventDefault();
            handleSaveEdit(row, col);
            if (col < headers.length - 1) {
                const nextValue = data[row][col + 1] || "";
                handleStartEdit(row, col + 1, nextValue);
            } else if (row < data.length - 1) {
                const nextValue = data[row + 1][0] || "";
                handleStartEdit(row + 1, 0, nextValue);
                rowVirtualizer.scrollToIndex(row + 1, { align: "center" });
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

    const virtualRows = rowVirtualizer.getVirtualItems();
    const totalSize = rowVirtualizer.getTotalSize();

    return (
        <div ref={parentRef} className="csv-grid-virtualized overflow-auto w-full h-full pr-32 pb-32">
            {/* Header (sticky) */}
            <div className="sticky top-0 z-10 bg-base-300 border-b-2 border-base-300">
                <div className="flex">
                    {/* Row number column header */}
                    <div className="w-16 p-2 text-center font-bold border-r border-base-content/10">
                        #
                    </div>

                    {/* Data column headers */}
                    {headers.map((header, colIndex) => (
                        <div
                            key={colIndex}
                            className="p-2 font-bold border-r border-base-content/10"
                            style={{ minWidth: "150px", flex: "1 0 150px" }}
                        >
                            {header}
                        </div>
                    ))}
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
                    const row = data[rowIndex];

                    return (
                        <div
                            key={virtualRow.key}
                            style={{
                                position: "absolute",
                                top: 0,
                                left: 0,
                                width: "100%",
                                height: `${virtualRow.size}px`,
                                transform: `translateY(${virtualRow.start}px)`,
                            }}
                            className="flex hover:bg-base-200"
                        >
                            {/* Row number */}
                            <div className="w-16 p-2 text-center font-mono text-sm bg-base-200/50 border-r border-base-content/10">
                                {rowIndex + 1}
                            </div>

                            {/* Data cells */}
                            {headers.map((_, colIndex) => {
                                const value = row[colIndex] || "";
                                const isEditing =
                                    editingCell?.row === rowIndex && editingCell?.col === colIndex;

                                return (
                                    <div
                                        key={colIndex}
                                        className="border-r border-base-content/10"
                                        style={{ minWidth: "150px", flex: "1 0 150px" }}
                                        onDoubleClick={() =>
                                            handleStartEdit(rowIndex, colIndex, value)
                                        }
                                    >
                                        {isEditing ? (
                                            <input
                                                type="text"
                                                className="input input-sm input-bordered w-full h-full"
                                                value={editValue}
                                                onChange={(e) => setEditValue(e.target.value)}
                                                onBlur={() => handleSaveEdit(rowIndex, colIndex)}
                                                onKeyDown={(e) =>
                                                    handleKeyDown(e, rowIndex, colIndex)
                                                }
                                                autoFocus
                                            />
                                        ) : (
                                            <div className="p-2 cursor-pointer hover:bg-base-100">
                                                {value}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    );
                })}
            </div>

            {/* Performance info (debug) */}
            {import.meta.env.DEV && (
                <div className="sticky bottom-0 bg-info text-info-content text-xs p-1 text-center">
                    Virtualized: Rendering {virtualRows.length} of {data.length} rows
                </div>
            )}
        </div>
    );
}

export default CSVGridVirtualized;
