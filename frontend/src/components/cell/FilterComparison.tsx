/**
 * Filter Comparison Component
 *
 * Reusable component for filtering data by field with comparison operations.
 * Includes operation selector (∋, !∋, =, !=), text input, and color picker.
 */

import { useState } from "react";
import { FilterOperation } from "@stores/settingsStore";

interface FilterComparisonProps {
    operation: FilterOperation;
    value: string;
    color: string;
    onOperationChange: (operation: FilterOperation) => void;
    onValueChange: (value: string) => void;
    onColorChange: (color: string) => void;
}

const OPERATION_SYMBOLS: Record<FilterOperation, string> = {
    "contains": "∋",
    "not-contains": "!∋",
    "equals": "=",
    "not-equals": "!=",
};

const OPERATION_CYCLE: FilterOperation[] = ["contains", "not-contains", "equals", "not-equals"];

const PRESET_COLORS = [
    "rgba(239, 68, 68, 0.2)", // red
    "rgba(249, 115, 22, 0.2)", // orange
    "rgba(234, 179, 8, 0.2)", // yellow
    "rgba(34, 197, 94, 0.2)", // green
    "rgba(59, 130, 246, 0.2)", // blue
    "rgba(168, 85, 247, 0.2)", // violet
];

/**
 * FilterComparison - Comparison operation selector with text input and color picker
 */
function FilterComparison({
    operation,
    value,
    color,
    onOperationChange,
    onValueChange,
    onColorChange,
}: FilterComparisonProps) {
    const [showColorPicker, setShowColorPicker] = useState(false);

    // Cycle through operations
    const handleOperationClick = () => {
        const currentIndex = OPERATION_CYCLE.indexOf(operation);
        const nextIndex = (currentIndex + 1) % OPERATION_CYCLE.length;
        onOperationChange(OPERATION_CYCLE[nextIndex]);
    };

    return (
        <div className="flex items-center gap-2">
            {/* Operation toggle button */}
            <button
                className="btn btn-sm btn-ghost font-mono text-lg min-w-[3rem]"
                onClick={handleOperationClick}
                title={`Filter operation: ${operation}`}
            >
                {OPERATION_SYMBOLS[operation]}
            </button>

            {/* Text input */}
            <input
                type="text"
                className="input input-sm input-bordered w-32"
                placeholder="Filter text..."
                value={value}
                onChange={(e) => onValueChange(e.target.value)}
            />

            {/* Color picker */}
            <div className="relative">
                <button
                    className="btn btn-sm btn-square"
                    style={{ backgroundColor: color }}
                    onClick={() => setShowColorPicker(!showColorPicker)}
                    title="Choose color"
                />
                {showColorPicker && (
                    <>
                        {/* Backdrop to close picker */}
                        <div
                            className="fixed inset-0 z-10"
                            onClick={() => setShowColorPicker(false)}
                        />
                        {/* Color picker popup */}
                        <div className="absolute top-full mt-1 right-0 bg-base-200 border border-base-300 rounded-lg p-3 shadow-xl z-20 min-w-max">
                            <div className="grid grid-cols-3 gap-2">
                                {PRESET_COLORS.map((presetColor) => (
                                    <button
                                        key={presetColor}
                                        className="w-10 h-10 flex-shrink-0 rounded border-2 border-base-300 hover:border-primary"
                                        style={{ backgroundColor: presetColor }}
                                        onClick={() => {
                                            onColorChange(presetColor);
                                            setShowColorPicker(false);
                                        }}
                                    />
                                ))}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

export default FilterComparison;
