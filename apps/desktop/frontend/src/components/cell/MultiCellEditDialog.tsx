// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Multi-Cell Edit Dialog Component
 *
 * A small inline dialog that appears over selected cells to allow editing multiple cells at once.
 * Opens with F2 when multiple cells are selected.
 * Saves with Enter or F2, cancels with Escape or clicking away.
 */

import { useState, useEffect, useRef } from "react";

interface MultiCellEditDialogProps {
    /**
     * Position of the dialog (typically the bounds of the selected range)
     */
    position: {
        top: number;
        left: number;
        width: number;
        height: number;
    };
    /**
     * Callback when the user confirms the edit (Enter or F2)
     */
    onSave: (value: string) => void;
    /**
     * Callback when the user cancels the edit (Escape or click away)
     */
    onCancel: () => void;
    /**
     * Initial value to show in the input
     */
    initialValue?: string;
}

/**
 * MultiCellEditDialog - Dialog for editing multiple cells at once
 */
function MultiCellEditDialog({ position, onSave, onCancel, initialValue = "" }: MultiCellEditDialogProps) {
    const [value, setValue] = useState(initialValue);
    const inputRef = useRef<HTMLInputElement>(null);

    // Focus input on mount
    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, []);

    // Handle keyboard shortcuts
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter" || e.key === "F2") {
            e.preventDefault();
            onSave(value);
        } else if (e.key === "Escape") {
            e.preventDefault();
            onCancel();
        }
    };

    // Handle clicking outside to cancel
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (inputRef.current && !inputRef.current.contains(e.target as Node)) {
                onCancel();
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [onCancel]);

    return (
        <div
            className="absolute z-50 bg-base-100 border-2 border-primary rounded shadow-lg p-2"
            style={{
                top: `${position.top}px`,
                left: `${position.left}px`,
                minWidth: `${Math.max(position.width, 200)}px`,
            }}
        >
            <div className="text-xs text-base-content/70 mb-1 font-semibold">
                Edit multiple cells (Enter/F2 to save, Esc to cancel)
            </div>
            <input
                ref={inputRef}
                type="text"
                className="input input-bordered input-sm w-full"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={handleKeyDown}
            />
        </div>
    );
}

export default MultiCellEditDialog;
