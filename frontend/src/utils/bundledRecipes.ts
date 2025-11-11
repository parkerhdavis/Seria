/**
 * Bundled Print Recipes
 *
 * Pre-defined recipe templates for common print formats.
 * These are the "out of the box" recipes that ship with Juniper.
 */

import type { PrintRecipe } from "@/types/printRecipe";

/**
 * Card Print Recipe
 * Displays CSV rows as index cards on a corkboard, useful for plotting and outlining
 */
export const CARD_PRINT_RECIPE: PrintRecipe = {
    id: "card",
    name: "Card Print",
    description: "Display CSV rows as draggable index cards, like a corkboard for planning and organizing scenes or story beats.",
    type: "card",
    version: "1.0.0",
    isCustom: false,
    ingredients: [
        {
            id: "title",
            name: "Title",
            description: "The main heading displayed at the top of each card",
            required: true,
            autoMapKeywords: ["title", "name", "heading", "scene", "beat", "summary"],
            defaultStyle: {
                font: "Arial",
                size: 16,
                indent: 0,
                lineSpacing: 1.2,
                bold: true,
                textTransform: "none",
            },
        },
        {
            id: "subtitle",
            name: "Subtitle",
            description: "Secondary text displayed below the title (e.g., scene type, location)",
            required: false,
            autoMapKeywords: ["subtitle", "type", "category", "location", "setting", "tag"],
            defaultStyle: {
                font: "Arial",
                size: 12,
                indent: 0,
                lineSpacing: 1.2,
                italic: true,
                textTransform: "none",
                color: "#666666",
            },
        },
        {
            id: "content",
            name: "Content",
            description: "The main body text of the card. Multiple CSV columns can be mapped here.",
            required: false,
            autoMapKeywords: ["content", "description", "body", "text", "notes", "details", "action"],
            multipleAllowed: true,
            defaultStyle: {
                font: "Arial",
                size: 11,
                indent: 0,
                lineSpacing: 1.4,
                textTransform: "none",
            },
        },
    ],
    renderSettings: {
        cardWidth: 280,
        cardHeight: 200,
        cardsPerRow: 3,
        cardSpacing: 16,
    },
};

/**
 * Screenplay Print Recipe
 * Renders CSV data in industry-standard screenplay format
 */
export const SCREENPLAY_PRINT_RECIPE: PrintRecipe = {
    id: "screenplay",
    name: "Screenplay Print",
    description: "Display CSV data in professional screenplay format with proper margins, capitalization, and industry-standard formatting.",
    type: "screenplay",
    version: "1.0.0",
    isCustom: false,
    ingredients: [
        {
            id: "scene_heading",
            name: "Scene Heading",
            description: "Scene heading (slug line): INT./EXT. + LOCATION + TIME. Displayed in ALL CAPS.",
            required: false,
            autoMapKeywords: ["scene", "heading", "slug", "slugline", "location", "int/ext"],
            defaultStyle: {
                font: "Courier",
                size: 12,
                indent: 0,          // 1.5" from left edge (page margin)
                lineSpacing: 1.0,
                textTransform: "uppercase",
                bold: false,
            },
        },
        {
            id: "action",
            name: "Action",
            description: "Action/description text. Standard case, left-aligned with scene headings.",
            required: false,
            autoMapKeywords: ["action", "description", "desc", "narrative", "stage_direction"],
            defaultStyle: {
                font: "Courier",
                size: 12,
                indent: 0,          // 1.5" from left edge (page margin)
                lineSpacing: 1.0,
                textTransform: "none",
            },
        },
        {
            id: "character",
            name: "Character",
            description: "Character name for dialogue. Displayed in ALL CAPS, indented to 3.7\" from left edge.",
            required: false,
            autoMapKeywords: ["character", "char", "speaker", "name"],
            defaultStyle: {
                font: "Courier",
                size: 12,
                indent: 148,        // 3.7" from left edge = 2.2" indent from action margin (1.5" page margin)
                lineSpacing: 1.0,
                textTransform: "uppercase",
            },
        },
        {
            id: "dialogue",
            name: "Dialogue",
            description: "Character dialogue. Standard case, indented to 2.5\" from left edge, max width 3.5\".",
            required: false,
            autoMapKeywords: ["dialogue", "dialog", "line", "speech"],
            defaultStyle: {
                font: "Courier",
                size: 12,
                indent: 67,         // 2.5" from left edge = 1" indent from action margin
                lineSpacing: 1.0,
                textTransform: "none",
            },
        },
        {
            id: "parenthetical",
            name: "Parenthetical",
            description: "Parenthetical/wryly. Brief action or tone notes within dialogue, in parentheses.",
            required: false,
            autoMapKeywords: ["parenthetical", "paren", "wryly", "direction"],
            defaultStyle: {
                font: "Courier",
                size: 12,
                indent: 107,        // 3.1" from left edge = 0.6" left of character name
                lineSpacing: 1.0,
                textTransform: "none",
            },
        },
        {
            id: "transition",
            name: "Transition",
            description: "Transition (e.g., CUT TO:, FADE OUT:). ALL CAPS with colon, right-aligned.",
            required: false,
            autoMapKeywords: ["transition", "trans"],
            defaultStyle: {
                font: "Courier",
                size: 12,
                indent: 0,          // Right-aligned (handled by renderer)
                lineSpacing: 1.0,
                textTransform: "uppercase",
            },
        },
    ],
    renderSettings: {
        pageWidth: 8.5,
        pageHeight: 11,
        marginTop: 1,
        marginBottom: 1,
        marginLeft: 1.5,
        marginRight: 1,
        showPageNumbers: true,
        startPageNumber: 1,
        sceneNumbering: false,
    },
};

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
