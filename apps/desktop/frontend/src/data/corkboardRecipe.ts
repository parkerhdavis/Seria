/**
 * Default Corkboard Recipe
 *
 * Displays Cell rows as draggable index cards, like a corkboard for planning
 * and organizing scenes or story beats.
 */

import type { PrintRecipe, RecipeDocumentSettings, RecipeIngredient } from "@/types/printRecipe";

/**
 * Corkboard-specific document settings
 *
 * Adds card dimensions and layout configuration
 */
export interface CorkboardDocumentSettings extends RecipeDocumentSettings {
    cardWidth?: number;             // Card width in pixels (default 280)
    cardHeight?: number;            // Card height in pixels (default 200)
    cardsPerRow?: number;           // Number of cards per row (default 3)
    cardSpacing?: number;           // Spacing between cards in pixels (default 16)
}

/**
 * Corkboard-specific ingredient configuration
 *
 * Currently uses base RecipeIngredient without additional corkboard-specific styling.
 * This interface exists for future extensibility.
 */
export interface CorkboardIngredient extends RecipeIngredient {
    style: RecipeIngredient["style"];
}

/**
 * Corkboard-specific recipe type
 *
 * Uses CorkboardIngredient for ingredients and CorkboardDocumentSettings for document config
 */
export interface CorkboardRecipe extends PrintRecipe {
    ingredients: Record<string, CorkboardIngredient>;
    documentSettings: CorkboardDocumentSettings;
}


/**
 * Default Corkboard Print Recipe
 * Visual card-based layout for planning and organizing content
 */
export const CORKBOARD_RECIPE: CorkboardRecipe = {
    id: "corkboard",
    name: "Corkboard Print",
    description: "Display Cell rows as draggable index cards, like a corkboard for planning and organizing scenes or story beats.",
    type: "corkboard",
    documentSettings: {
        cardWidth: 280,
        cardHeight: 200,
        cardsPerRow: 3,
        cardSpacing: 16,
        backgroundColor: "bg-base-200",     // Default background color for corkboard
    },
    // Ingredient definitions (keyed by ID)
    // Each ingredient contains setup (metadata) and style (visual formatting)
    ingredients: {
        title: {
            setup: {
                name: "Title",
                description: "The main heading displayed at the top of each card",
                required: true,
                autoMapKeywords: ["title", "name", "heading", "scene", "beat", "summary"],
                multipleAllowed: false,
            },
            style: {
                fontFamily: "Arial",
                fontSize: 16,
                fontWeight: 700,
                textTransform: "none",
                textAlign: "left",
                xMargin: 0,
                spaceBeforeElement: 0,
                spaceAfterElement: 0.2,
            },
        },
        subtitle: {
            setup: {
                name: "Subtitle",
                description: "Secondary text displayed below the title (e.g., scene type, location)",
                required: false,
                autoMapKeywords: ["subtitle", "type", "category", "location", "setting", "tag"],
                multipleAllowed: false,
            },
            style: {
                fontFamily: "Arial",
                fontSize: 12,
                italic: true,
                textTransform: "none",
                fontColor: "text-base-content/60",  // Subtle text color using utility class
                textAlign: "left",
                xMargin: 0,
                spaceBeforeElement: 0,
                spaceAfterElement: 0.4,
            },
        },
        content: {
            setup: {
                name: "Content",
                description: "The main body text of the card. Multiple Cell columns can be mapped here.",
                required: false,
                autoMapKeywords: ["content", "description", "body", "text", "notes", "details", "action"],
                multipleAllowed: true,
            },
            style: {
                fontFamily: "Arial",
                fontSize: 11,
                textTransform: "none",
                textAlign: "left",
                xMargin: 0,
                spaceBeforeElement: 0,
                spaceAfterElement: 0.4,
            },
        },
    },
    version: "1.0",
    isCustom: false,
};
