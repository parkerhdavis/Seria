/**
 * Row Coloring Dropdown Component
 *
 * Dropdown for selecting row coloring mode with field-based filtering.
 * Modes: Off, Alternating, or by specific field with comparison filter.
 */

import { useState, useRef, useEffect } from "react";
import { useCSVStore } from "@stores/csvStore";
import { useSettingsStore, RowColoringMode, FilterOperation } from "@stores/settingsStore";
import FilterComparison from "../csv/FilterComparison";

/**
 * RowColoringDropdown - Dropdown for row coloring configuration
 */
function RowColoringDropdown() {
    const { headers } = useCSVStore();
    const {
        rowColoringMode,
        rowColorFilter,
        setRowColoringMode,
        setRowColorFilter,
    } = useSettingsStore();

    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
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

    // Get display label for current mode
    const getDisplayLabel = () => {
        if (rowColoringMode === "off") return "Off";
        if (rowColoringMode === "alternating") return "Alternating";
        if (rowColoringMode === "by-field" && rowColorFilter) {
            return `by ${rowColorFilter.field}`;
        }
        return "Off";
    };

    // Handle mode selection
    const handleModeSelect = (mode: RowColoringMode, field?: string) => {
        setRowColoringMode(mode);

        if (mode === "by-field" && field) {
            // Initialize filter for the selected field
            setRowColorFilter({
                field,
                operation: "contains",
                value: "",
                color: "rgba(59, 130, 246, 0.2)",
            });
        } else {
            setRowColorFilter(null);
        }

        setIsOpen(false);
    };

    // Handle filter updates
    const handleOperationChange = (operation: FilterOperation) => {
        if (rowColorFilter) {
            setRowColorFilter({ ...rowColorFilter, operation });
        }
    };

    const handleValueChange = (value: string) => {
        if (rowColorFilter) {
            setRowColorFilter({ ...rowColorFilter, value });
        }
    };

    const handleColorChange = (color: string) => {
        if (rowColorFilter) {
            setRowColorFilter({ ...rowColorFilter, color });
        }
    };

    return (
        <div className="flex items-center gap-2">
            {/* Dropdown button */}
            <div className="relative" ref={dropdownRef}>
                <button
                    className="btn btn-sm btn-ghost"
                    onClick={() => setIsOpen(!isOpen)}
                >
                    Row Coloring: {getDisplayLabel()}
                    <svg
                        className="w-4 h-4 ml-1"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 9l-7 7-7-7"
                        />
                    </svg>
                </button>

                {/* Dropdown menu */}
                {isOpen && (
                    <div className="absolute top-full mt-1 left-0 bg-base-200 border border-base-300 rounded-lg shadow-xl z-50 min-w-[200px]">
                        <ul className="menu menu-sm p-2">
                            <li>
                                <button
                                    className={rowColoringMode === "off" ? "active" : ""}
                                    onClick={() => handleModeSelect("off")}
                                >
                                    Off
                                </button>
                            </li>
                            <li>
                                <button
                                    className={rowColoringMode === "alternating" ? "active" : ""}
                                    onClick={() => handleModeSelect("alternating")}
                                >
                                    Alternating
                                </button>
                            </li>
                            {headers.length > 0 && (
                                <>
                                    <li className="menu-title">
                                        <span>By Field</span>
                                    </li>
                                    {headers.map((header) => (
                                        <li key={header}>
                                            <button
                                                className={
                                                    rowColoringMode === "by-field" &&
                                                    rowColorFilter?.field === header
                                                        ? "active"
                                                        : ""
                                                }
                                                onClick={() => handleModeSelect("by-field", header)}
                                            >
                                                by {header}
                                            </button>
                                        </li>
                                    ))}
                                </>
                            )}
                        </ul>
                    </div>
                )}
            </div>

            {/* Filter comparison controls (shown when by-field is selected) */}
            {rowColoringMode === "by-field" && rowColorFilter && (
                <FilterComparison
                    operation={rowColorFilter.operation}
                    value={rowColorFilter.value}
                    color={rowColorFilter.color}
                    onOperationChange={handleOperationChange}
                    onValueChange={handleValueChange}
                    onColorChange={handleColorChange}
                />
            )}
        </div>
    );
}

export default RowColoringDropdown;
