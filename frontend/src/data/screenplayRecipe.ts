/**
 * Default Screenplay Recipe
 *
 * Defines the industry-standard screenplay format with proper margins,
 * capitalization, and element positioning according to Hollywood conventions.
 */

import type { PrintRecipe, RecipeDocumentSettings, RecipeIngredient } from "@/types/printRecipe";

/**
 * Screenplay-specific document settings
 *
 * Adds pagination and scene numbering
 */
export interface ScreenplayDocumentSettings extends RecipeDocumentSettings {
    showPageNumbers?: boolean;      // Show page numbers
    startPageNumber?: number;       // Starting page number (default 1)
    sceneNumbering?: boolean;       // Show scene numbers
}

/**
 * Screenplay-specific ingredient configuration
 *
 * Extends base RecipeIngredient with screenplay-specific styling
 */
export interface ScreenplayIngredient extends RecipeIngredient {
    style: RecipeIngredient["style"] & {
        // Screenplay-specific additions
        maxWidth?: string;              // CSS max-width value (e.g., "3.5in" for dialogue)
    };
}

/**
 * Screenplay-specific recipe type
 *
 * Uses ScreenplayIngredient for ingredients and ScreenplayDocumentSettings for document config
 */
export interface ScreenplayRecipe extends PrintRecipe {
    ingredients: Record<string, ScreenplayIngredient>;
    documentSettings: ScreenplayDocumentSettings;
}


/**
 * Default Screenplay Print Recipe
 * Industry-standard Hollywood screenplay format
 */
export const SCREENPLAY_RECIPE: ScreenplayRecipe = {
    id: "screenplay",
    name: "Screenplay Print",
    description: "Industry-standard screenplay format following Hollywood conventions",
    type: "screenplay",
    documentSettings: {
        // Page dimensions (standard US Letter)
        pageWidth: 8.5,
        pageHeight: 11,

        // Standard screenplay margins
        marginTop: 1,
        marginBottom: 1,
        marginLeft: 1.5,
        marginRight: 1,

        // Screenplay-specific settings
        showPageNumbers: true,
        startPageNumber: 1,
        sceneNumbering: false,
    },
    // Ingredient definitions (keyed by ID)
    // Each ingredient contains setup (metadata) and style (visual formatting)
    ingredients: {
        scene_heading: {
            setup: {
                name: "Scene Heading",
                description: "Scene headings (INT./EXT., location, time of day)",
                required: false,
                autoMapKeywords: ["scene", "slug", "heading", "slugline"],
                multipleAllowed: false,
            },
            style: {
                fontFamily: "Courier",
                fontSize: 12,
                bold: true,
                textTransform: "uppercase",
                textAlign: "left",
                indent: 0,
                lineSpacing: 1,
            },
        },
        action: {
            setup: {
                name: "Action",
                description: "Action lines and scene description",
                required: false,
                autoMapKeywords: ["action", "description", "scene description"],
                multipleAllowed: false,
            },
            style: {
                fontFamily: "Courier",
                fontSize: 12,
                textTransform: "none",
                textAlign: "left",
                indent: 0,
                lineSpacing: 1,
            },
        },
        character: {
            setup: {
                name: "Character",
                description: "Character name (appears before dialogue)",
                required: false,
                autoMapKeywords: ["character", "name", "speaker"],
                multipleAllowed: false,
            },
            style: {
                fontFamily: "Courier",
                fontSize: 12,
                textTransform: "uppercase",
                textAlign: "left",
                indent: 2.2,  // 2.2" from left margin (3.7" from page edge)
                lineSpacing: 1,
            },
        },
        dialogue: {
            setup: {
                name: "Dialogue",
                description: "Character dialogue",
                required: false,
                autoMapKeywords: ["dialogue", "line", "speech"],
                multipleAllowed: false,
            },
            style: {
                fontFamily: "Courier",
                fontSize: 12,
                textTransform: "none",
                textAlign: "left",
                indent: 1.0,   // 1" from left margin (2.5" from page edge)
                lineSpacing: 1,
                maxWidth: "3.5in",  // Screenplay-specific
            },
        },
        parenthetical: {
            setup: {
                name: "Parenthetical",
                description: "Parenthetical directions (actor instructions)",
                required: false,
                autoMapKeywords: ["parenthetical", "wryly", "direction", "paren"],
                multipleAllowed: false,
            },
            style: {
                fontFamily: "Courier",
                fontSize: 12,
                textTransform: "none",
                textAlign: "left",
                indent: 1.6,   // 1.6" from left margin (3.1" from page edge)
                lineSpacing: 1,
            },
        },
        transition: {
            setup: {
                name: "Transition",
                description: "Scene transitions (CUT TO:, FADE OUT:, etc.)",
                required: false,
                autoMapKeywords: ["transition", "cut to", "fade"],
                multipleAllowed: false,
            },
            style: {
                fontFamily: "Courier",
                fontSize: 12,
                textTransform: "uppercase",
                textAlign: "right",
                indent: 0,
                lineSpacing: 1,
            },
        },
    },
    version: "1.0",
    isCustom: false,
};
