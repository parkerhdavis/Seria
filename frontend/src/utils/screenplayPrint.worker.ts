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
        leftMargin: 0,
        lineSpaceBefore: 0,
        lineSpaceAfter: 0,
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
    const lineSpaceBefore = elementConfig.lineSpaceBefore || 0;
    const lineSpaceAfter = elementConfig.lineSpaceAfter || 0;

    // Calculate base line height
    const lineHeightInches = (fontSize / 72) * 1.2;

    // Estimate number of lines
    let numLines = 1;
    if (isMultiLineElement(element.type)) {
        const maxWidth = ("maxWidth" in elementConfig ? (elementConfig as {maxWidth?: string}).maxWidth : undefined) || "6in";
        const widthInches = parseFloat(maxWidth.replace("in", ""));
        const charsPerLine = Math.floor(widthInches * 10);
        numLines = Math.max(1, Math.ceil(element.content.length / charsPerLine));
    }

    const spacingBeforeInches = lineSpaceBefore * lineHeightInches;
    const spacingAfterInches = lineSpaceAfter * lineHeightInches;
    const contentHeight = numLines * lineHeightInches;

    return spacingBeforeInches + contentHeight + spacingAfterInches;
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
 * Split elements into pages
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
        if (currentPageHeight + block.totalHeight > usableHeight && currentPage.length > 0) {
            pagesResult.push({
                elements: currentPage,
                pageNumber: pageNumber,
            });
            pageNumber++;
            currentPage = [];
            currentPageHeight = 0;
        }

        currentPage.push(...block.elements);
        currentPageHeight += block.totalHeight;

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
