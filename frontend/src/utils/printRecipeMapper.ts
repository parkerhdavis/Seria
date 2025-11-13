/**
 * Print Recipe Auto-Mapping Utility
 *
 * Intelligently maps CSV columns to recipe elements based on column names
 * and keyword matching. Provides a confidence score for each mapping.
 */

import type {
    PrintRecipe,
    RecipeFieldMapping,
    AutoMapResult,
    RecipeIngredient,
} from "@/types/printRecipe";

/**
 * Calculates similarity score between two strings (0-1)
 * Uses a combination of exact match, contains match, and fuzzy matching
 */
function calculateSimilarity(str1: string, str2: string): number {
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();

    // Exact match
    if (s1 === s2) return 1.0;

    // Contains match (higher score if str1 contains str2 or vice versa)
    if (s1.includes(s2) || s2.includes(s1)) {
        const longer = Math.max(s1.length, s2.length);
        const shorter = Math.min(s1.length, s2.length);
        return 0.7 + (shorter / longer) * 0.3; // 0.7-1.0 range
    }

    // Fuzzy match - check for common words
    const words1 = s1.split(/[\s_-]+/);
    const words2 = s2.split(/[\s_-]+/);
    let matchingWords = 0;

    for (const word1 of words1) {
        for (const word2 of words2) {
            if (word1 === word2 && word1.length > 2) { // Only count words longer than 2 chars
                matchingWords++;
            }
        }
    }

    if (matchingWords > 0) {
        const maxWords = Math.max(words1.length, words2.length);
        return 0.5 * (matchingWords / maxWords); // 0-0.5 range
    }

    return 0;
}

/**
 * Finds the best matching CSV column for a recipe ingredient
 * Returns the column name and confidence score
 */
function findBestMatch(
    ingredientId: string,
    ingredient: RecipeIngredient,
    availableColumns: string[]
): { column: string | null; confidence: number } {
    let bestMatch: string | null = null;
    let bestScore = 0;

    // If no auto-map keywords, return no match
    if (!ingredient.setup.autoMapKeywords || ingredient.setup.autoMapKeywords.length === 0) {
        return { column: null, confidence: 0 };
    }

    for (const column of availableColumns) {
        // Check against all auto-map keywords for this ingredient
        for (const keyword of ingredient.setup.autoMapKeywords) {
            const score = calculateSimilarity(column, keyword);
            if (score > bestScore) {
                bestScore = score;
                bestMatch = column;
            }
        }
    }

    // Only return matches with confidence > 0.5 (reasonable threshold)
    if (bestScore > 0.5) {
        return { column: bestMatch, confidence: bestScore };
    }

    return { column: null, confidence: 0 };
}

/**
 * Auto-maps CSV columns to recipe ingredients
 * Returns mapping results with confidence scores
 */
export function autoMapRecipe(
    recipe: PrintRecipe,
    csvHeaders: string[]
): AutoMapResult {
    const mappings: RecipeFieldMapping[] = [];
    const unmappedIngredients: string[] = [];
    const usedColumns = new Set<string>();

    // Get ingredients from recipe
    const ingredients = recipe.ingredients || {};

    // Convert ingredients object to array with IDs, then sort by required status (required first)
    const ingredientEntries = Object.entries(ingredients).map(([id, ingredient]) => ({
        id,
        ingredient,
    })).sort((a, b) => {
        const aRequired = a.ingredient.setup.required ?? false;
        const bRequired = b.ingredient.setup.required ?? false;
        if (aRequired && !bRequired) return -1;
        if (!aRequired && bRequired) return 1;
        return 0;
    });

    let totalConfidence = 0;
    let mappingCount = 0;

    // Try to map each ingredient
    for (const { id, ingredient } of ingredientEntries) {
        // Get available columns (exclude already used, unless multipleAllowed is true)
        const multipleAllowed = ingredient.setup.multipleAllowed ?? false;
        const availableColumns = csvHeaders.filter(col => !usedColumns.has(col) || multipleAllowed);

        const { column, confidence } = findBestMatch(id, ingredient, availableColumns);

        if (column) {
            mappings.push({
                ingredientId: id,
                csvColumn: column,
                isAutoMapped: true,
                order: 0,
            });

            if (!multipleAllowed) {
                usedColumns.add(column);
            }
            totalConfidence += confidence;
            mappingCount++;
        } else {
            // Couldn't find a match for this ingredient
            unmappedIngredients.push(id);

            // For required ingredients that couldn't be mapped, create an empty mapping
            if (ingredient.setup.required) {
                mappings.push({
                    ingredientId: id,
                    csvColumn: null,
                    isAutoMapped: false,
                    order: 0,
                });
            }
        }
    }

    // Calculate overall confidence
    const overallConfidence = mappingCount > 0
        ? totalConfidence / mappingCount
        : 0;

    // Find unmapped columns
    const unmappedColumns = csvHeaders.filter(col => !usedColumns.has(col));

    return {
        mappings,
        unmappedIngredients,
        unmappedColumns,
        confidence: overallConfidence,
    };
}

/**
 * Validates a recipe configuration
 * Checks that all required ingredients are mapped
 */
export function validateRecipeConfiguration(
    recipe: PrintRecipe,
    mappings: RecipeFieldMapping[]
): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    const mappedIngredients = new Set(
        mappings
            .filter(m => m.csvColumn !== null)
            .map(m => m.ingredientId)
    );

    // Get ingredients from recipe
    const ingredients = recipe.ingredients || {};

    // Check that all required ingredients are mapped
    for (const [id, ingredient] of Object.entries(ingredients)) {
        if (ingredient.setup.required && !mappedIngredients.has(id)) {
            errors.push(
                `Required ingredient "${ingredient.setup.name || id}" is not mapped to a CSV column`
            );
        }
    }

    return {
        isValid: errors.length === 0,
        errors,
    };
}

/**
 * Updates a single field mapping in a configuration
 * Handles validation and provides helpful error messages
 */
export function updateFieldMapping(
    recipe: PrintRecipe,
    currentMappings: RecipeFieldMapping[],
    ingredientId: string,
    newColumn: string | null
): { mappings: RecipeFieldMapping[]; error?: string } {
    // Get ingredients from recipe
    const ingredients = recipe.ingredients || {};
    const ingredient = ingredients[ingredientId];

    if (!ingredient) {
        return {
            mappings: currentMappings,
            error: `Ingredient "${ingredientId}" not found in recipe`,
        };
    }

    // Find existing mapping for this ingredient
    const existingIndex = currentMappings.findIndex(
        m => m.ingredientId === ingredientId
    );

    if (existingIndex >= 0) {
        // Update existing mapping
        const updatedMappings = [...currentMappings];
        updatedMappings[existingIndex] = {
            ...updatedMappings[existingIndex],
            csvColumn: newColumn,
            isAutoMapped: false, // User manually changed it
        };
        return { mappings: updatedMappings };
    } else {
        // Add new mapping
        const newMapping: RecipeFieldMapping = {
            ingredientId,
            csvColumn: newColumn,
            isAutoMapped: false,
            order: 0,
        };
        return { mappings: [...currentMappings, newMapping] };
    }
}

/**
 * Gets the mapped CSV column for a specific element
 */
export function getMappedColumn(
    mappings: RecipeFieldMapping[],
    elementId: string
): string | null {
    const mapping = mappings.find(m => m.ingredientId === elementId);
    return mapping?.csvColumn ?? null;
}

/**
 * Gets all mappings for an element (for elements that allow multiple)
 */
export function getMappedColumns(
    mappings: RecipeFieldMapping[],
    elementId: string
): string[] {
    return mappings
        .filter(m => m.ingredientId === elementId && m.csvColumn !== null)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map(m => m.csvColumn!);
}
