// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Autocomplete Dropdown Component
 *
 * Shows autocomplete suggestions below/above the cell being edited.
 * Supports keyboard navigation (Arrow Up/Down, Enter, Escape, Tab).
 */

import { useEffect, useRef } from "react";

export interface AutocompleteDropdownProps {
    suggestions: string[];
    selectedIndex: number;
    onSelect: (value: string) => void;
    onClose: () => void;
    onNavigate: (direction: "up" | "down") => void;
    position: {
        top: number;
        left: number;
        width: number;
        maxHeight?: number;
    };
}

/**
 * AutocompleteDropdown - Shows suggestions for cell editing
 */
export default function AutocompleteDropdown({
    suggestions,
    selectedIndex,
    onSelect,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    onClose,
    onNavigate,
    position,
}: AutocompleteDropdownProps) {
    const dropdownRef = useRef<HTMLDivElement>(null);
    const selectedItemRef = useRef<HTMLDivElement>(null);

    // Scroll selected item into view
    useEffect(() => {
        if (selectedItemRef.current && dropdownRef.current) {
            selectedItemRef.current.scrollIntoView({
                block: "nearest",
                behavior: "smooth",
            });
        }
    }, [selectedIndex]);

    // No suggestions to show
    if (suggestions.length === 0) {
        return null;
    }

    return (
        <div
            ref={dropdownRef}
            className="fixed z-[9999] bg-base-100 border border-base-300 rounded-lg shadow-2xl overflow-auto"
            style={{
                top: `${position.top}px`,
                left: `${position.left}px`,
                width: `${position.width}px`,
                maxHeight: `${position.maxHeight || 300}px`,
            }}
        >
            {suggestions.map((suggestion, index) => (
                <div
                    key={`${suggestion}-${index}`}
                    ref={index === selectedIndex ? selectedItemRef : null}
                    className={`
                        px-3 py-2 cursor-pointer text-sm
                        ${index === selectedIndex
                            ? "bg-primary text-primary-content font-medium"
                            : "hover:bg-base-200"
                        }
                        ${index > 0 ? "border-t border-base-300" : ""}
                    `}
                    onClick={() => onSelect(suggestion)}
                    onMouseEnter={() => {
                        // Update selected index on hover (optional, for better UX)
                        if (index !== selectedIndex) {
                            onNavigate(index > selectedIndex ? "down" : "up");
                        }
                    }}
                >
                    {suggestion}
                </div>
            ))}
        </div>
    );
}
