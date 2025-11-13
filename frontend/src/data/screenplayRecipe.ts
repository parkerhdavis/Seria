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

        // Standard screenplay margins (accommodates three-hole punch with brads)
        marginTop: 1,
        marginBottom: 1,
        marginLeft: 1.5,
        marginRight: 1,

        // Page appearance
        backgroundColor: "bg-black/20", // Subtle paper-like background

        // Screenplay-specific settings
        showPageNumbers: true,
        startPageNumber: 2,             // First numbered page is "2" (title page doesn't count)
        pageNumberMarginTop: 0.5,       // Page number position: 0.5" from top
        firstPageNumbered: false,       // First page is unnumbered
        sceneNumbering: true,
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
                fontWeight: 700,
                textTransform: "uppercase",
                textAlign: "left",
                leftMargin: 0,
                rightMargin: 0,
                lineSpaceBefore: 2,
                lineSpaceAfter: 1,
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
                fontFamily: "Courier",
                fontSize: 12,
                textTransform: "none",
                textAlign: "left",
                leftMargin: 0,
                rightMargin: 0,
                lineSpaceBefore: 0,
                lineSpaceAfter: 0,
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
                fontFamily: "Courier",
                fontSize: 12,
                textTransform: "uppercase",
                textAlign: "left",
                leftMargin: 2,
                rightMargin: 0.5,
                lineSpaceBefore: 1.5,
                lineSpaceAfter: -0.75,
                maxWidth: "3.3in",
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
                leftMargin: 1.5,
                rightMargin: 2.0,
                lineSpaceBefore: 0,
                lineSpaceAfter: 0,
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
                fontFamily: "Courier",
                fontSize: 12,
                textTransform: "none",
                textAlign: "left",
                leftMargin: 1.0,
                rightMargin: 1.5,
                lineSpaceBefore: 0,
                lineSpaceAfter: 1.5,
                maxWidth: "3.3in",
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
                leftMargin: 0.5,
                rightMargin: 0.0,
                lineSpaceBefore: 1,
                lineSpaceAfter: 2,
                maxWidth: "1.5in",
            },
        },
    },
    version: "1.0",
    isCustom: false,
};
