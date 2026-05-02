// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Mapping Modal Component
 *
 * Allows users to edit field mappings between Cell columns and Print recipe ingredients.
 * Two-column layout: Cell fields (dropdowns) on the left, Recipe ingredients (text) on the right.
 */

import { useState, useEffect } from "react";
import type { PrintRecipe, RecipeFieldMapping } from "@/types/printRecipe";

interface MappingModalProps {
    isOpen: boolean;
    onClose: () => void;
    recipe: PrintRecipe;
    cellHeaders: string[];
    fieldMappings: RecipeFieldMapping[];
    onUpdateMapping: (ingredientId: string, cellColumn: string | null) => void;
}

/**
 * MappingModal - Edit field mappings for a recipe
 */
function MappingModal({
    isOpen,
    onClose,
    recipe,
    cellHeaders,
    fieldMappings,
    onUpdateMapping,
}: MappingModalProps) {
    // Local state for mappings (to allow cancel)
    const [localMappings, setLocalMappings] = useState<Record<string, string | null>>({});

    // Initialize local mappings when modal opens
    useEffect(() => {
        if (isOpen) {
            const mappingsMap: Record<string, string | null> = {};
            fieldMappings.forEach(mapping => {
                mappingsMap[mapping.ingredientId] = mapping.cellColumn;
            });
            setLocalMappings(mappingsMap);
        }
    }, [isOpen, fieldMappings]);

    // Handle save
    const handleSave = () => {
        // Update all mappings
        Object.entries(localMappings).forEach(([ingredientId, cellColumn]) => {
            onUpdateMapping(ingredientId, cellColumn);
        });
        onClose();
    };

    // Handle cancel
    const handleCancel = () => {
        onClose();
    };

    if (!isOpen) return null;

    // Get list of ingredients
    const ingredients = Object.entries(recipe.ingredients || {});

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50" onClick={handleCancel}>
            <div
                className="bg-base-100 rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[80vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-base-300">
                    <h2 className="text-lg font-semibold">Field Mapping - {recipe.name}</h2>
                    <button
                        className="btn btn-sm btn-ghost btn-circle"
                        onClick={handleCancel}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-4">
                    <p className="text-sm text-base-content/70 mb-4">
                        Map your Cell columns to {recipe.name} fields. Select a Cell column for each recipe field below.
                    </p>

                    {/* Two-column layout */}
                    <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-start">
                        {/* Left column header */}
                        <div className="font-semibold text-sm text-base-content/70">Cell Column</div>
                        <div></div>
                        {/* Right column header */}
                        <div className="font-semibold text-sm text-base-content/70">Recipe Field</div>

                        {/* Mapping rows */}
                        {ingredients.map(([ingredientId, ingredient]) => {
                            const currentMapping = localMappings[ingredientId] ?? null;
                            const isRequired = ingredient.setup.required;

                            return (
                                <div key={ingredientId} className="contents">
                                    {/* Left: Cell column dropdown */}
                                    <div>
                                        <select
                                            className="select select-sm select-bordered w-full"
                                            value={currentMapping ?? ""}
                                            onChange={(e) => {
                                                const value = e.target.value || null;
                                                setLocalMappings({
                                                    ...localMappings,
                                                    [ingredientId]: value,
                                                });
                                            }}
                                        >
                                            <option value="">(none)</option>
                                            {cellHeaders.map((header) => (
                                                <option key={header} value={header}>
                                                    {header}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Middle: Arrow */}
                                    <div className="flex items-center justify-center text-base-content/30">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                        </svg>
                                    </div>

                                    {/* Right: Recipe ingredient name and description */}
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium text-sm">
                                                {ingredient.setup.name}
                                            </span>
                                            {isRequired && (
                                                <span className="badge badge-xs badge-error">required</span>
                                            )}
                                        </div>
                                        <span className="text-xs text-base-content/60">
                                            {ingredient.setup.description}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-2 p-4 border-t border-base-300">
                    <button
                        className="btn btn-sm btn-ghost"
                        onClick={handleCancel}
                    >
                        Cancel
                    </button>
                    <button
                        className="btn btn-sm btn-primary"
                        onClick={handleSave}
                    >
                        Save Mappings
                    </button>
                </div>
            </div>
        </div>
    );
}

export default MappingModal;
