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
    pageNumberMarginTop?: number;   // Distance from top of page to page number (in inches)
    firstPageNumbered?: boolean;    // Whether the first page should have a page number
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
        maxWidth?: string;              // CSS max-width value (e.g., "3.3in" for dialogue)
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

        // Screenplay margins (FadeIn flavor)
        marginTop: 1,
        marginBottom: 1,
        marginLeft: 0,  // set on each element
        marginRight: 0, // set on each element

        // Page appearance
        backgroundColor: "bg-black/20", // Subtle paper-like background

        // Screenplay-specific settings
        showPageNumbers: false,
        startPageNumber: 1,
        pageNumberMarginTop: 0.25,
        firstPageNumbered: true,
        sceneNumbering: true,
    },
    // Ingredient definitions (keyed by ID)
    // Each ingredient contains setup (metadata) and style (visual formatting)
    ingredients: {
        transition: {
            setup: {
                name: "Transition",
                description: "Scene transitions (CUT TO:, FADE OUT:, etc.)",
                required: false,
                autoMapKeywords: ["transition", "cut to", "fade"],
                multipleAllowed: false,
            },
            style: {
                fontFamily: "Courier Prime",
                fontSize: 12,
                textTransform: "uppercase",
                textAlign: "right",
                xMargin: 1.25,
                lineHeight: 1.0,
                spaceBeforeElement: 1,
                spaceAfterElement: 1,
                maxWidth: "1.5in",
            },
        },
        scene_heading: {
            setup: {
                name: "Scene Heading",
                description: "Scene headings (INT./EXT., location, time of day)",
                required: false,
                autoMapKeywords: ["scene", "slug", "heading", "slugline"],
                multipleAllowed: false,
            },
            style: {
                fontFamily: "Courier Prime",
                fontSize: 12,
                // fontWeight: 700,
                textTransform: "uppercase",
                textAlign: "left",
                xMargin: 1.25,
                lineHeight: 1.0,
                spaceBeforeElement: 1,
                spaceAfterElement: 1,
                maxWidth: "6in",
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
                fontFamily: "Courier Prime",
                fontSize: 12,
                textTransform: "none",
                textAlign: "left",
                xMargin: 1.25,
                lineHeight: 1.0,
                spaceBeforeElement: 1,
                spaceAfterElement: 1,
                maxWidth: "6in",
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
                fontFamily: "Courier Prime",
                fontSize: 12,
                textTransform: "uppercase",
                textAlign: "left",
                xMargin: 3.75,
                lineHeight: 1.0,
                spaceBeforeElement: 0,
                spaceAfterElement: 0,
                maxWidth: "3.5in",
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
                fontFamily: "Courier Prime",
                fontSize: 12,
                textTransform: "none",
                textAlign: "left",
                xMargin: 3.1,
                lineHeight: 1.0,
                spaceBeforeElement: 0,
                spaceAfterElement: 0,
                maxWidth: "2in",
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
                fontFamily: "Courier Prime",
                fontSize: 12,
                textTransform: "none",
                textAlign: "left",
                xMargin: 2.5,
                lineHeight: 1.0,
                spaceBeforeElement: 0,
                spaceAfterElement: 1,
                maxWidth: "3.9in",
            },
        },
    },
    version: "1.0",
    isCustom: false,
};
