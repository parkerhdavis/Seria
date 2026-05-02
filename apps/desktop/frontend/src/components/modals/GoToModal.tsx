// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Go To Modal Component
 *
 * Modal for quick navigation to specific rows, columns, or cells.
 * Opens with Ctrl+G keyboard shortcut.
 * Supports:
 * - Row number (e.g., "42")
 * - Column name (e.g., "Content")
 * - Excel-style cell reference (e.g., "B42", "A1")
 */

import { useEffect, useRef, useState } from "react";
import { useCellStore } from "@stores/cellStore";
import { useCellSelectionStore } from "@stores/cellSelectionStore";

interface GoToModalProps {
    isOpen: boolean;
    onClose: () => void;
}

/**
 * Convert Excel-style column letter to zero-based column index
 * A=0, B=1, ..., Z=25, AA=26, etc.
 */
function columnLetterToIndex(letter: string): number {
    let result = 0;
    for (let i = 0; i < letter.length; i++) {
        result *= 26;
        result += letter.charCodeAt(i) - 'A'.charCodeAt(0) + 1;
    }
    return result - 1;
}

/**
 * Parse input string to determine navigation type
 * Returns: { type: 'row' | 'column' | 'cell', row?: number, col?: number }
 */
function parseInput(input: string, headers: string[]): { type: 'row' | 'column' | 'cell' | 'invalid', row?: number, col?: number, error?: string } {
    const trimmed = input.trim();

    if (!trimmed) {
        return { type: 'invalid', error: 'Please enter a value' };
    }

    // Check if it's a pure number (row number)
    if (/^\d+$/.test(trimmed)) {
        const rowNum = parseInt(trimmed, 10);
        if (rowNum < 1) {
            return { type: 'invalid', error: 'Row number must be greater than 0' };
        }
        return { type: 'row', row: rowNum - 1 }; // Convert to 0-indexed
    }

    // Check if it's Excel-style cell reference (e.g., A1, B42, AA10)
    const cellMatch = trimmed.match(/^([A-Z]+)(\d+)$/i);
    if (cellMatch) {
        const colLetter = cellMatch[1].toUpperCase();
        const rowNum = parseInt(cellMatch[2], 10);

        if (rowNum < 1) {
            return { type: 'invalid', error: 'Row number must be greater than 0' };
        }

        const colIndex = columnLetterToIndex(colLetter);
        return { type: 'cell', row: rowNum - 1, col: colIndex };
    }

    // Check if it's a column name
    const colIndex = headers.findIndex(h => h.toLowerCase() === trimmed.toLowerCase());
    if (colIndex !== -1) {
        return { type: 'column', col: colIndex };
    }

    return { type: 'invalid', error: 'Invalid input. Try a row number (e.g., "42"), column name (e.g., "Content"), or cell (e.g., "B42")' };
}

/**
 * GoToModal - Modal for quick navigation
 */
function GoToModal({ isOpen, onClose }: GoToModalProps) {
    const { headers, data } = useCellStore();
    const { setSelectedCell } = useCellSelectionStore();

    const [input, setInput] = useState("");
    const [error, setError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const totalRows = data.length;
    const totalCols = headers.length;

    // Focus input when modal opens
    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isOpen]);

    // Clear input and error when modal opens
    useEffect(() => {
        if (isOpen) {
            setInput("");
            setError(null);
        }
    }, [isOpen]);

    const handleGoTo = () => {
        const parsed = parseInput(input, headers);

        if (parsed.type === 'invalid') {
            setError(parsed.error || 'Invalid input');
            return;
        }

        // Validate bounds
        if (parsed.row !== undefined && parsed.row >= totalRows) {
            setError(`Row ${parsed.row + 1} doesn't exist. File has ${totalRows} rows.`);
            return;
        }

        if (parsed.col !== undefined && parsed.col >= totalCols) {
            setError(`Column doesn't exist. File has ${totalCols} columns.`);
            return;
        }

        // Navigate based on type
        if (parsed.type === 'row') {
            // Go to first column of specified row
            setSelectedCell(parsed.row!, 0);
        } else if (parsed.type === 'column') {
            // Go to first row of specified column
            setSelectedCell(0, parsed.col!);
        } else if (parsed.type === 'cell') {
            // Go to specific cell
            setSelectedCell(parsed.row!, parsed.col!);
        }

        // Close modal
        onClose();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Escape") {
            onClose();
        } else if (e.key === "Enter") {
            handleGoTo();
        }
    };

    if (!isOpen) {
        return null;
    }

    return (
        <div className="modal modal-open">
            <div className="modal-box max-w-lg">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold">Go To</h2>
                    <button
                        className="btn btn-sm btn-ghost btn-circle"
                        onClick={onClose}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Current position info */}
                <div className="alert alert-info mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    <div className="text-sm">
                        <p>File has <strong>{totalRows} rows</strong> and <strong>{totalCols} columns</strong></p>
                    </div>
                </div>

                {/* Input */}
                <div className="form-control mb-4">
                    <label className="label">
                        <span className="label-text font-semibold">Go to</span>
                    </label>
                    <input
                        ref={inputRef}
                        type="text"
                        className="input input-bordered"
                        placeholder='Row (e.g., "42"), Column (e.g., "Content"), or Cell (e.g., "B42")'
                        value={input}
                        onChange={(e) => {
                            setInput(e.target.value);
                            setError(null);
                        }}
                        onKeyDown={handleKeyDown}
                    />
                    {error && (
                        <label className="label">
                            <span className="label-text-alt text-error">{error}</span>
                        </label>
                    )}
                </div>

                {/* Examples */}
                <div className="bg-base-200 rounded-lg p-4 mb-4">
                    <p className="font-semibold mb-2 text-sm">Examples:</p>
                    <ul className="text-sm space-y-1 text-base-content/80">
                        <li><kbd className="kbd kbd-xs">42</kbd> - Go to row 42</li>
                        <li><kbd className="kbd kbd-xs">Content</kbd> - Go to "Content" column</li>
                        <li><kbd className="kbd kbd-xs">B42</kbd> - Go to cell at column B, row 42</li>
                        <li><kbd className="kbd kbd-xs">A1</kbd> - Go to first cell</li>
                    </ul>
                </div>

                {/* Quick Actions */}
                <div className="flex gap-2 mb-6">
                    <button
                        className="btn btn-sm btn-outline flex-1"
                        onClick={() => {
                            setSelectedCell(0, 0);
                            onClose();
                        }}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                        </svg>
                        First Row
                    </button>
                    <button
                        className="btn btn-sm btn-outline flex-1"
                        onClick={() => {
                            const lastRow = totalRows - 1;
                            setSelectedCell(lastRow, 0);
                            onClose();
                        }}
                        disabled={totalRows === 0}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                        </svg>
                        Last Row
                    </button>
                </div>

                {/* Modal actions */}
                <div className="modal-action">
                    <button className="btn btn-ghost" onClick={onClose}>
                        Cancel
                    </button>
                    <button className="btn btn-primary" onClick={handleGoTo}>
                        Go
                    </button>
                </div>
            </div>
            <div className="modal-backdrop" onClick={onClose}></div>
        </div>
    );
}

export default GoToModal;
