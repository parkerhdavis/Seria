// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Row Coloring Dropdown Component
 *
 * Dropdown for selecting row coloring mode with field-based filtering.
 * Modes: Off, Alternating, or by specific field with comparison filter.
 */

import { useState, useRef, useEffect } from "react";
import { useCellStore } from "@stores/cellStore";
import { useSettingsStore, RowColoringMode } from "@stores/settingsStore";

/**
 * RowColoringDropdown - Dropdown for row coloring configuration
 */
function RowColoringDropdown() {
    const { headers } = useCellStore();
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

    return (
        <div className="flex items-center gap-2">
            {/* Dropdown button */}
            <div className="relative" ref={dropdownRef}>
                <button
                    className="btn btn-sm btn-ghost"
                    onClick={() => setIsOpen(!isOpen)}
                    title={`Row Coloring: ${getDisplayLabel()}`}
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42"
                        />
                    </svg>
                    <span className="text-xs">Color</span>
                    <svg
                        className="w-3 h-3"
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
                                    <span className="flex items-center gap-2 flex-1">
                                        Off
                                    </span>
                                    {rowColoringMode === "off" && (
                                        <span className="w-2.5 h-2.5 rounded-full bg-primary flex-shrink-0" />
                                    )}
                                </button>
                            </li>

                            {/* By Row section */}
                            <li className="menu-title">
                                <span>By Row</span>
                            </li>
                            <li>
                                <button
                                    className={rowColoringMode === "alternating" ? "active" : ""}
                                    onClick={() => handleModeSelect("alternating")}
                                >
                                    <span className="flex items-center gap-2 flex-1">
                                        Alternating
                                    </span>
                                    {rowColoringMode === "alternating" && (
                                        <span className="w-2.5 h-2.5 rounded-full bg-primary flex-shrink-0" />
                                    )}
                                </button>
                            </li>

                            {/* By Column section */}
                            {headers.length > 0 && (
                                <>
                                    <li className="menu-title">
                                        <span>By Column</span>
                                    </li>
                                    {headers.map((header) => {
                                        const isActive =
                                            rowColoringMode === "by-field" &&
                                            rowColorFilter?.field === header;
                                        return (
                                            <li key={header}>
                                                <button
                                                    className={isActive ? "active" : ""}
                                                    onClick={() => handleModeSelect("by-field", header)}
                                                >
                                                    <span className="flex items-center gap-2 flex-1">
                                                        {header}
                                                    </span>
                                                    {isActive && (
                                                        <span
                                                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                                            style={{ backgroundColor: rowColorFilter?.color || "oklch(var(--p))" }}
                                                        />
                                                    )}
                                                </button>
                                            </li>
                                        );
                                    })}
                                </>
                            )}
                        </ul>
                    </div>
                )}
            </div>
        </div>
    );
}

export default RowColoringDropdown;
