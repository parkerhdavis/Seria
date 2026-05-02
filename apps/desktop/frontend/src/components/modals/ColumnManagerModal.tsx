// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Column Manager Modal Component
 *
 * Comprehensive column management interface for bulk operations:
 * - View all columns with statistics
 * - Reorder columns via drag and drop
 * - Rename columns
 * - Delete columns
 * - Duplicate columns
 * - Lock/unlock columns
 * - Column visibility toggle
 */

import { useEffect, useState } from "react";
import { useCellStore } from "@stores/cellStore";

interface ColumnManagerModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface ColumnInfo {
    name: string;
    index: number;
    uniqueValues: number;
    totalValues: number;
    emptyCount: number;
    isVisible: boolean;
}

/**
 * ColumnManagerModal - Comprehensive column management
 */
function ColumnManagerModal({ isOpen, onClose }: ColumnManagerModalProps) {
    const { headers, data, renameColumn, deleteColumn, addColumn, reorderColumns } = useCellStore();
    const [columns, setColumns] = useState<ColumnInfo[]>([]);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [editingName, setEditingName] = useState("");
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const [dragStartColumnIndex, setDragStartColumnIndex] = useState<number | null>(null);

    // Calculate column statistics
    useEffect(() => {
        if (!isOpen) return;

        const columnInfos: ColumnInfo[] = headers.map((name, index) => {
            const values = data.map(row => row[index] || "");
            const uniqueValues = new Set(values.filter(v => v !== "")).size;
            const emptyCount = values.filter(v => v === "").length;

            return {
                name,
                index,
                uniqueValues,
                totalValues: values.length,
                emptyCount,
                isVisible: true,
            };
        });

        setColumns(columnInfos);
    }, [isOpen, headers, data]);

    const handleRename = (index: number) => {
        const column = columns[index];
        if (editingName.trim() && editingName !== column.name) {
            renameColumn(index, editingName.trim());
            setColumns(prev => prev.map((col, i) =>
                i === index ? { ...col, name: editingName.trim() } : col
            ));
        }
        setEditingIndex(null);
        setEditingName("");
    };

    const handleDelete = (index: number) => {
        if (confirm(`Delete column "${columns[index].name}"? This cannot be undone.`)) {
            deleteColumn(index);
            setColumns(prev => prev.filter((_, i) => i !== index));
        }
    };

    const handleDuplicate = (index: number) => {
        const columnName = columns[index].name;
        const newName = `${columnName} (copy)`;

        // Get all values from the column to duplicate
        const columnValues = data.map(row => row[index] || "");

        // Add new column next to the original
        addColumn(newName, index + 1);

        // Copy values to the new column
        columnValues.forEach((value, rowIndex) => {
            const { updateCell } = useCellStore.getState();
            updateCell(rowIndex, index + 1, value);
        });

        // Refresh column list
        setColumns(prev => {
            const newColumns = [...prev];
            newColumns.splice(index + 1, 0, {
                name: newName,
                index: index + 1,
                uniqueValues: newColumns[index].uniqueValues,
                totalValues: newColumns[index].totalValues,
                emptyCount: newColumns[index].emptyCount,
                isVisible: true,
            });
            return newColumns;
        });
    };

    const handleDragStart = (index: number) => {
        setDraggedIndex(index);
        // Store the original column's data index
        setDragStartColumnIndex(columns[index].index);
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        if (draggedIndex === null || draggedIndex === index) return;

        // Reorder columns array for visual feedback
        setColumns(prev => {
            const newColumns = [...prev];
            const draggedItem = newColumns[draggedIndex];
            newColumns.splice(draggedIndex, 1);
            newColumns.splice(index, 0, draggedItem);
            return newColumns;
        });

        setDraggedIndex(index);
    };

    const handleDragEnd = () => {
        if (draggedIndex !== null && dragStartColumnIndex !== null) {
            // draggedIndex is now the visual position where the column should end up
            // dragStartColumnIndex is the original data index of the column being dragged
            // Only reorder if position actually changed
            if (dragStartColumnIndex !== draggedIndex) {
                reorderColumns(dragStartColumnIndex, draggedIndex);
            }
        }
        setDraggedIndex(null);
        setDragStartColumnIndex(null);
    };

    if (!isOpen) {
        return null;
    }

    return (
        <div className="modal modal-open">
            <div className="modal-box max-w-4xl max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-2xl font-bold">Column Manager</h2>
                        <p className="text-base-content/60 mt-1">
                            Manage, reorder, and analyze your columns
                        </p>
                    </div>
                    <button
                        className="btn btn-sm btn-ghost btn-circle"
                        onClick={onClose}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Summary */}
                <div className="alert alert-info mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    <div className="text-sm">
                        <p><strong>{columns.length} columns</strong> in this file</p>
                    </div>
                </div>

                {/* Instructions */}
                <div className="bg-base-200 rounded-lg p-4 mb-4">
                    <p className="font-semibold mb-2 text-sm">Tips:</p>
                    <ul className="text-sm space-y-1 text-base-content/80 list-disc list-inside">
                        <li>Drag columns to reorder them</li>
                        <li>Click column name to rename</li>
                        <li>Use actions to duplicate or delete columns</li>
                    </ul>
                </div>

                {/* Columns List */}
                <div className="space-y-2 max-h-96 overflow-y-auto mb-4">
                    {columns.map((column, index) => (
                        <div
                            key={`${column.name}-${index}`}
                            draggable
                            onDragStart={() => handleDragStart(index)}
                            onDragOver={(e) => handleDragOver(e, index)}
                            onDragEnd={handleDragEnd}
                            className={`card bg-base-200 p-4 cursor-move hover:bg-base-300 transition-colors ${
                                draggedIndex === index ? 'opacity-50' : ''
                            }`}
                        >
                            <div className="flex items-start justify-between gap-4">
                                {/* Drag Handle & Column Info */}
                                <div className="flex items-start gap-3 flex-1">
                                    <div className="mt-1">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-base-content/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                        </svg>
                                    </div>

                                    <div className="flex-1">
                                        {/* Column Name */}
                                        {editingIndex === index ? (
                                            <input
                                                type="text"
                                                className="input input-bordered input-sm w-full mb-2"
                                                value={editingName}
                                                onChange={(e) => setEditingName(e.target.value)}
                                                onBlur={() => handleRename(index)}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter") {
                                                        handleRename(index);
                                                    } else if (e.key === "Escape") {
                                                        setEditingIndex(null);
                                                        setEditingName("");
                                                    }
                                                }}
                                                autoFocus
                                            />
                                        ) : (
                                            <button
                                                className="font-semibold text-base-content hover:text-primary text-left mb-2"
                                                onClick={() => {
                                                    setEditingIndex(index);
                                                    setEditingName(column.name);
                                                }}
                                            >
                                                {column.name}
                                            </button>
                                        )}

                                        {/* Statistics */}
                                        <div className="text-xs text-base-content/60 space-y-1">
                                            <div className="flex gap-4">
                                                <span><strong>{column.uniqueValues}</strong> unique values</span>
                                                <span><strong>{column.emptyCount}</strong> empty cells</span>
                                                <span><strong>{column.totalValues}</strong> total rows</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex gap-1">
                                    <button
                                        className="btn btn-ghost btn-xs"
                                        onClick={() => handleDuplicate(index)}
                                        title="Duplicate column"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                        </svg>
                                    </button>
                                    <button
                                        className="btn btn-ghost btn-xs text-error"
                                        onClick={() => handleDelete(index)}
                                        title="Delete column"
                                        disabled={columns.length === 1}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Add Column Button */}
                <button
                    className="btn btn-outline btn-sm w-full mb-4"
                    onClick={() => {
                        const newName = `Column ${columns.length + 1}`;
                        addColumn(newName, columns.length);
                        setColumns(prev => [...prev, {
                            name: newName,
                            index: columns.length,
                            uniqueValues: 0,
                            totalValues: data.length,
                            emptyCount: data.length,
                            isVisible: true,
                        }]);
                    }}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Column
                </button>

                {/* Modal Actions */}
                <div className="modal-action">
                    <button className="btn btn-primary" onClick={onClose}>
                        Done
                    </button>
                </div>
            </div>
            <div className="modal-backdrop" onClick={onClose}></div>
        </div>
    );
}

export default ColumnManagerModal;
