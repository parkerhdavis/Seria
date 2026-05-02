// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Shared Mapping Utilities
 *
 * Common functions for mapping Cell columns to recipe ingredients.
 * Used by both Web Workers and main thread code.
 */

import type { RecipeFieldMapping } from "@/types/printRecipe";

/**
 * Gets the mapped Cell column for a specific ingredient.
 *
 * @param fieldMappings - Array of field mappings from recipe configuration
 * @param ingredientId - The ingredient ID to look up
 * @returns The mapped column name, or null if not mapped
 */
export function getMappedColumn(
    fieldMappings: RecipeFieldMapping[],
    ingredientId: string
): string | null {
    const mapping = fieldMappings.find((m) => m.ingredientId === ingredientId);
    return mapping?.cellColumn ?? null;
}

/**
 * Gets all mapped Cell columns for an ingredient that allows multiple mappings.
 * Results are sorted by the mapping's order property.
 *
 * @param fieldMappings - Array of field mappings from recipe configuration
 * @param ingredientId - The ingredient ID to look up
 * @returns Array of mapped column names (empty if none mapped)
 */
export function getMappedColumns(
    fieldMappings: RecipeFieldMapping[],
    ingredientId: string
): string[] {
    return fieldMappings
        .filter((m) => m.ingredientId === ingredientId && m.cellColumn !== null)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((m) => m.cellColumn!);
}

/**
 * Gets the column index for a mapped ingredient.
 * Convenience function that combines getMappedColumn with headers lookup.
 *
 * @param fieldMappings - Array of field mappings from recipe configuration
 * @param ingredientId - The ingredient ID to look up
 * @param headers - Array of column headers
 * @returns The column index, or -1 if not mapped or not found
 */
export function getMappedColumnIndex(
    fieldMappings: RecipeFieldMapping[],
    ingredientId: string,
    headers: string[]
): number {
    const column = getMappedColumn(fieldMappings, ingredientId);
    return column ? headers.indexOf(column) : -1;
}

/**
 * Gets all column indices for an ingredient that allows multiple mappings.
 * Convenience function that combines getMappedColumns with headers lookup.
 *
 * @param fieldMappings - Array of field mappings from recipe configuration
 * @param ingredientId - The ingredient ID to look up
 * @param headers - Array of column headers
 * @returns Array of column indices (excludes any that aren't found in headers)
 */
export function getMappedColumnIndices(
    fieldMappings: RecipeFieldMapping[],
    ingredientId: string,
    headers: string[]
): number[] {
    const columns = getMappedColumns(fieldMappings, ingredientId);
    return columns
        .map((col) => headers.indexOf(col))
        .filter((idx) => idx >= 0);
}
