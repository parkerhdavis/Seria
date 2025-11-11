/**
 * CSV Grid Component
 *
 * Editable spreadsheet-like grid for viewing and editing CSV data.
 * Uses TanStack Table for data management and rendering.
 */

import { useState, useMemo } from "react";
import {
    useReactTable,
    getCoreRowModel,
    flexRender,
    ColumnDef,
} from "@tanstack/react-table";
import { useCSVStore } from "@stores/csvStore";

interface CSVGridProps {
    onCellEdit?: (row: number, col: number, value: string) => void;
}

/**
 * CSVGrid component - displays CSV data in an editable table
 */
function CSVGrid({ onCellEdit }: CSVGridProps) {
    const { headers, data, updateCell } = useCSVStore();
    const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null);
    const [editValue, setEditValue] = useState("");

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

                return (
                    <div
                        className="cell-wrapper"
                        onDoubleClick={() => handleStartEdit(rowIndex, colIndex, value)}
                    >
                        {isEditing ? (
                            <input
                                type="text"
                                className="input input-sm input-bordered w-full"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={() => handleSaveEdit(rowIndex, colIndex)}
                                onKeyDown={(e) => handleKeyDown(e, rowIndex, colIndex)}
                                autoFocus
                            />
                        ) : (
                            <div className="cell-content px-2 py-1 min-h-[32px] cursor-pointer hover:bg-base-200">
                                {value}
                            </div>
                        )}
                    </div>
                );
            },
        }));
    }, [headers, editingCell, editValue]);

    // Create table instance
    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
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

    // Handle keyboard navigation and shortcuts
    const handleKeyDown = (
        e: React.KeyboardEvent<HTMLInputElement>,
        row: number,
        col: number
    ) => {
        if (e.key === "Enter") {
            e.preventDefault();
            handleSaveEdit(row, col);
            // Move to next row, same column
            if (row < data.length - 1) {
                const nextValue = data[row + 1][col] || "";
                handleStartEdit(row + 1, col, nextValue);
            }
        } else if (e.key === "Escape") {
            e.preventDefault();
            setEditingCell(null);
            setEditValue("");
        } else if (e.key === "Tab") {
            e.preventDefault();
            handleSaveEdit(row, col);
            // Move to next column (or next row if at end)
            if (col < headers.length - 1) {
                const nextValue = data[row][col + 1] || "";
                handleStartEdit(row, col + 1, nextValue);
            } else if (row < data.length - 1) {
                const nextValue = data[row + 1][0] || "";
                handleStartEdit(row + 1, 0, nextValue);
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
            <table className="table table-zebra table-pin-rows table-pin-cols w-full">
                <thead>
                    {table.getHeaderGroups().map((headerGroup) => (
                        <tr key={headerGroup.id}>
                            {/* Row number column */}
                            <th className="bg-base-300 text-center w-16">#</th>

                            {/* Data columns */}
                            {headerGroup.headers.map((header) => (
                                <th
                                    key={header.id}
                                    className="bg-base-300 font-bold"
                                    style={{ minWidth: "150px" }}
                                >
                                    {flexRender(
                                        header.column.columnDef.header,
                                        header.getContext()
                                    )}
                                </th>
                            ))}
                        </tr>
                    ))}
                </thead>
                <tbody>
                    {table.getRowModel().rows.map((row) => (
                        <tr key={row.id} className="hover">
                            {/* Row number */}
                            <td className="bg-base-200 text-center font-mono text-sm">
                                {row.index + 1}
                            </td>

                            {/* Data cells */}
                            {row.getVisibleCells().map((cell) => (
                                <td key={cell.id} className="p-0">
                                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                </td>
                            ))}
                        </tr>
                    ))}
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
