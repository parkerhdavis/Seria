/**
 * Tests for shared screenplayUtils
 *
 * Tests getElementStyle and isMultiLineElement functions that are
 * shared between ScreenplayPrint component and screenplayPrint worker.
 */

import { describe, it, expect } from "bun:test";
import { getElementStyle, isMultiLineElement } from "@utils/screenplayUtils";
import type { PrintRecipe } from "@/types/printRecipe";
import type { ScreenplayElementType } from "@/types/workerMessages";

// Minimal recipe fixture for testing
function createTestRecipe(ingredientOverrides?: Record<string, unknown>): PrintRecipe {
    return {
        id: "test-screenplay",
        name: "Test Screenplay",
        description: "Test recipe",
        type: "screenplay",
        version: "1.0",
        isCustom: false,
        documentSettings: {
            pageWidth: 8.5,
            pageHeight: 11,
        },
        ingredients: {
            scene_heading: {
                setup: {
                    name: "Scene Heading",
                    description: "Scene heading",
                    required: true,
                    autoMapKeywords: [],
                },
                style: {
                    fontFamily: "Courier",
                    fontSize: 12,
                    textAlign: "left",
                    xMargin: 1.5,
                    spaceBeforeElement: 2,
                    spaceAfterElement: 1,
                    ...ingredientOverrides,
                },
            },
        },
    } as PrintRecipe;
}

describe("getElementStyle", () => {
    it("returns style from recipe when ingredient exists", () => {
        const recipe = createTestRecipe();
        const style = getElementStyle(recipe, "scene_heading");

        expect(style.fontFamily).toBe("Courier");
        expect(style.fontSize).toBe(12);
        expect(style.xMargin).toBe(1.5);
        expect(style.spaceBeforeElement).toBe(2);
        expect(style.spaceAfterElement).toBe(1);
    });

    it("returns default style when ingredient does not exist", () => {
        const recipe = createTestRecipe();
        const style = getElementStyle(recipe, "dialogue");

        expect(style.fontFamily).toBe("Courier");
        expect(style.fontSize).toBe(12);
        expect(style.textAlign).toBe("left");
        expect(style.xMargin).toBe(0);
        expect(style.spaceBeforeElement).toBe(0);
        expect(style.spaceAfterElement).toBe(0);
    });

    it("returns default style when recipe has no ingredients", () => {
        const recipe = { ...createTestRecipe(), ingredients: {} } as PrintRecipe;
        const style = getElementStyle(recipe, "action");

        expect(style.fontFamily).toBe("Courier");
        expect(style.fontSize).toBe(12);
    });
});

describe("isMultiLineElement", () => {
    const multiLineTypes: ScreenplayElementType[] = ["action", "dialogue"];
    const singleLineTypes: ScreenplayElementType[] = ["scene_heading", "character", "parenthetical", "transition"];

    it.each(multiLineTypes)("returns true for %s", (type) => {
        expect(isMultiLineElement(type)).toBe(true);
    });

    it.each(singleLineTypes)("returns false for %s", (type) => {
        expect(isMultiLineElement(type)).toBe(false);
    });
});
