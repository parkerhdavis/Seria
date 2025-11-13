/**
 * Bundled Print Recipes
 *
 * Pre-defined recipe templates for common print formats.
 * These are the "out of the box" recipes that ship with Juniper.
 *
 * NOTE: This file is being replaced by individual recipe files in src/data/
 * For now, it provides backwards compatibility.
 */

import type { PrintRecipe } from "@/types/printRecipe";
import { SCREENPLAY_RECIPE } from "@/data/screenplayRecipe";

/**
 * Card Print Recipe (Placeholder)
 * TODO: Move to src/data/cardRecipe.ts with proper ingredient structure
 */
export const CARD_PRINT_RECIPE: PrintRecipe = {
    id: "card",
    name: "Card Print",
    description: "Display CSV rows as draggable index cards, like a corkboard for planning and organizing scenes or story beats.",
    type: "card",
    version: "1.0.0",
    isCustom: false,
    ingredients: {
        title: {
            setup: {
                name: "Title",
                description: "The main heading displayed at the top of each card",
                required: true,
                autoMapKeywords: ["title", "name", "heading", "scene", "beat", "summary"],
            },
            style: {
                fontFamily: "Arial",
                fontSize: 16,
                indent: 0,
                lineSpacing: 1.2,
                bold: true,
                textTransform: "none",
                textAlign: "left",
            },
        },
        subtitle: {
            setup: {
                name: "Subtitle",
                description: "Secondary text displayed below the title (e.g., scene type, location)",
                required: false,
                autoMapKeywords: ["subtitle", "type", "category", "location", "setting", "tag"],
            },
            style: {
                fontFamily: "Arial",
                fontSize: 12,
                indent: 0,
                lineSpacing: 1.2,
                italic: true,
                textTransform: "none",
                fontColor: "#666666",
                textAlign: "left",
            },
        },
        content: {
            setup: {
                name: "Content",
                description: "The main body text of the card. Multiple CSV columns can be mapped here.",
                required: false,
                autoMapKeywords: ["content", "description", "body", "text", "notes", "details", "action"],
                multipleAllowed: true,
            },
            style: {
                fontFamily: "Arial",
                fontSize: 11,
                indent: 0,
                lineSpacing: 1.4,
                textTransform: "none",
                textAlign: "left",
            },
        },
    },
    documentSettings: {
        cardWidth: 280,
        cardHeight: 200,
        cardsPerRow: 3,
        cardSpacing: 16,
    },
};

/**
 * Screenplay Print Recipe
 * Re-exported from src/data/screenplayRecipe.ts
 */
export const SCREENPLAY_PRINT_RECIPE: PrintRecipe = SCREENPLAY_RECIPE;

/**
 * Get all bundled recipes
 */
export function getBundledRecipes(): PrintRecipe[] {
    return [CARD_PRINT_RECIPE, SCREENPLAY_PRINT_RECIPE];
}

/**
 * Get a specific bundled recipe by ID
 */
export function getBundledRecipe(id: string): PrintRecipe | undefined {
    return getBundledRecipes().find(recipe => recipe.id === id);
}
