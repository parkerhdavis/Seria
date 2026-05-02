// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Cell History Modal Component
 *
 * Displays the per-cell edit history as an audit trail timeline.
 * Allows viewing a specific cell's edit history or the full session history.
 * Users can restore previous values from the history.
 *
 * Accessed via right-click context menu "View History" on a cell.
 */

import { useState, useMemo } from "react";
import { useCellHistoryStore, type CellEdit } from "@stores/cellHistoryStore";
import { useCellStore } from "@stores/cellStore";
import { useCellSelectionStore } from "@stores/cellSelectionStore";

interface CellHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
}

/**
 * Format a timestamp as a relative time string (e.g., "2 minutes ago")
 *
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Formatted relative time string
 */
function formatRelativeTime(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;

    if (diff < 1000) return "just now";
    if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return new Date(timestamp).toLocaleString();
}

/**
 * Format a timestamp as an absolute time string
 *
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Formatted time string (HH:MM:SS)
 */
function formatTime(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString();
}

/**
 * CellHistoryModal - Per-cell edit history viewer
 */
export default function CellHistoryModal({ isOpen, onClose }: CellHistoryModalProps) {
    const { getCellHistory, getAllCellEdits } = useCellHistoryStore();
    const { headers, updateCell } = useCellStore();
    const selectedCell = useCellSelectionStore((state) => state.selectedCell);

    const [viewMode, setViewMode] = useState<"cell" | "all">("cell");
    const [filterColumn, setFilterColumn] = useState<string | null>(null);

    // Get edits based on view mode
    const edits = useMemo(() => {
        if (viewMode === "cell" && selectedCell) {
            return getCellHistory(selectedCell.row, selectedCell.col);
        }
        const all = getAllCellEdits();
        if (filterColumn) {
            return all.filter((e) => e.columnName === filterColumn);
        }
        return all;
    }, [viewMode, selectedCell, filterColumn, getCellHistory, getAllCellEdits]);

    // Sort edits newest first for display
    const sortedEdits = useMemo(
        () => [...edits].sort((a, b) => b.timestamp - a.timestamp),
        [edits]
    );

    // Get unique columns from edits for filter dropdown
    const editedColumns = useMemo(() => {
        const cols = new Set(getAllCellEdits().map((e) => e.columnName));
        return Array.from(cols).sort();
    }, [getAllCellEdits]);

    // Restore a previous value
    const handleRestore = (edit: CellEdit) => {
        updateCell(edit.row, edit.col, edit.oldValue);
    };

    if (!isOpen) return null;

    const currentCellLabel =
        selectedCell && headers[selectedCell.col]
            ? `Row ${selectedCell.row + 1}, "${headers[selectedCell.col]}"`
            : selectedCell
                ? `Row ${selectedCell.row + 1}, Column ${selectedCell.col + 1}`
                : "No cell selected";

    return (
        <div className="modal modal-open">
            <div className="modal-box max-w-3xl max-h-[85vh] overflow-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-xl font-bold">Edit History</h2>
                        <p className="text-sm text-base-content/60">
                            {viewMode === "cell"
                                ? `History for ${currentCellLabel}`
                                : "All edits this session"}
                        </p>
                    </div>
                    <button className="btn btn-sm btn-ghost btn-circle" onClick={onClose}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* View mode tabs */}
                <div className="flex items-center gap-4 mb-4">
                    <div className="tabs tabs-boxed">
                        <button
                            className={`tab ${viewMode === "cell" ? "tab-active" : ""}`}
                            onClick={() => setViewMode("cell")}
                            disabled={!selectedCell}
                        >
                            Selected Cell
                        </button>
                        <button
                            className={`tab ${viewMode === "all" ? "tab-active" : ""}`}
                            onClick={() => setViewMode("all")}
                        >
                            All Edits
                        </button>
                    </div>

                    {/* Column filter (only in "all" mode) */}
                    {viewMode === "all" && editedColumns.length > 0 && (
                        <select
                            className="select select-bordered select-sm"
                            value={filterColumn || ""}
                            onChange={(e) => setFilterColumn(e.target.value || null)}
                        >
                            <option value="">All columns</option>
                            {editedColumns.map((col) => (
                                <option key={col} value={col}>
                                    {col}
                                </option>
                            ))}
                        </select>
                    )}

                    <span className="text-sm text-base-content/50 ml-auto">
                        {sortedEdits.length} edit{sortedEdits.length !== 1 ? "s" : ""}
                    </span>
                </div>

                {/* Edit timeline */}
                {sortedEdits.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-base-content/50">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="font-semibold">No edits recorded</p>
                        <p className="text-sm mt-1">
                            {viewMode === "cell"
                                ? "This cell has not been edited in the current session"
                                : "No edits have been made in the current session"}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-1">
                        {sortedEdits.map((edit, index) => (
                            <div
                                key={`${edit.timestamp}-${edit.row}-${edit.col}-${index}`}
                                className="card bg-base-200 shadow-sm hover:bg-base-300/50 transition-colors"
                            >
                                <div className="card-body p-3">
                                    <div className="flex items-start justify-between gap-4">
                                        {/* Edit info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 text-sm mb-1">
                                                {/* Timestamp */}
                                                <span className="font-mono text-xs text-base-content/50" title={formatTime(edit.timestamp)}>
                                                    {formatRelativeTime(edit.timestamp)}
                                                </span>

                                                {/* Cell location */}
                                                {viewMode === "all" && (
                                                    <span className="badge badge-sm badge-ghost">
                                                        Row {edit.row + 1}, {edit.columnName}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Value change */}
                                            <div className="flex items-center gap-2 text-sm">
                                                <span
                                                    className="bg-error/10 text-error px-2 py-0.5 rounded font-mono text-xs max-w-[250px] truncate inline-block"
                                                    title={edit.oldValue || "(empty)"}
                                                >
                                                    {edit.oldValue || <span className="italic opacity-50">(empty)</span>}
                                                </span>
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-base-content/40 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                                </svg>
                                                <span
                                                    className="bg-success/10 text-success px-2 py-0.5 rounded font-mono text-xs max-w-[250px] truncate inline-block"
                                                    title={edit.newValue || "(empty)"}
                                                >
                                                    {edit.newValue || <span className="italic opacity-50">(empty)</span>}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Restore button */}
                                        <button
                                            className="btn btn-xs btn-ghost text-primary tooltip tooltip-left"
                                            data-tip="Restore this value"
                                            onClick={() => handleRestore(edit)}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Footer */}
                <div className="modal-action">
                    <div className="text-xs text-base-content/40 mr-auto">
                        Edit history is stored in memory for this session only
                    </div>
                    <button className="btn" onClick={onClose}>Close</button>
                </div>
            </div>
            <div className="modal-backdrop" onClick={onClose}></div>
        </div>
    );
}
