/**
 * Print Recipe Store
 *
 * Manages print recipes, configurations, and field mappings using Zustand.
 * Handles loading bundled recipes, creating custom recipes, and persisting
 * recipe configurations.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
    PrintRecipe,
    RecipeConfiguration,
    RecipeRenderSettings,
} from "@/types/printRecipe";
import { getBundledRecipes } from "@/utils/bundledRecipes";
import { autoMapRecipe, updateFieldMapping, validateRecipeConfiguration } from "@/utils/printRecipeMapper";

interface PrintRecipeState {
    // Available recipes (bundled + custom)
    recipes: PrintRecipe[];

    // Configurations for each recipe (keyed by recipe ID)
    configurations: Record<string, RecipeConfiguration>;

    // Currently selected recipe for preview
    selectedRecipeId: string | null;

    // CSV headers (for field mapping)
    csvHeaders: string[];

    // Actions
    loadBundledRecipes: () => void;
    setCSVHeaders: (headers: string[]) => void;
    selectRecipe: (recipeId: string) => void;
    autoMapFields: (recipeId: string) => void;
    updateMapping: (recipeId: string, ingredientId: string, csvColumn: string | null) => void;
    updateRenderSettings: (recipeId: string, settings: RecipeRenderSettings) => void;
    getConfiguration: (recipeId: string) => RecipeConfiguration | undefined;
    getRecipe: (recipeId: string) => PrintRecipe | undefined;
    validateConfiguration: (recipeId: string) => { isValid: boolean; errors: string[] };
    resetConfiguration: (recipeId: string) => void;
    addCustomRecipe: (recipe: PrintRecipe) => void;
    removeCustomRecipe: (recipeId: string) => void;
}

/**
 * Print Recipe Store
 */
export const usePrintRecipeStore = create<PrintRecipeState>()(
    persist(
        (set, get) => ({
            recipes: [],
            configurations: {},
            selectedRecipeId: null,
            csvHeaders: [],

            /**
             * Loads bundled recipes into the store
             */
            loadBundledRecipes: () => {
                const bundledRecipes = getBundledRecipes();
                set({ recipes: bundledRecipes });

                // Initialize default configurations for bundled recipes if not present
                const { configurations } = get();
                const newConfigurations = { ...configurations };

                bundledRecipes.forEach(recipe => {
                    if (!newConfigurations[recipe.id]) {
                        newConfigurations[recipe.id] = {
                            recipeId: recipe.id,
                            fieldMappings: [],
                            renderSettings: { ...recipe.renderSettings },
                            lastModified: new Date(),
                        };
                    }
                });

                set({ configurations: newConfigurations });
            },

            /**
             * Sets the current CSV headers (triggers auto-mapping if needed)
             */
            setCSVHeaders: (headers: string[]) => {
                set({ csvHeaders: headers });

                // Auto-map the selected recipe if one is selected
                const { selectedRecipeId } = get();
                if (selectedRecipeId) {
                    get().autoMapFields(selectedRecipeId);
                }
            },

            /**
             * Selects a recipe for preview
             */
            selectRecipe: (recipeId: string) => {
                set({ selectedRecipeId: recipeId });

                // Auto-map fields if we have CSV headers
                const { csvHeaders } = get();
                if (csvHeaders.length > 0) {
                    get().autoMapFields(recipeId);
                }
            },

            /**
             * Auto-maps CSV columns to recipe ingredients
             */
            autoMapFields: (recipeId: string) => {
                const { recipes, csvHeaders, configurations } = get();
                const recipe = recipes.find(r => r.id === recipeId);

                if (!recipe || csvHeaders.length === 0) {
                    return;
                }

                const result = autoMapRecipe(recipe, csvHeaders);

                // Update configuration with auto-mapped fields
                const newConfigurations = { ...configurations };
                newConfigurations[recipeId] = {
                    recipeId,
                    fieldMappings: result.mappings,
                    renderSettings: configurations[recipeId]?.renderSettings ?? { ...recipe.renderSettings },
                    lastModified: new Date(),
                };

                set({ configurations: newConfigurations });
            },

            /**
             * Updates a field mapping for a recipe
             */
            updateMapping: (recipeId: string, ingredientId: string, csvColumn: string | null) => {
                const { recipes, configurations } = get();
                const recipe = recipes.find(r => r.id === recipeId);

                if (!recipe) {
                    return;
                }

                const currentConfig = configurations[recipeId];
                if (!currentConfig) {
                    return;
                }

                const { mappings, error } = updateFieldMapping(
                    recipe,
                    currentConfig.fieldMappings,
                    ingredientId,
                    csvColumn
                );

                if (error) {
                    console.error("Error updating field mapping:", error);
                    return;
                }

                // Update configuration
                const newConfigurations = { ...configurations };
                newConfigurations[recipeId] = {
                    ...currentConfig,
                    fieldMappings: mappings,
                    lastModified: new Date(),
                };

                set({ configurations: newConfigurations });
            },

            /**
             * Updates render settings for a recipe
             */
            updateRenderSettings: (recipeId: string, settings: RecipeRenderSettings) => {
                const { configurations } = get();
                const currentConfig = configurations[recipeId];

                if (!currentConfig) {
                    return;
                }

                const newConfigurations = { ...configurations };
                newConfigurations[recipeId] = {
                    ...currentConfig,
                    renderSettings: {
                        ...currentConfig.renderSettings,
                        ...settings,
                    },
                    lastModified: new Date(),
                };

                set({ configurations: newConfigurations });
            },

            /**
             * Gets a recipe configuration by ID
             */
            getConfiguration: (recipeId: string) => {
                return get().configurations[recipeId];
            },

            /**
             * Gets a recipe by ID
             */
            getRecipe: (recipeId: string) => {
                return get().recipes.find(r => r.id === recipeId);
            },

            /**
             * Validates a recipe configuration
             */
            validateConfiguration: (recipeId: string) => {
                const { recipes, configurations } = get();
                const recipe = recipes.find(r => r.id === recipeId);
                const config = configurations[recipeId];

                if (!recipe || !config) {
                    return { isValid: false, errors: ["Recipe or configuration not found"] };
                }

                return validateRecipeConfiguration(recipe, config.fieldMappings);
            },

            /**
             * Resets a recipe configuration to defaults
             */
            resetConfiguration: (recipeId: string) => {
                const { recipes, configurations } = get();
                const recipe = recipes.find(r => r.id === recipeId);

                if (!recipe) {
                    return;
                }

                const newConfigurations = { ...configurations };
                newConfigurations[recipeId] = {
                    recipeId,
                    fieldMappings: [],
                    renderSettings: { ...recipe.renderSettings },
                    lastModified: new Date(),
                };

                set({ configurations: newConfigurations });

                // Re-run auto-mapping
                get().autoMapFields(recipeId);
            },

            /**
             * Adds a custom recipe
             */
            addCustomRecipe: (recipe: PrintRecipe) => {
                const { recipes, configurations } = get();

                // Add recipe
                const newRecipes = [...recipes, recipe];

                // Initialize configuration
                const newConfigurations = { ...configurations };
                newConfigurations[recipe.id] = {
                    recipeId: recipe.id,
                    fieldMappings: [],
                    renderSettings: { ...recipe.renderSettings },
                    lastModified: new Date(),
                };

                set({
                    recipes: newRecipes,
                    configurations: newConfigurations,
                });
            },

            /**
             * Removes a custom recipe
             */
            removeCustomRecipe: (recipeId: string) => {
                const { recipes, configurations, selectedRecipeId } = get();
                const recipe = recipes.find(r => r.id === recipeId);

                // Only allow removing custom recipes
                if (!recipe || !recipe.isCustom) {
                    return;
                }

                // Remove recipe
                const newRecipes = recipes.filter(r => r.id !== recipeId);

                // Remove configuration
                const newConfigurations = { ...configurations };
                delete newConfigurations[recipeId];

                // Clear selection if this recipe was selected
                const newSelectedRecipeId = selectedRecipeId === recipeId ? null : selectedRecipeId;

                set({
                    recipes: newRecipes,
                    configurations: newConfigurations,
                    selectedRecipeId: newSelectedRecipeId,
                });
            },
        }),
        {
            name: "juniper-print-recipe-storage",
            // Only persist configurations and selected recipe, not the recipes themselves
            partialize: (state) => ({
                configurations: state.configurations,
                selectedRecipeId: state.selectedRecipeId,
            }),
        }
    )
);
