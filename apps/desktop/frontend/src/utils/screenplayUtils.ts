// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Shared Screenplay Utilities
 *
 * Pure functions used by both ScreenplayPrint.tsx and screenplayPrint.worker.ts.
 * This module MUST remain free of React/DOM dependencies so it can be imported
 * by web workers.
 */

import type { PrintRecipe, RecipeIngredient } from "@/types/printRecipe";
import type { ScreenplayElementType } from "@/types/workerMessages";

/**
 * Gets the style configuration for a screenplay element type from the recipe.
 *
 * @param recipe - The print recipe containing ingredient definitions
 * @param elementType - The screenplay element type to look up
 * @returns The style configuration, with sensible defaults if not found
 */
export function getElementStyle(recipe: PrintRecipe, elementType: ScreenplayElementType): RecipeIngredient["style"] {
    const ingredient = recipe.ingredients?.[elementType];
    return ingredient?.style || {
        fontFamily: "Courier",
        fontSize: 12,
        textAlign: "left",
        xMargin: 0,
        spaceBeforeElement: 0,
        spaceAfterElement: 0,
    };
}

/**
 * Determines if an element type should support multi-line editing.
 * Action and dialogue elements can contain multiple lines of text.
 *
 * @param type - The screenplay element type
 * @returns true if the element supports multi-line content
 */
export function isMultiLineElement(type: ScreenplayElementType): boolean {
    return type === "action" || type === "dialogue";
}
