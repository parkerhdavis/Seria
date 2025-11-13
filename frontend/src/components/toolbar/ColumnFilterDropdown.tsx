/**
 * Column Filter Dropdown Component
 *
 * Dropdown filter UI for individual CSV columns.
 * Supports contains, not-contains, equals, and not-equals operations.
 */

import { useState, useRef, useEffect } from "react";

type FilterOperation = "contains" | "not-contains" | "equals" | "not-equals";

interface ColumnFilterDropdownProps {
    columnName: string;
    operation: FilterOperation;
    value: string;
    onFilterChange: (operation: FilterOperation, value: string) => void;
    onClearFilter: () => void;
}

const OPERATION_SYMBOLS: Record<FilterOperation, string> = {
    "contains": "∋",
    "not-contains": "!∋",
    "equals": "=",
    "not-equals": "!=",
};

const OPERATION_LABELS: Record<FilterOperation, string> = {
    "contains": "Contains",
    "not-contains": "Not Contains",
    "equals": "Equals",
    "not-equals": "Not Equals",
};

/**
 * ColumnFilterDropdown - Dropdown filter UI for a column
 */
function ColumnFilterDropdown({
    columnName,
    operation,
    value,
    onFilterChange,
    onClearFilter,
}: ColumnFilterDropdownProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [localOperation, setLocalOperation] = useState<FilterOperation>(operation);
    const [localValue, setLocalValue] = useState(value);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Update local state when props change
    useEffect(() => {
        setLocalOperation(operation);
        setLocalValue(value);
    }, [operation, value]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isOpen]);

    // Cycle through operations
    const handleOperationClick = () => {
        const operations: FilterOperation[] = ["contains", "not-contains", "equals", "not-equals"];
        const currentIndex = operations.indexOf(localOperation);
        const nextIndex = (currentIndex + 1) % operations.length;
        setLocalOperation(operations[nextIndex]);
    };

    // Apply filter
    const handleApply = () => {
        onFilterChange(localOperation, localValue);
        setIsOpen(false);
    };

    // Clear filter
    const handleClear = () => {
        onClearFilter();
        setLocalValue("");
        setIsOpen(false);
    };

    // Handle Enter key in input
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            handleApply();
        } else if (e.key === "Escape") {
            setIsOpen(false);
        }
    };

    // Check if filter is active
    const isActive = value !== "";

    return (
        <div className="relative inline-block" ref={dropdownRef}>
            {/* Filter button */}
            <button
                className={`btn btn-ghost btn-xs ${isActive ? "text-primary" : "text-base-content/50"}`}
                onClick={() => setIsOpen(!isOpen)}
                title={`Filter ${columnName}`}
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
            </button>

            {/* Dropdown menu */}
            {isOpen && (
                <div className="absolute top-full right-0 mt-1 bg-base-100 border border-base-300 rounded-lg shadow-lg z-50 w-64 p-3">
                    <div className="flex flex-col gap-2">
                        {/* Operation selector */}
                        <div className="flex items-center gap-2">
                            <button
                                className="btn btn-sm btn-outline flex-shrink-0"
                                onClick={handleOperationClick}
                                title={OPERATION_LABELS[localOperation]}
                            >
                                {OPERATION_SYMBOLS[localOperation]}
                            </button>
                            <span className="text-xs text-base-content/70">
                                {OPERATION_LABELS[localOperation]}
                            </span>
                        </div>

                        {/* Filter value input */}
                        <input
                            type="text"
                            className="input input-sm input-bordered w-full"
                            placeholder="Filter value..."
                            value={localValue}
                            onChange={(e) => setLocalValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            autoFocus
                        />

                        {/* Action buttons */}
                        <div className="flex gap-2 justify-end">
                            <button
                                className="btn btn-sm btn-ghost"
                                onClick={handleClear}
                            >
                                Clear
                            </button>
                            <button
                                className="btn btn-sm btn-primary"
                                onClick={handleApply}
                            >
                                Apply
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ColumnFilterDropdown;
