/**
 * Web Worker for ScreenplayPrint calculations
 *
 * Offloads expensive element and page calculations to background thread
 * to keep UI responsive with large files (20k+ rows).
 */

import type { PrintRecipe, RecipeConfiguration, RecipeIngredient } from "@/types/printRecipe";

type ElementType = "scene_heading" | "action" | "character" | "dialogue" | "parenthetical" | "transition";

interface ScreenplayElement {
    type: ElementType;
    content: string;
    rowIndex: number;
    columnName: string;
    sceneNumber?: number;
}

interface CalculateRequest {
    type: "calculate";
    data: string[][];
    headers: string[];
    configuration: RecipeConfiguration;
    recipe: PrintRecipe;
    editingCell: { row: number; col: number } | null;
    editingValue: string;
    continuous: boolean;
}

interface PageWithElements {
    elements: ScreenplayElement[];
    pageNumber: number;
}

interface CalculateResponse {
    type: "result";
    elements: ScreenplayElement[];
    pages: PageWithElements[];
}

interface ErrorResponse {
    type: "error";
    message: string;
}

type WorkerResponse = CalculateResponse | ErrorResponse;

/**
 * Get mapped column name from configuration
 * fieldMappings is an array of {ingredientId, cellColumn, ...}
 */
function getMappedColumn(fieldMappings: RecipeConfiguration["fieldMappings"], fieldName: string): string | undefined {
    if (Array.isArray(fieldMappings)) {
        const mapping = fieldMappings.find((m: any) => m.ingredientId === fieldName);
        return mapping?.cellColumn || undefined;
    }
    // Fallback for object structure (if it exists)
    const mapping = (fieldMappings as any)[fieldName];
    return mapping?.csvColumn || undefined;
}

/**
 * Gets the style configuration for a screenplay element type from the recipe
 */
function getElementStyle(recipe: PrintRecipe, elementType: ElementType): RecipeIngredient["style"] {
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
 * Determines if an element type should support multi-line editing
 */
function isMultiLineElement(type: ElementType): boolean {
    return type === "action" || type === "dialogue";
}

/**
 * Calculate approximate height of a screenplay element in inches
 */
function calculateElementHeight(element: ScreenplayElement, recipe: PrintRecipe): number {
    const elementConfig = getElementStyle(recipe, element.type);
    const fontSize = elementConfig.fontSize || 12; // in points
    const spaceBeforeElement = elementConfig.spaceBeforeElement || 0;
    const spaceAfterElement = elementConfig.spaceAfterElement || 0;

    // Convert font size to inches
    const fontSizeInches = fontSize / 72;

    // Get line height from recipe (default 1.25 if not specified)
    const lineHeightMultiplier = (elementConfig as any).lineHeight ?? 1.25;
    const lineHeightInches = fontSizeInches * lineHeightMultiplier;

    // Estimate number of lines
    let numLines = 1;
    if (isMultiLineElement(element.type)) {
        const maxWidth = ("maxWidth" in elementConfig ? (elementConfig as {maxWidth?: string}).maxWidth : undefined) || "6in";
        const widthInches = parseFloat(maxWidth.replace("in", ""));
        const charsPerLine = Math.floor(widthInches * 10);
        numLines = Math.max(1, Math.ceil(element.content.length / charsPerLine));
    }

    // CSS uses em units for spacing, which are relative to font size (not line height)
    const spacingBeforeInches = spaceBeforeElement * fontSizeInches;
    const spacingAfterInches = spaceAfterElement * fontSizeInches;
    const contentHeight = numLines * lineHeightInches;

    // Account for CSS padding applied to elements:
    // - py-1 = 0.25rem top + 0.25rem bottom = 8px total at 16px base = 0.083 inches (padding)
    // Note: mb-3 class was removed - recipe's spaceBeforeElement/spaceAfterElement have full control over spacing
    const elementPadding = 0.083;

    return spacingBeforeInches + contentHeight + spacingAfterInches + elementPadding;
}

/**
 * Group elements into blocks that should stay together across page breaks
 */
interface ElementBlock {
    elements: ScreenplayElement[];
    totalHeight: number;
}

function groupIntoBlocks(elements: ScreenplayElement[], recipe: PrintRecipe): ElementBlock[] {
    const blocks: ElementBlock[] = [];
    let i = 0;

    while (i < elements.length) {
        const element = elements[i];

        if (element.type === "character") {
            const blockElements: ScreenplayElement[] = [element];
            let blockHeight = calculateElementHeight(element, recipe);
            let j = i + 1;

            while (j < elements.length && elements[j].rowIndex === element.rowIndex) {
                const nextElement = elements[j];
                if (nextElement.type === "parenthetical" || nextElement.type === "dialogue") {
                    blockElements.push(nextElement);
                    blockHeight += calculateElementHeight(nextElement, recipe);
                    j++;
                } else {
                    break;
                }
            }

            blocks.push({ elements: blockElements, totalHeight: blockHeight });
            i = j;
        } else {
            blocks.push({
                elements: [element],
                totalHeight: calculateElementHeight(element, recipe),
            });
            i++;
        }
    }

    return blocks;
}

/**
 * Split elements into pages with special handling for dialogue and action
 *
 * PAGE BREAK RULES (Screenplay-specific overrides to recipe settings):
 * 1. Character names must stay with their dialogue/parentheticals
 *    - If a page break would orphan a Character element without its dialogue, move entire block to next page
 * 2. Dialogue blocks too large for one page split with (MORE) and (CONT'D)
 *    - Add "(MORE)" parenthetical at end of first page
 *    - Repeat character name with " (CONT'D)" appended at start of next page
 * 3. Action elements never split across pages
 *    - If an action doesn't fit, move it entirely to the next page
 */
function splitIntoPages(
    elements: ScreenplayElement[],
    recipe: PrintRecipe,
    pageHeight: number,
    marginTop: number,
    marginBottom: number
): PageWithElements[] {
    const pagesResult: PageWithElements[] = [];
    const usableHeight = pageHeight - marginTop - marginBottom;
    const blocks = groupIntoBlocks(elements, recipe);

    let currentPage: ScreenplayElement[] = [];
    let currentPageHeight = 0;
    let pageNumber = 1;

    blocks.forEach((block, index) => {
        const blockWouldExceedPage = currentPageHeight + block.totalHeight > usableHeight;
        const hasContentOnPage = currentPage.length > 0;

        // Check if this is a character-dialogue block
        const isDialogueBlock = block.elements.length > 1 && block.elements[0].type === "character";

        // PAGE BREAK RULE #1: Never orphan a Character element without its dialogue/parentheticals
        // Check if adding this dialogue block would result in Character on current page but dialogue on next page
        if (isDialogueBlock && hasContentOnPage) {
            const characterEl = block.elements[0];
            const characterHeight = calculateElementHeight(characterEl, recipe);
            const characterWouldFit = currentPageHeight + characterHeight <= usableHeight;
            const fullBlockWouldNotFit = currentPageHeight + block.totalHeight > usableHeight;

            // If Character would fit but the full block wouldn't, we'd orphan the Character
            // Move the entire block to the next page instead
            if (characterWouldFit && fullBlockWouldNotFit) {
                // Close current page and start new page
                pagesResult.push({
                    elements: currentPage,
                    pageNumber: pageNumber,
                });
                pageNumber++;
                currentPage = [];
                currentPageHeight = 0;
                // Fall through to add entire block to new page
                currentPage.push(...block.elements);
                currentPageHeight += block.totalHeight;

                // Handle last block
                if (index === blocks.length - 1) {
                    pagesResult.push({
                        elements: currentPage,
                        pageNumber: pageNumber,
                    });
                }
                return; // Skip the rest of the logic for this block
            }
        }

        if (blockWouldExceedPage && hasContentOnPage) {
            // PAGE BREAK RULE #2: Dialogue blocks too large for one page split with (MORE) and (CONT'D)
            // Check if this is a dialogue block that's too large to fit on one page
            // Only split dialogue if the block itself is larger than a page
            const blockTooLargeForOnePage = block.totalHeight > usableHeight;

            if (isDialogueBlock && blockTooLargeForOnePage) {
                // This dialogue block is too large to fit on a single page, so we need to split it
                // Find dialogue element(s) in the block
                const characterEl = block.elements[0];
                const dialogueEls = block.elements.filter(el => el.type === "dialogue");
                const parentheticalEls = block.elements.filter(el => el.type === "parenthetical");

                if (dialogueEls.length > 0) {
                    // Calculate available space on current page
                    const availableHeight = usableHeight - currentPageHeight;

                    // Calculate height needed for (MORE) parenthetical
                    const moreHeight = calculateElementHeight({
                        type: "parenthetical",
                        content: "(MORE)",
                        rowIndex: characterEl.rowIndex,
                        columnName: characterEl.columnName,
                    }, recipe);

                    // If we have enough space for at least one line of dialogue + (MORE)
                    const fontSize = (recipe.ingredients.dialogue?.style?.fontSize ?? 12) / 72; // Convert pt to inches
                    const lineHeightMultiplier = (recipe.ingredients.dialogue?.style as any)?.lineHeight ?? 1.25;
                    const lineHeight = fontSize * lineHeightMultiplier;
                    const minDialogueSpace = lineHeight + moreHeight;

                    if (availableHeight >= minDialogueSpace) {
                        // Split dialogue: add character, some dialogue, and (MORE) on current page
                        // Then character (cont'd) and remaining dialogue on next page
                        // For now, we'll keep the block together and add (MORE) + (cont'd) markers
                        // This is a simplified implementation - full implementation would split dialogue text

                        // Add (MORE) at end of current page
                        currentPage.push({
                            type: "parenthetical",
                            content: "(MORE)",
                            rowIndex: characterEl.rowIndex,
                            columnName: characterEl.columnName,
                        });

                        // Close current page
                        pagesResult.push({
                            elements: currentPage,
                            pageNumber: pageNumber,
                        });
                        pageNumber++;
                        currentPage = [];
                        currentPageHeight = 0;

                        // Add character (cont'd) at start of next page
                        currentPage.push({
                            type: "character",
                            content: `${characterEl.content} (CONT'D)`,
                            rowIndex: characterEl.rowIndex,
                            columnName: characterEl.columnName,
                            sceneNumber: characterEl.sceneNumber,
                        });
                        currentPageHeight += calculateElementHeight(characterEl, recipe);

                        // Add remaining elements (parentheticals and dialogue)
                        parentheticalEls.forEach(el => {
                            currentPage.push(el);
                            currentPageHeight += calculateElementHeight(el, recipe);
                        });
                        dialogueEls.forEach(el => {
                            currentPage.push(el);
                            currentPageHeight += calculateElementHeight(el, recipe);
                        });

                        return; // Skip the normal block addition below
                    }
                }
            }

            // PAGE BREAK RULE #3: Move entire block to next page
            // This handles action elements (which are single-element blocks) and
            // dialogue blocks that don't fit but aren't large enough to split
            pagesResult.push({
                elements: currentPage,
                pageNumber: pageNumber,
            });
            pageNumber++;
            currentPage = [];
            currentPageHeight = 0;
        }

        // Add entire block to current page
        currentPage.push(...block.elements);
        currentPageHeight += block.totalHeight;

        // Handle last block
        if (index === blocks.length - 1) {
            pagesResult.push({
                elements: currentPage,
                pageNumber: pageNumber,
            });
        }
    });

    if (pagesResult.length === 0) {
        pagesResult.push({
            elements: [],
            pageNumber: 1,
        });
    }

    return pagesResult;
}

self.addEventListener("message", (e: MessageEvent<CalculateRequest>) => {
    const message = e.data;

    if (message.type === "calculate") {
        try {
            const { data, headers, configuration, recipe, editingCell, editingValue, continuous } = message;

            // Get field mappings
            const sceneHeadingColumn = getMappedColumn(configuration.fieldMappings, "scene_heading");
            const actionColumn = getMappedColumn(configuration.fieldMappings, "action");
            const characterColumn = getMappedColumn(configuration.fieldMappings, "character");
            const dialogueColumn = getMappedColumn(configuration.fieldMappings, "dialogue");
            const parentheticalColumn = getMappedColumn(configuration.fieldMappings, "parenthetical");
            const transitionColumn = getMappedColumn(configuration.fieldMappings, "transition");

            // Helper to get cell value
            const getCellValue = (rowIndex: number, colIndex: number): string => {
                if (editingCell && editingCell.row === rowIndex && editingCell.col === colIndex) {
                    return editingValue;
                }
                return data[rowIndex]?.[colIndex] || "";
            };

            // Build elements array
            const elements: ScreenplayElement[] = [];
            let sceneCounter = 0;

            data.forEach((row, rowIndex) => {
                const sceneHeadingIdx = sceneHeadingColumn ? headers.indexOf(sceneHeadingColumn) : -1;
                const actionIdx = actionColumn ? headers.indexOf(actionColumn) : -1;
                const characterIdx = characterColumn ? headers.indexOf(characterColumn) : -1;
                const dialogueIdx = dialogueColumn ? headers.indexOf(dialogueColumn) : -1;
                const parentheticalIdx = parentheticalColumn ? headers.indexOf(parentheticalColumn) : -1;
                const transitionIdx = transitionColumn ? headers.indexOf(transitionColumn) : -1;

                // Transition
                if (transitionIdx >= 0) {
                    const content = getCellValue(rowIndex, transitionIdx);
                    if (content.trim()) {
                        elements.push({
                            type: "transition",
                            content,
                            rowIndex,
                            columnName: headers[transitionIdx],
                        });
                    }
                }

                // Scene heading
                if (sceneHeadingIdx >= 0) {
                    const content = getCellValue(rowIndex, sceneHeadingIdx);
                    if (content.trim()) {
                        sceneCounter++;
                        elements.push({
                            type: "scene_heading",
                            content,
                            rowIndex,
                            columnName: headers[sceneHeadingIdx],
                            sceneNumber: sceneCounter,
                        });
                    }
                }

                // Character + dialogue
                if (characterIdx >= 0 && dialogueIdx >= 0) {
                    const characterContent = getCellValue(rowIndex, characterIdx);
                    const dialogueContent = getCellValue(rowIndex, dialogueIdx);

                    if (characterContent.trim() && dialogueContent.trim()) {
                        elements.push({
                            type: "character",
                            content: characterContent,
                            rowIndex,
                            columnName: headers[characterIdx],
                        });

                        if (parentheticalIdx >= 0) {
                            const parentheticalContent = getCellValue(rowIndex, parentheticalIdx);
                            if (parentheticalContent.trim()) {
                                elements.push({
                                    type: "parenthetical",
                                    content: parentheticalContent,
                                    rowIndex,
                                    columnName: headers[parentheticalIdx],
                                });
                            }
                        }

                        elements.push({
                            type: "dialogue",
                            content: dialogueContent,
                            rowIndex,
                            columnName: headers[dialogueIdx],
                        });
                    }
                }

                // Action
                if (actionIdx >= 0) {
                    const content = getCellValue(rowIndex, actionIdx);
                    if (content.trim()) {
                        elements.push({
                            type: "action",
                            content,
                            rowIndex,
                            columnName: headers[actionIdx],
                        });
                    }
                }
            });

            // Calculate pages (only if not continuous mode)
            let pages: PageWithElements[];

            if (continuous) {
                // Continuous mode: single page with all elements
                pages = [{
                    elements,
                    pageNumber: 1,
                }];
            } else {
                // Paged mode: calculate page breaks
                const pageHeight = recipe.documentSettings.pageHeight ?? 11;
                const marginTop = recipe.documentSettings.marginTop ?? 1;
                const marginBottom = recipe.documentSettings.marginBottom ?? 1;
                pages = splitIntoPages(elements, recipe, pageHeight, marginTop, marginBottom);
            }

            // Send result back
            const response: CalculateResponse = {
                type: "result",
                elements,
                pages,
            };
            self.postMessage(response);
        } catch (error) {
            const errorResponse: ErrorResponse = {
                type: "error",
                message: error instanceof Error ? error.message : "Unknown error",
            };
            self.postMessage(errorResponse);
        }
    }
});
