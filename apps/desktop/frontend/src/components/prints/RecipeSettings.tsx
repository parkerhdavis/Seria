// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Recipe Settings Component
 *
 * Displays available Print Recipes and their configurations.
 * Allows users to view recipe ingredients and field mappings.
 * Future: Allow customization of recipes.
 */

import { useEffect, useState } from "react";
import { usePrintRecipeStore } from "@stores/printRecipeStore";
import type { PrintRecipe, RecipeIngredient } from "@/types/printRecipe";
import { getMappedColumn } from "@utils/printRecipeMapper";

/**
 * Recipe card showing recipe details
 */
function RecipeCard({ recipe }: { recipe: PrintRecipe }) {
    const [isExpanded, setIsExpanded] = useState(false);
    const { configurations } = usePrintRecipeStore();
    const config = configurations[recipe.id];

    return (
        <div className="card bg-base-100 border border-base-300 shadow-sm">
            <div className="card-body">
                {/* Recipe header */}
                <div className="flex items-start justify-between">
                    <div className="flex-1">
                        <h3 className="card-title text-lg">
                            {recipe.name}
                            {recipe.isCustom && (
                                <span className="badge badge-sm badge-primary">Custom</span>
                            )}
                        </h3>
                        <p className="text-sm text-base-content/70 mt-1">
                            {recipe.description}
                        </p>
                    </div>
                    <button
                        className="btn btn-ghost btn-sm btn-circle"
                        onClick={() => setIsExpanded(!isExpanded)}
                        title={isExpanded ? "Collapse" : "Expand"}
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className={`h-5 w-5 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                </div>

                {/* Recipe metadata */}
                <div className="flex gap-4 text-xs text-base-content/60 mt-2">
                    <span>
                        <span className="font-semibold">Type:</span> {recipe.type}
                    </span>
                    <span>
                        <span className="font-semibold">Version:</span> {recipe.version}
                    </span>
                    <span>
                        <span className="font-semibold">Ingredients:</span>{" "}
                        {Object.keys(recipe.ingredients || {}).length}
                    </span>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-base-300">
                        <h4 className="font-semibold text-sm mb-3">Recipe Ingredients</h4>
                        <div className="space-y-3">
                            {Object.entries(recipe.ingredients || {}).map(([id, ingredient]) => (
                                <IngredientRow
                                    key={id}
                                    ingredientId={id}
                                    ingredient={ingredient}
                                    mappedColumn={config ? getMappedColumn(config.fieldMappings, id) : null}
                                />
                            ))}
                        </div>

                        {/* Document settings */}
                        <h4 className="font-semibold text-sm mb-3 mt-6">Document Settings</h4>
                        <div className="bg-base-200 rounded-lg p-3 font-mono text-xs">
                            <pre className="whitespace-pre-wrap">
                                {JSON.stringify(recipe.documentSettings, null, 2)}
                            </pre>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

/**
 * Individual ingredient row
 */
function IngredientRow({
    ingredientId,
    ingredient,
    mappedColumn,
}: {
    ingredientId: string;
    ingredient: RecipeIngredient;
    mappedColumn: string | null;
}) {
    return (
        <div className="bg-base-200 rounded-lg p-3">
            <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{ingredient.setup.name || ingredientId}</span>
                    {ingredient.setup.required && (
                        <span className="badge badge-xs badge-error">Required</span>
                    )}
                </div>
                {mappedColumn && (
                    <span className="badge badge-sm badge-success gap-1">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Mapped
                    </span>
                )}
            </div>

            {ingredient.setup.description && (
                <p className="text-xs text-base-content/70 mb-2">
                    {ingredient.setup.description}
                </p>
            )}

            {ingredient.setup.autoMapKeywords && ingredient.setup.autoMapKeywords.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                    {ingredient.setup.autoMapKeywords.map((keyword) => (
                        <span key={keyword} className="badge badge-xs badge-ghost">
                            {keyword}
                        </span>
                    ))}
                </div>
            )}

            {mappedColumn && (
                <div className="text-xs text-base-content/60 mt-2 pt-2 border-t border-base-300">
                    <span className="font-semibold">Currently mapped to:</span>{" "}
                    <code className="bg-base-300 px-1 py-0.5 rounded">{mappedColumn}</code>
                </div>
            )}
        </div>
    );
}

/**
 * Recipe Settings Component
 */
function RecipeSettings() {
    const { recipes, loadBundledRecipes } = usePrintRecipeStore();
    const [filterType, setFilterType] = useState<"all" | "bundled" | "custom">("all");

    // Load bundled recipes on mount
    useEffect(() => {
        loadBundledRecipes();
    }, [loadBundledRecipes]);

    // Filter recipes
    const filteredRecipes = recipes.filter((recipe) => {
        if (filterType === "all") return true;
        if (filterType === "bundled") return !recipe.isCustom;
        if (filterType === "custom") return recipe.isCustom;
        return true;
    });

    return (
        <div className="card bg-base-200 shadow-md">
            <div className="card-body">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="card-title text-xl">Print Recipes</h2>
                    <div className="flex gap-2">
                        <button
                            className="btn btn-ghost btn-sm"
                            disabled
                            title="Coming soon"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Create Custom Recipe
                        </button>
                    </div>
                </div>

                <p className="text-sm text-base-content/70 mb-4">
                    Print Recipes define how your Cell Data is visualized in different formats.
                    Each recipe has "ingredients" that map to your Cell columns.
                </p>

                {/* Filter tabs */}
                <div className="tabs tabs-boxed mb-4">
                    <button
                        className={`tab ${filterType === "all" ? "tab-active" : ""}`}
                        onClick={() => setFilterType("all")}
                    >
                        All Recipes
                    </button>
                    <button
                        className={`tab ${filterType === "bundled" ? "tab-active" : ""}`}
                        onClick={() => setFilterType("bundled")}
                    >
                        Bundled
                    </button>
                    <button
                        className={`tab ${filterType === "custom" ? "tab-active" : ""}`}
                        onClick={() => setFilterType("custom")}
                    >
                        Custom
                    </button>
                </div>

                {/* Recipe list */}
                <div className="space-y-4">
                    {filteredRecipes.length === 0 ? (
                        <div className="text-center py-12 text-base-content/50">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <p>
                                {filterType === "custom"
                                    ? "No custom recipes yet. Create one to get started!"
                                    : "No recipes found"}
                            </p>
                        </div>
                    ) : (
                        filteredRecipes.map((recipe) => (
                            <RecipeCard key={recipe.id} recipe={recipe} />
                        ))
                    )}
                </div>

                {/* Help text */}
                <div className="alert alert-info mt-6">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    <div className="text-sm">
                        <p className="font-semibold mb-1">How Recipe Mapping Works</p>
                        <p>
                            When you open a Cell file and select a Print Recipe, Seria automatically
                            tries to map your Cell columns to the recipe's ingredients based on column names.
                            You can always manually adjust these mappings in the Print Preview.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default RecipeSettings;
