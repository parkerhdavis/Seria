// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Data Transformation Module
 *
 * Consolidated exports for all data transformation utilities.
 * Import from this module for a clean API:
 *
 * ```ts
 * import { getMappedColumn, createCellValueGetter } from '@/utils/dataTransform';
 * ```
 */

// Mapping utilities - for recipe field mapping
export {
    getMappedColumn,
    getMappedColumns,
    getMappedColumnIndex,
    getMappedColumnIndices,
} from "../mappingUtils";

// Transformation utilities - for data access and calculation
export {
    createCellValueGetter,
    getColumnIndex,
    getColumnIndices,
    extractRowValues,
    estimateLineCount,
    pointsToInches,
    estimateCharsPerLine,
    type EditingCell,
} from "../transformUtils";

// Re-export from printRecipeMapper for auto-mapping
export {
    autoMapRecipe,
    validateRecipeConfiguration,
    updateFieldMapping,
} from "../printRecipeMapper";
