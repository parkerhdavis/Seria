// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Column Filter Dropdown Component
 *
 * Dropdown filter UI for individual Cell columns.
 * Supports contains, not-contains, equals, and not-equals operations.
 */

import { useState, useRef, useEffect, useMemo } from "react";

type FilterOperation = "contains" | "not-contains" | "equals" | "not-equals";

interface ColumnFilterDropdownProps {
    columnName: string;
    operation: FilterOperation;
    value: string;
    onFilterChange: (operation: FilterOperation, value: string) => void;
    onClearFilter: () => void;
    columnData: string[];
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
    columnData,
}: ColumnFilterDropdownProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [localOperation, setLocalOperation] = useState<FilterOperation>(operation);
    const [localValue, setLocalValue] = useState(value);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Memoize unique values calculation to prevent recalculation on every render
    const uniqueValues = useMemo(() => {
        return Array.from(new Set(columnData.filter(val => val.trim() !== ""))).sort();
    }, [columnData]);

    // Filter unique values based on current input (if user is typing)
    // This is also memoized since it depends on uniqueValues and localValue
    const filteredUniqueValues = useMemo(() => {
        return localValue.trim() !== ""
            ? uniqueValues.filter(val => val.toLowerCase().includes(localValue.toLowerCase()))
            : uniqueValues;
    }, [uniqueValues, localValue]);

    // Show value list if there are 10 or fewer unique values, OR if user has typed and we have filtered results
    const showValueList = (uniqueValues.length > 0 && uniqueValues.length <= 10) ||
                         (localValue.trim() !== "" && filteredUniqueValues.length > 0 && filteredUniqueValues.length <= 10);

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
                className={`btn btn-ghost btn-xs px-1 min-h-0 h-6 ${isActive ? "text-primary" : "text-base-content/50"}`}
                onClick={() => setIsOpen(!isOpen)}
                title={`Filter ${columnName}`}
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
            </button>

            {/* Dropdown menu */}
            {isOpen && (
                <div className="absolute top-full right-0 mt-1 bg-base-100 border border-base-300 rounded-lg shadow-lg z-50 w-64 p-3">
                    <div className="flex flex-col gap-3">
                        {/* Operation */}
                        <div>
                            <label className="text-xs text-base-content/60 font-medium mb-1 block">Operation</label>
                            <button
                                className="btn btn-sm btn-outline w-full justify-start gap-2 font-mono"
                                onClick={handleOperationClick}
                                title={OPERATION_LABELS[localOperation]}
                            >
                                <span className="text-lg min-w-[1.5rem]">
                                    {OPERATION_SYMBOLS[localOperation]}
                                </span>
                                <span className="text-xs font-sans">
                                    {OPERATION_LABELS[localOperation]}
                                </span>
                            </button>
                        </div>

                        {/* Filter text */}
                        <div>
                            <label className="text-xs text-base-content/60 font-medium mb-1 block">Filter text</label>
                            <input
                                type="text"
                                className="input input-sm input-bordered w-full"
                                placeholder="Filter value..."
                                value={localValue}
                                onChange={(e) => setLocalValue(e.target.value)}
                                onKeyDown={handleKeyDown}
                                autoFocus
                            />
                        </div>

                        {/* Unique values list or message */}
                        {showValueList ? (
                            <div className="max-h-40 overflow-y-auto border border-base-300 rounded bg-base-200/50">
                                {filteredUniqueValues.map((val, idx) => (
                                    <button
                                        key={idx}
                                        className="w-full text-left px-3 py-1.5 text-sm hover:bg-base-300 transition-colors"
                                        onClick={() => {
                                            setLocalValue(val);
                                            setLocalOperation("equals");
                                            onFilterChange("equals", val);
                                            setIsOpen(false);
                                        }}
                                    >
                                        {val}
                                    </button>
                                ))}
                            </div>
                        ) : uniqueValues.length > 10 && localValue.trim() === "" ? (
                            <div className="text-xs text-base-content/60 p-2 bg-base-200/50 rounded border border-base-300">
                                More than 10 unique values in this field. Type to filter and we&apos;ll show a list of options when ready, or you can filter just on the text.
                            </div>
                        ) : null}

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
