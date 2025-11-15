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
    splitIndex?: number; // For dialogue split across pages: 0 = first part, 1 = continued part
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
 * Returns an object with contentHeight (text + spaceBeforeElement) and spaceAfterElement separately
 * This allows for proper CSS-style margin collapsing
 */
function calculateElementHeight(element: ScreenplayElement, recipe: PrintRecipe, excludeSpaceAfter: boolean = false): number {
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
    const spacingAfterInches = excludeSpaceAfter ? 0 : spaceAfterElement * fontSizeInches;
    const contentHeight = numLines * lineHeightInches;

    // Note: py-1 class and mb-3 class were removed - recipe settings have full control over spacing
    return spacingBeforeInches + contentHeight + spacingAfterInches;
}

/**
 * Calculate how much height an element will add with CSS-style margin collapsing
 * @param previousSpaceAfter - The spaceAfterElement from the previous element (0 if first element on page)
 */
function calculateElementHeightWithCollapsing(
    element: ScreenplayElement,
    recipe: PrintRecipe,
    previousSpaceAfter: number
): { heightAdded: number; spaceAfter: number } {
    const elementConfig = getElementStyle(recipe, element.type);
    const fontSize = elementConfig.fontSize || 12;
    const fontSizeInches = fontSize / 72;
    const spaceBeforeElement = elementConfig.spaceBeforeElement || 0;
    const spaceAfterElement = elementConfig.spaceAfterElement || 0;

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

    const spacingBeforeInches = spaceBeforeElement * fontSizeInches;
    const spacingAfterInches = spaceAfterElement * fontSizeInches;
    const contentHeight = numLines * lineHeightInches;

    // CSS margin collapsing: use the larger of previousSpaceAfter and current spaceBeforeElement
    const collapsedSpacing = Math.max(previousSpaceAfter, spacingBeforeInches);

    return {
        heightAdded: collapsedSpacing + contentHeight,
        spaceAfter: spacingAfterInches,
    };
}

/**
 * Split dialogue text to fit within available height
 * Returns array of [firstPart, remainingPart] or null if can't split
 */
function splitDialogueText(
    dialogueContent: string,
    availableHeight: number,
    recipe: PrintRecipe,
    reserveHeightForMore: number
): [string, string] | null {
    const dialogueStyle = recipe.ingredients.dialogue?.style;
    if (!dialogueStyle) {
        console.log("[splitDialogueText] No dialogue style found");
        return null;
    }

    const fontSize = (dialogueStyle.fontSize ?? 12) / 72; // Convert pt to inches
    const lineHeightMultiplier = (dialogueStyle as any).lineHeight ?? 1.25;
    const lineHeight = fontSize * lineHeightMultiplier;

    // Calculate how many lines can fit (including reserve for (MORE))
    const availableForDialogue = availableHeight - reserveHeightForMore;
    const maxLines = Math.floor(availableForDialogue / lineHeight);

    console.log("[splitDialogueText] availableHeight:", availableHeight, "reserveHeight:", reserveHeightForMore, "availableForDialogue:", availableForDialogue, "lineHeight:", lineHeight, "maxLines:", maxLines);

    if (maxLines < 1) {
        console.log("[splitDialogueText] Not enough space for even one line, returning null");
        return null;
    }

    // Estimate characters per line based on maxWidth
    const maxWidth = (dialogueStyle as any).maxWidth || "3.9in";
    const widthInches = parseFloat(maxWidth.replace("in", ""));
    const charsPerLine = Math.floor(widthInches * 10); // Rough estimate: 10 chars per inch

    // Split dialogue at the natural break point (fill entire final line on first page)
    const targetLines = maxLines;
    const targetChars = targetLines * charsPerLine;

    // Find a good break point (prefer sentence endings over other breaks)
    let breakPoint = Math.min(targetChars, dialogueContent.length);

    // Try to break at a sentence ending first (. ! ?)
    if (breakPoint < dialogueContent.length) {
        // First pass: Look for sentence endings (period, exclamation, question mark)
        // Search back up to 3 lines worth of text to find a good sentence break
        const searchBackLimit = Math.max(0, breakPoint - (charsPerLine * 3));
        let sentenceBreak = -1;

        for (let i = breakPoint - 1; i >= searchBackLimit; i--) {
            const char = dialogueContent[i];
            if (char === '.' || char === '!' || char === '?') {
                // Check if there's a space after the punctuation (end of sentence)
                if (i + 1 < dialogueContent.length && (dialogueContent[i + 1] === ' ' || dialogueContent[i + 1] === '\n')) {
                    sentenceBreak = i + 2; // Include the space after punctuation
                    break;
                }
                // Also check if it's at the end of the text
                if (i + 1 === dialogueContent.length) {
                    sentenceBreak = i + 1;
                    break;
                }
            }
        }

        // If we found a sentence break, use it
        if (sentenceBreak !== -1) {
            breakPoint = sentenceBreak;
        } else {
            // Second pass: Fall back to any space within one line
            for (let i = breakPoint - 1; i >= Math.max(0, breakPoint - charsPerLine); i--) {
                const char = dialogueContent[i];
                if (char === ' ') {
                    breakPoint = i + 1;
                    break;
                }
            }
        }
    }

    const firstPart = dialogueContent.slice(0, breakPoint).trim();
    const remainingPart = dialogueContent.slice(breakPoint).trim();

    if (firstPart && remainingPart) {
        console.log("[splitDialogueText] Successfully split dialogue. First:", firstPart.length, "chars, Remaining:", remainingPart.length, "chars");
        return [firstPart, remainingPart];
    } else {
        console.log("[splitDialogueText] Failed to create valid split. FirstPart exists:", !!firstPart, "RemainingPart exists:", !!remainingPart);
        return null;
    }
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
    let previousSpaceAfter = 0; // Track for CSS-style margin collapsing
    let pageNumber = 1;

    blocks.forEach((block, index) => {
        // Check if this is a character-dialogue block
        const isDialogueBlock = block.elements.length > 1 && block.elements[0].type === "character";

        // Calculate how much height this block would add with proper margin collapsing
        let simulatedHeight = currentPageHeight;
        let simulatedSpaceAfter = previousSpaceAfter;

        for (const el of block.elements) {
            const { heightAdded, spaceAfter } = calculateElementHeightWithCollapsing(el, recipe, simulatedSpaceAfter);
            simulatedHeight += heightAdded;
            simulatedSpaceAfter = spaceAfter;
        }

        // For dialogue blocks, also check without trailing dialogue spaceAfter
        // This ensures we only split when the text itself doesn't fit
        let effectiveHeight = simulatedHeight;
        if (isDialogueBlock) {
            // Recalculate without dialogue's trailing space
            effectiveHeight = currentPageHeight;
            let tempSpaceAfter = previousSpaceAfter;
            for (const el of block.elements) {
                const excludeSpaceAfter = el.type === "dialogue";
                if (excludeSpaceAfter) {
                    const { heightAdded } = calculateElementHeightWithCollapsing(el, recipe, tempSpaceAfter);
                    effectiveHeight += heightAdded;
                    tempSpaceAfter = 0; // Don't carry forward dialogue's spaceAfter
                } else {
                    const { heightAdded, spaceAfter } = calculateElementHeightWithCollapsing(el, recipe, tempSpaceAfter);
                    effectiveHeight += heightAdded;
                    tempSpaceAfter = spaceAfter;
                }
            }
        }

        const blockWouldExceedPage = effectiveHeight > usableHeight;
        const hasContentOnPage = currentPage.length > 0;

        if (isDialogueBlock && blockWouldExceedPage) {
            console.log("[Page Break] Dialogue block would exceed page. currentPageHeight:", currentPageHeight, "effectiveHeight:", effectiveHeight, "usableHeight:", usableHeight, "hasContent:", hasContentOnPage);
        }

        // PAGE BREAK RULE #1: Never orphan a Character element without its dialogue/parentheticals
        // Check if adding this dialogue block would result in Character on current page but dialogue on next page
        // TEMPORARILY DISABLED FOR TESTING
        if (false && isDialogueBlock && hasContentOnPage) {
            const characterEl = block.elements[0];
            const characterHeight = calculateElementHeight(characterEl, recipe);
            const characterWouldFit = currentPageHeight + characterHeight <= usableHeight;
            const fullBlockWouldNotFit = currentPageHeight + block.totalHeight > usableHeight;

            // If Character would fit but the full block wouldn't, we'd orphan the Character
            // Move the entire block to the next page instead
            if (characterWouldFit && fullBlockWouldNotFit) {
                console.log("[Page Break Rule #1] Character orphan detected. Moving entire block to next page. Block height:", block.totalHeight, "usableHeight:", usableHeight);
                // Close current page and start new page
                pagesResult.push({
                    elements: currentPage,
                    pageNumber: pageNumber,
                });
                pageNumber++;
                currentPage = [];
                currentPageHeight = 0;
                previousSpaceAfter = 0; // Reset for new page

                // After moving to new page, check if block is too large for even a fresh page
                // If so, we need to split it
                if (block.totalHeight > usableHeight) {
                    console.log("[Page Break Rule #1 Extended] Block too large for one page after orphan prevention. Attempting split. Block height:", block.totalHeight, "usableHeight:", usableHeight);
                    // Block is too large - attempt to split dialogue
                    const dialogueEls = block.elements.filter(el => el.type === "dialogue");
                    const parentheticalEls = block.elements.filter(el => el.type === "parenthetical");

                    if (dialogueEls.length > 0) {
                        const mainDialogue = dialogueEls[0];

                        // Calculate reserve height with margin collapsing (starting fresh page, so previousSpaceAfter = 0)
                        let simulatedSpaceAfter = 0;
                        let reserveHeight = 0;

                        // Add character height
                        const charResult = calculateElementHeightWithCollapsing(characterEl, recipe, simulatedSpaceAfter);
                        reserveHeight += charResult.heightAdded;
                        simulatedSpaceAfter = charResult.spaceAfter;

                        // Add parentheticals height
                        for (const paren of parentheticalEls) {
                            const parenResult = calculateElementHeightWithCollapsing(paren, recipe, simulatedSpaceAfter);
                            reserveHeight += parenResult.heightAdded;
                            simulatedSpaceAfter = parenResult.spaceAfter;
                        }

                        // Add (MORE) height
                        const moreElement = {
                            type: "parenthetical" as const,
                            content: "(MORE)",
                            rowIndex: characterEl.rowIndex,
                            columnName: characterEl.columnName,
                        };
                        const moreResult = calculateElementHeightWithCollapsing(moreElement, recipe, simulatedSpaceAfter);
                        reserveHeight += moreResult.heightAdded;

                        console.log("[Page Break Rule #1 Extended] Calling splitDialogueText with usableHeight:", usableHeight, "reserveHeight:", reserveHeight);
                        const split = splitDialogueText(mainDialogue.content, usableHeight, recipe, reserveHeight);

                        if (split !== null) {
                            const [firstPart, remainingPart] = split;

                            // Add character with margin collapsing
                            currentPage.push(characterEl);
                            const charResult = calculateElementHeightWithCollapsing(characterEl, recipe, previousSpaceAfter);
                            currentPageHeight += charResult.heightAdded;
                            previousSpaceAfter = charResult.spaceAfter;

                            // Add parentheticals with margin collapsing
                            parentheticalEls.forEach(el => {
                                currentPage.push(el);
                                const parenResult = calculateElementHeightWithCollapsing(el, recipe, previousSpaceAfter);
                                currentPageHeight += parenResult.heightAdded;
                                previousSpaceAfter = parenResult.spaceAfter;
                            });

                            // Add first part of dialogue
                            const firstDialoguePart = {
                                type: "dialogue" as const,
                                content: firstPart,
                                rowIndex: mainDialogue.rowIndex,
                                columnName: mainDialogue.columnName,
                                splitIndex: 0,
                            };
                            currentPage.push(firstDialoguePart);
                            const firstDialogueResult = calculateElementHeightWithCollapsing(firstDialoguePart, recipe, previousSpaceAfter);
                            currentPageHeight += firstDialogueResult.heightAdded;
                            previousSpaceAfter = firstDialogueResult.spaceAfter;

                            // Add (MORE) marker
                            const moreElement = {
                                type: "parenthetical" as const,
                                content: "(MORE)",
                                rowIndex: characterEl.rowIndex,
                                columnName: characterEl.columnName,
                            };
                            currentPage.push(moreElement);
                            const moreResult = calculateElementHeightWithCollapsing(moreElement, recipe, previousSpaceAfter);
                            currentPageHeight += moreResult.heightAdded;
                            previousSpaceAfter = moreResult.spaceAfter;

                            // Close current page
                            pagesResult.push({
                                elements: currentPage,
                                pageNumber: pageNumber,
                            });
                            pageNumber++;
                            currentPage = [];
                            currentPageHeight = 0;
                            previousSpaceAfter = 0; // Reset for new page

                            // Add character (CONT'D) at start of next page
                            const contdCharacter = {
                                type: "character" as const,
                                content: `${characterEl.content} (CONT'D)`,
                                rowIndex: characterEl.rowIndex,
                                columnName: characterEl.columnName,
                                sceneNumber: characterEl.sceneNumber,
                            };
                            currentPage.push(contdCharacter);
                            const contdCharResult = calculateElementHeightWithCollapsing(contdCharacter, recipe, previousSpaceAfter);
                            currentPageHeight += contdCharResult.heightAdded;
                            previousSpaceAfter = contdCharResult.spaceAfter;

                            // Add remaining part of dialogue
                            const remainingDialoguePart = {
                                type: "dialogue" as const,
                                content: remainingPart,
                                rowIndex: mainDialogue.rowIndex,
                                columnName: mainDialogue.columnName,
                                splitIndex: 1,
                            };
                            currentPage.push(remainingDialoguePart);
                            const remainingResult = calculateElementHeightWithCollapsing(remainingDialoguePart, recipe, previousSpaceAfter);
                            currentPageHeight += remainingResult.heightAdded;
                            previousSpaceAfter = remainingResult.spaceAfter;

                            // Handle last block
                            if (index === blocks.length - 1) {
                                pagesResult.push({
                                    elements: currentPage,
                                    pageNumber: pageNumber,
                                });
                            }
                            return;
                        }
                    }
                }

                // If we didn't split (block fits on one page or splitting failed), add entire block
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
            // PAGE BREAK RULE #2: Dialogue elements that would split across pages get split with (MORE) and (CONT'D)
            if (isDialogueBlock) {
                console.log("[Page Break Rule #2] Dialogue block would exceed page. Attempting split.");
                // Find dialogue element(s) in the block
                const characterEl = block.elements[0];
                const dialogueEls = block.elements.filter(el => el.type === "dialogue");
                const parentheticalEls = block.elements.filter(el => el.type === "parenthetical");

                if (dialogueEls.length > 0) {
                    // Calculate available space on current page
                    const availableHeight = usableHeight - currentPageHeight;

                    // Check if we need to add the character to this page (if it's not already there)
                    const needCharacterOnThisPage = currentPage.every(el =>
                        !(el.type === "character" && el.rowIndex === characterEl.rowIndex)
                    );

                    // Calculate reserve height with margin collapsing
                    let simulatedSpaceAfter = previousSpaceAfter;
                    let reserveHeight = 0;

                    // Add character height if needed
                    if (needCharacterOnThisPage) {
                        const charResult = calculateElementHeightWithCollapsing(characterEl, recipe, simulatedSpaceAfter);
                        reserveHeight += charResult.heightAdded;
                        simulatedSpaceAfter = charResult.spaceAfter;
                    }

                    // Add parentheticals height
                    for (const paren of parentheticalEls) {
                        const parenResult = calculateElementHeightWithCollapsing(paren, recipe, simulatedSpaceAfter);
                        reserveHeight += parenResult.heightAdded;
                        simulatedSpaceAfter = parenResult.spaceAfter;
                    }

                    // Add (MORE) height
                    const moreElement = {
                        type: "parenthetical" as const,
                        content: "(MORE)",
                        rowIndex: characterEl.rowIndex,
                        columnName: characterEl.columnName,
                    };
                    const moreResult = calculateElementHeightWithCollapsing(moreElement, recipe, simulatedSpaceAfter);
                    reserveHeight += moreResult.heightAdded;

                    console.log("[Page Break Rule #2] availableHeight:", availableHeight, "needCharacter:", needCharacterOnThisPage, "reserveHeight:", reserveHeight);

                    // Try to split the dialogue
                    const mainDialogue = dialogueEls[0]; // Handle first dialogue element
                    const split = splitDialogueText(mainDialogue.content, availableHeight, recipe, reserveHeight);

                    if (split !== null) {
                        // Successfully split dialogue - add first part to current page
                        const [firstPart, remainingPart] = split;

                        // Add character if not already on page
                        if (needCharacterOnThisPage) {
                            currentPage.push(characterEl);
                            const charResult = calculateElementHeightWithCollapsing(characterEl, recipe, previousSpaceAfter);
                            currentPageHeight += charResult.heightAdded;
                            previousSpaceAfter = charResult.spaceAfter;
                        }

                        // Add parentheticals before dialogue
                        parentheticalEls.forEach(el => {
                            currentPage.push(el);
                            const parenResult = calculateElementHeightWithCollapsing(el, recipe, previousSpaceAfter);
                            currentPageHeight += parenResult.heightAdded;
                            previousSpaceAfter = parenResult.spaceAfter;
                        });

                        // Add first part of dialogue
                        const firstDialoguePart = {
                            type: "dialogue" as const,
                            content: firstPart,
                            rowIndex: mainDialogue.rowIndex,
                            columnName: mainDialogue.columnName,
                            splitIndex: 0,
                        };
                        currentPage.push(firstDialoguePart);
                        const firstDialogueResult = calculateElementHeightWithCollapsing(firstDialoguePart, recipe, previousSpaceAfter);
                        currentPageHeight += firstDialogueResult.heightAdded;
                        previousSpaceAfter = firstDialogueResult.spaceAfter;

                        // Add (MORE) marker
                        const moreElement = {
                            type: "parenthetical" as const,
                            content: "(MORE)",
                            rowIndex: characterEl.rowIndex,
                            columnName: characterEl.columnName,
                        };
                        currentPage.push(moreElement);
                        const moreResult = calculateElementHeightWithCollapsing(moreElement, recipe, previousSpaceAfter);
                        currentPageHeight += moreResult.heightAdded;
                        previousSpaceAfter = moreResult.spaceAfter;

                        // Close current page
                        pagesResult.push({
                            elements: currentPage,
                            pageNumber: pageNumber,
                        });
                        pageNumber++;
                        currentPage = [];
                        currentPageHeight = 0;
                        previousSpaceAfter = 0; // Reset for new page

                        // Add character (CONT'D) at start of next page
                        const contdCharacter = {
                            type: "character" as const,
                            content: `${characterEl.content} (CONT'D)`,
                            rowIndex: characterEl.rowIndex,
                            columnName: characterEl.columnName,
                            sceneNumber: characterEl.sceneNumber,
                        };
                        currentPage.push(contdCharacter);
                        const contdCharResult = calculateElementHeightWithCollapsing(contdCharacter, recipe, previousSpaceAfter);
                        currentPageHeight += contdCharResult.heightAdded;
                        previousSpaceAfter = contdCharResult.spaceAfter;

                        // Add remaining part of dialogue
                        const remainingDialoguePart = {
                            type: "dialogue" as const,
                            content: remainingPart,
                            rowIndex: mainDialogue.rowIndex,
                            columnName: mainDialogue.columnName,
                            splitIndex: 1,
                        };
                        currentPage.push(remainingDialoguePart);
                        const remainingResult = calculateElementHeightWithCollapsing(remainingDialoguePart, recipe, previousSpaceAfter);
                        currentPageHeight += remainingResult.heightAdded;
                        previousSpaceAfter = remainingResult.spaceAfter;

                        // Add remaining dialogue elements if any
                        for (let i = 1; i < dialogueEls.length; i++) {
                            currentPage.push(dialogueEls[i]);
                            const dialogueResult = calculateElementHeightWithCollapsing(dialogueEls[i], recipe, previousSpaceAfter);
                            currentPageHeight += dialogueResult.heightAdded;
                            previousSpaceAfter = dialogueResult.spaceAfter;
                        }

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
            previousSpaceAfter = 0; // Reset for new page
        }

        // Add entire block to current page with proper margin collapsing
        for (const element of block.elements) {
            currentPage.push(element);
            const { heightAdded, spaceAfter } = calculateElementHeightWithCollapsing(element, recipe, previousSpaceAfter);
            currentPageHeight += heightAdded;
            previousSpaceAfter = spaceAfter;
        }

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
