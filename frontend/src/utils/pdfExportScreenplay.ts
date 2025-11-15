/**
 * Screenplay PDF Export Utilities
 *
 * Text-based PDF generation for screenplay format.
 * Generates PDFs with actual searchable text, proper formatting, and precise control
 * over margins and spacing according to industry-standard screenplay format.
 *
 * This approach is superior to image-based rendering because:
 * - PDFs are searchable and accessible
 * - Text can be copied and pasted
 * - File sizes are much smaller
 * - Perfect control over margins and spacing
 * - No rendering quirks from html2canvas
 */

import { jsPDF } from "jspdf";
import { writeFile } from "@tauri-apps/plugin-fs";
import type { ExportSettings } from "@/components/prints/ExportDialog";
import type { PrintRecipe, RecipeConfiguration, RecipeIngredient } from "@/types/printRecipe";

// Extended jsPDF interface to include setGState (not in official types)
interface ExtendedJsPDF extends jsPDF {
    setGState(state: { opacity: number }): void;
}

// Extended style type for screenplay-specific properties
type ScreenplayIngredientStyle = RecipeIngredient["style"] & {
    lineHeight?: number;
    maxWidth?: string;
};

/**
 * Screenplay element with its formatting information
 */
interface ScreenplayElement {
    type: string; // scene_heading, action, character, dialogue, parenthetical, transition
    text: string;
    sceneNumber?: number; // For Scene elements (auto-generated counter)
    rowIndex?: number; // Original row from CSV (for tracking split elements)
    splitIndex?: number; // For dialogue split across pages: 0 = first part, 1 = continued part
}

/**
 * Element ordering priority for when multiple elements appear in the same row
 * Lower number = rendered first
 */
const ELEMENT_ORDER_PRIORITY: Record<string, number> = {
    transition: 1,
    scene_heading: 2,
    action: 3,
    character: 4,
    parenthetical: 5,
    dialogue: 6,
};

/**
 * Loads and registers Courier Prime font with jsPDF
 *
 * @param pdf - jsPDF instance to register fonts with
 */
async function registerCourierPrimeFont(pdf: jsPDF): Promise<void> {
    try {
        // Fetch font files from public directory
        const fontFiles = [
            { name: "CourierPrime-Regular.ttf", style: "normal", weight: "normal" },
            { name: "CourierPrime-Bold.ttf", style: "normal", weight: "bold" },
            { name: "CourierPrime-Italic.ttf", style: "italic", weight: "normal" },
            { name: "CourierPrime-BoldItalic.ttf", style: "italic", weight: "bold" },
        ];

        for (const font of fontFiles) {
            // Fetch font file
            const fontPath = `/fonts/courier-prime/Courier Prime${font.name.includes("Bold") ? " Bold" : ""}${font.name.includes("Italic") ? " Italic" : ""}.ttf`;
            const response = await fetch(fontPath);
            const fontData = await response.arrayBuffer();

            // Convert to base64
            const base64Font = arrayBufferToBase64(fontData);

            // Add to jsPDF virtual file system
            pdf.addFileToVFS(font.name, base64Font);

            // Register font with jsPDF
            pdf.addFont(font.name, "CourierPrime", font.style, font.weight);
        }

        console.log("[Screenplay PDF Export] Courier Prime fonts registered successfully");
    } catch (error) {
        console.error("[Screenplay PDF Export] Failed to load Courier Prime fonts:", error);
        console.warn("[Screenplay PDF Export] Falling back to default Courier font");
    }
}

/**
 * Converts ArrayBuffer to base64 string
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = "";
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

/**
 * Split dialogue text to fit within available height
 * Returns array of [firstPart, remainingPart] or null if can't split
 */
function splitDialogueText(
    pdf: jsPDF,
    dialogueText: string,
    availableHeight: number,
    dialogueConfig: RecipeIngredient,
    recipe: PrintRecipe,
    marginLeft: number,
    rightEdge: number,
    reserveHeightForMore: number
): [string, string] | null {
    const style = dialogueConfig.style as ScreenplayIngredientStyle;
    const fontSize = style.fontSize ?? 12;
    const fontSizeInches = fontSize / 72;
    const lineHeightMultiplier = style.lineHeight ?? 1.25;
    const lineHeight = fontSizeInches * lineHeightMultiplier;

    // Calculate how many lines can fit (including reserve for (MORE))
    const availableForDialogue = availableHeight - reserveHeightForMore;
    const maxLines = Math.floor(availableForDialogue / lineHeight);

    if (maxLines < 1) {
        return null;
    }

    // Get max width for dialogue
    const textAlign = style.textAlign || "left";
    const xMargin = style.xMargin ?? 0;
    const maxWidthStr = style.maxWidth;
    const availableWidth = textAlign === "left"
        ? rightEdge - (marginLeft + xMargin)
        : rightEdge - marginLeft;

    const maxWidth = parseMaxWidth(maxWidthStr, availableWidth);

    // Estimate characters per line based on maxWidth
    const charsPerLine = Math.floor(maxWidth * 10); // Rough estimate: 10 chars per inch

    // Split dialogue at the natural break point (fill entire final line on first page)
    const targetLines = maxLines;
    const targetChars = targetLines * charsPerLine;

    // Find a good break point (prefer sentence endings over other breaks)
    let breakPoint = Math.min(targetChars, dialogueText.length);

    // Try to break at a sentence ending first (. ! ?)
    if (breakPoint < dialogueText.length) {
        // First pass: Look for sentence endings (period, exclamation, question mark)
        // Search back up to 3 lines worth of text to find a good sentence break
        const searchBackLimit = Math.max(0, breakPoint - (charsPerLine * 3));
        let sentenceBreak = -1;

        for (let i = breakPoint - 1; i >= searchBackLimit; i--) {
            const char = dialogueText[i];
            if (char === '.' || char === '!' || char === '?') {
                // Check if there's a space after the punctuation (end of sentence)
                if (i + 1 < dialogueText.length && (dialogueText[i + 1] === ' ' || dialogueText[i + 1] === '\n')) {
                    sentenceBreak = i + 2; // Include the space after punctuation
                    break;
                }
                // Also check if it's at the end of the text
                if (i + 1 === dialogueText.length) {
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
                const char = dialogueText[i];
                if (char === ' ') {
                    breakPoint = i + 1;
                    break;
                }
            }
        }
    }

    const firstPart = dialogueText.slice(0, breakPoint).trim();
    const remainingPart = dialogueText.slice(breakPoint).trim();

    return firstPart && remainingPart ? [firstPart, remainingPart] : null;
}

/**
 * Group elements into blocks that should stay together across page breaks
 */
interface ElementBlock {
    elements: ScreenplayElement[];
    totalHeight: number;
}

function groupIntoBlocks(
    elements: ScreenplayElement[],
    pdf: jsPDF,
    recipe: PrintRecipe,
    marginLeft: number,
    rightEdge: number
): ElementBlock[] {
    const blocks: ElementBlock[] = [];
    let i = 0;

    while (i < elements.length) {
        const element = elements[i];

        if (element.type === "character") {
            const blockElements: ScreenplayElement[] = [element];
            const elementConfig = recipe.ingredients[element.type];
            // Exclude spaceAfter for height calculation (margin collapsing means it won't advance Y)
            let blockHeight = estimateElementHeight(pdf, element, elementConfig, recipe, marginLeft, rightEdge, true);
            let j = i + 1;

            // Group character with its parentheticals and dialogue
            while (j < elements.length && elements[j].rowIndex === element.rowIndex) {
                const nextElement = elements[j];
                if (nextElement.type === "parenthetical" || nextElement.type === "dialogue") {
                    blockElements.push(nextElement);
                    const nextConfig = recipe.ingredients[nextElement.type];
                    // Exclude spaceAfter for all elements (margin collapsing)
                    blockHeight += estimateElementHeight(pdf, nextElement, nextConfig, recipe, marginLeft, rightEdge, true);
                    j++;
                } else {
                    break;
                }
            }

            blocks.push({ elements: blockElements, totalHeight: blockHeight });
            i = j;
        } else {
            const elementConfig = recipe.ingredients[element.type];
            blocks.push({
                elements: [element],
                // Exclude spaceAfter (margin collapsing means it won't advance Y)
                totalHeight: estimateElementHeight(pdf, element, elementConfig, recipe, marginLeft, rightEdge, true),
            });
            i++;
        }
    }

    return blocks;
}

/**
 * Exports screenplay CSV data to a text-based PDF
 *
 * @param data - CSV data rows
 * @param headers - CSV column headers
 * @param recipe - Print recipe defining element types
 * @param configuration - Recipe configuration with field mappings
 * @param settings - Export settings (colors, watermarks, page range, etc.)
 */
export async function exportScreenplayToPDF(
    data: string[][],
    headers: string[],
    recipe: PrintRecipe,
    configuration: RecipeConfiguration,
    settings: ExportSettings
): Promise<void> {
    try {
        console.log("[Screenplay PDF Export] Starting text-based PDF export...");

        // Report initial progress
        settings.onProgress?.({
            stage: "Preparing screenplay data",
            current: 0,
            total: data.length,
            percentage: 0,
        });

        // Parse CSV data into screenplay elements
        // Elements are already sorted per-row during parsing
        const elements = parseScreenplayElements(data, headers, recipe, configuration);
        console.log(`[Screenplay PDF Export] Parsed ${elements.length} screenplay elements`);

        settings.onProgress?.({
            stage: "Parsing screenplay elements",
            current: elements.length,
            total: elements.length,
            percentage: 10,
        });

        // Get page dimensions and margins from recipe
        const pageWidth = (recipe.documentSettings.pageWidth as number) ?? 8.5;
        const pageHeight = (recipe.documentSettings.pageHeight as number) ?? 11;
        const marginTop = (recipe.documentSettings.marginTop as number) ?? 1;
        const marginBottom = (recipe.documentSettings.marginBottom as number) ?? 1;
        const marginLeft = (recipe.documentSettings.marginLeft as number) ?? 1.5;
        const marginRight = (recipe.documentSettings.marginRight as number) ?? 1;
        const showSceneNumbers = (recipe.documentSettings.sceneNumbering as boolean) ?? false;

        // Create PDF document
        const pdf = new jsPDF({
            orientation: "portrait",
            unit: "in",
            format: [pageWidth, pageHeight],
        });

        // Register Courier Prime font
        await registerCourierPrimeFont(pdf);

        // Set background color
        pdf.setFillColor(settings.backgroundColor);
        pdf.rect(0, 0, pageWidth, pageHeight, "F");

        // Set text color
        pdf.setTextColor(settings.textColor);

        // Set font (Courier Prime is the screenplay standard)
        pdf.setFont("CourierPrime");
        pdf.setFontSize(12);

        settings.onProgress?.({
            stage: "Rendering screenplay text",
            current: 0,
            total: elements.length,
            percentage: 20,
        });

        // Group elements into blocks for page break logic
        const rightEdge = pageWidth - marginRight;
        const blocks = groupIntoBlocks(elements, pdf, recipe, marginLeft, rightEdge);

        // Render all blocks with sophisticated page break rules
        let currentY = marginTop;
        let elementsRendered = 0;
        let previousElementSpaceAfter = 0; // Track previous element's spaceAfterElement for margin collapsing

        for (let blockIndex = 0; blockIndex < blocks.length; blockIndex++) {
            const block = blocks[blockIndex];

            // Report progress periodically
            if (elementsRendered % 50 === 0) {
                settings.onProgress?.({
                    stage: "Rendering screenplay text",
                    current: elementsRendered,
                    total: elements.length,
                    percentage: 20 + Math.floor((elementsRendered / elements.length) * 60),
                });
            }

            // Check if this is a character-dialogue block
            const isDialogueBlock = block.elements.length > 1 && block.elements[0].type === "character";

            // Use totalHeight directly - it already excludes spaceAfter due to margin collapsing
            const effectiveBlockHeight = block.totalHeight;

            const blockWouldExceedPage = currentY + effectiveBlockHeight > pageHeight - marginBottom;
            const hasContentOnPage = currentY > marginTop;

            // PAGE BREAK RULE #1: Dialogue elements that would split across pages get split with (MORE) and (CONT'D)
            if (blockWouldExceedPage && hasContentOnPage && isDialogueBlock) {
                const characterEl = block.elements[0];
                const dialogueEls = block.elements.filter(el => el.type === "dialogue");
                const parentheticalEls = block.elements.filter(el => el.type === "parenthetical");

                if (dialogueEls.length > 0) {
                    // Calculate available space on current page
                    const availableHeight = (pageHeight - marginBottom) - currentY;

                    // Calculate heights for (MORE)
                    const moreConfig = recipe.ingredients["parenthetical"];
                    const moreElement: ScreenplayElement = { type: "parenthetical", text: "(MORE)", rowIndex: characterEl.rowIndex };
                    const moreHeight = estimateElementHeight(pdf, moreElement, moreConfig, recipe, marginLeft, rightEdge);

                    // Try to split the dialogue
                    const mainDialogue = dialogueEls[0];
                    const dialogueConfig = recipe.ingredients["dialogue"];
                    const split = splitDialogueText(
                        pdf,
                        mainDialogue.text,
                        availableHeight,
                        dialogueConfig,
                        recipe,
                        marginLeft,
                        rightEdge,
                        moreHeight
                    );

                    if (split !== null) {
                        // Successfully split dialogue - add first part to current page
                        const [firstPart, remainingPart] = split;

                        // Add character (block hasn't been rendered yet, so character always needs to be added)
                        let result = renderElement(pdf, characterEl, currentY, recipe, marginLeft, rightEdge, showSceneNumbers, previousElementSpaceAfter);
                        currentY = result.y;
                        previousElementSpaceAfter = result.spaceAfter;
                        elementsRendered++;

                        // Add parentheticals before dialogue
                        for (const paren of parentheticalEls) {
                            result = renderElement(pdf, paren, currentY, recipe, marginLeft, rightEdge, showSceneNumbers, previousElementSpaceAfter);
                            currentY = result.y;
                            previousElementSpaceAfter = result.spaceAfter;
                            elementsRendered++;
                        }

                        // Add first part of dialogue
                        const firstDialogue: ScreenplayElement = {
                            ...mainDialogue,
                            text: firstPart,
                            splitIndex: 0
                        };
                        result = renderElement(pdf, firstDialogue, currentY, recipe, marginLeft, rightEdge, showSceneNumbers, previousElementSpaceAfter);
                        currentY = result.y;
                        previousElementSpaceAfter = result.spaceAfter;

                        // Add (MORE) marker
                        result = renderElement(pdf, moreElement, currentY, recipe, marginLeft, rightEdge, showSceneNumbers, previousElementSpaceAfter);
                        currentY = result.y;
                        previousElementSpaceAfter = result.spaceAfter;

                        // Start new page
                        pdf.addPage();
                        pdf.setFillColor(settings.backgroundColor);
                        pdf.rect(0, 0, pageWidth, pageHeight, "F");
                        pdf.setTextColor(settings.textColor);
                        currentY = marginTop;
                        previousElementSpaceAfter = 0; // Reset for new page

                        // Add character (CONT'D) at start of next page
                        const contdCharacter: ScreenplayElement = {
                            ...characterEl,
                            text: `${characterEl.text} (CONT'D)`
                        };
                        result = renderElement(pdf, contdCharacter, currentY, recipe, marginLeft, rightEdge, showSceneNumbers, previousElementSpaceAfter);
                        currentY = result.y;
                        previousElementSpaceAfter = result.spaceAfter;

                        // Add remaining part of dialogue
                        const remainingDialogue: ScreenplayElement = {
                            ...mainDialogue,
                            text: remainingPart,
                            splitIndex: 1
                        };
                        result = renderElement(pdf, remainingDialogue, currentY, recipe, marginLeft, rightEdge, showSceneNumbers, previousElementSpaceAfter);
                        currentY = result.y;
                        previousElementSpaceAfter = result.spaceAfter;
                        elementsRendered++;

                        // Add remaining dialogue elements if any
                        for (let i = 1; i < dialogueEls.length; i++) {
                            result = renderElement(pdf, dialogueEls[i], currentY, recipe, marginLeft, rightEdge, showSceneNumbers, previousElementSpaceAfter);
                            currentY = result.y;
                            previousElementSpaceAfter = result.spaceAfter;
                            elementsRendered++;
                        }

                        continue; // Skip the normal block addition below
                    }
                }
            }

            // PAGE BREAK RULE #2: If block doesn't fit, move entire block to next page
            // This handles action elements (which are single-element blocks) and
            // dialogue blocks that don't fit but aren't large enough to split
            if (blockWouldExceedPage && hasContentOnPage) {
                pdf.addPage();
                pdf.setFillColor(settings.backgroundColor);
                pdf.rect(0, 0, pageWidth, pageHeight, "F");
                pdf.setTextColor(settings.textColor);
                currentY = marginTop;
                previousElementSpaceAfter = 0; // Reset for new page
            }

            // Add entire block to current page
            for (const element of block.elements) {
                const result = renderElement(pdf, element, currentY, recipe, marginLeft, rightEdge, showSceneNumbers, previousElementSpaceAfter);
                currentY = result.y;
                previousElementSpaceAfter = result.spaceAfter;
                elementsRendered++;
            }
        }

        settings.onProgress?.({
            stage: "Adding page numbers",
            current: elements.length,
            total: elements.length,
            percentage: 85,
        });

        // Add page numbers if enabled
        if (settings.includePageNumbers) {
            addPageNumbers(pdf, recipe, settings.textColor);
        }

        // Add watermark if enabled
        if (settings.watermark) {
            addWatermark(pdf, settings.watermark, settings.textColor, pageWidth, pageHeight);
        }

        // Add headers/footers if enabled
        if (settings.includeHeaders && settings.headerText) {
            addHeaders(pdf, settings.headerText, settings.textColor, pageWidth);
        }
        if (settings.includeFooters && settings.footerText) {
            addFooters(pdf, settings.footerText, settings.textColor, pageWidth, pageHeight);
        }

        settings.onProgress?.({
            stage: "Saving PDF to disk",
            current: elements.length,
            total: elements.length,
            percentage: 90,
        });

        // Save the PDF
        const pdfArrayBuffer = pdf.output("arraybuffer");
        const pdfBytes = new Uint8Array(pdfArrayBuffer);
        await writeFile(settings.savePath, pdfBytes);

        console.log("[Screenplay PDF Export] PDF saved successfully");

        // Report completion
        settings.onProgress?.({
            stage: "Export complete",
            current: elements.length,
            total: elements.length,
            percentage: 100,
        });
    } catch (error) {
        console.error("Screenplay PDF export failed:", error);
        throw new Error(
            `Failed to export screenplay PDF: ${error instanceof Error ? error.message : "Unknown error"}`
        );
    }
}

/**
 * Helper function to get mapped column for an ingredient
 */
function getMappedColumn(
    fieldMappings: RecipeConfiguration["fieldMappings"],
    ingredientId: string
): string | null {
    const mapping = fieldMappings.find((m) => m.ingredientId === ingredientId);
    return mapping?.cellColumn || null;
}

/**
 * Parses CSV data into screenplay elements
 *
 * The screenplay recipe maps each element type (scene_heading, action, character, etc.)
 * to its own CSV column. We need to check each row to see which columns have content
 * and create elements accordingly.
 */
function parseScreenplayElements(
    data: string[][],
    headers: string[],
    recipe: PrintRecipe,
    configuration: RecipeConfiguration
): ScreenplayElement[] {
    const elements: ScreenplayElement[] = [];

    // Get column mappings for each element type
    const ingredientTypes = [
        "scene_heading",
        "action",
        "character",
        "dialogue",
        "parenthetical",
        "transition",
    ];

    // Build a map of ingredient type to column index
    const columnMappings = new Map<string, number>();
    for (const ingredientId of ingredientTypes) {
        const columnName = getMappedColumn(configuration.fieldMappings, ingredientId);
        if (columnName) {
            const columnIndex = headers.indexOf(columnName);
            if (columnIndex !== -1) {
                columnMappings.set(ingredientId, columnIndex);
            }
        }
    }

    if (columnMappings.size === 0) {
        throw new Error("No screenplay element columns are mapped");
    }

    // Auto-generate scene numbers (like ScreenplayPrint worker does)
    let sceneCounter = 0;

    // Parse each row
    for (let rowIndex = 0; rowIndex < data.length; rowIndex++) {
        const row = data[rowIndex];
        // Collect all elements for this row
        const rowElements: ScreenplayElement[] = [];

        // Check each ingredient type to see if this row has content for it
        columnMappings.forEach((columnIndex, ingredientId) => {
            const text = row[columnIndex]?.trim() || "";

            if (text) {
                // Auto-increment scene counter for scene headings
                let sceneNumber: number | undefined = undefined;
                if (ingredientId === "scene_heading") {
                    sceneCounter++;
                    sceneNumber = sceneCounter;
                }

                rowElements.push({
                    type: ingredientId,
                    text,
                    sceneNumber,
                    rowIndex,
                });
            }
        });

        // Sort elements within this row by priority
        // (Transition -> Scene -> Action -> Character -> Parenthetical -> Dialogue)
        rowElements.sort((a, b) => {
            const priorityA = ELEMENT_ORDER_PRIORITY[a.type] ?? 999;
            const priorityB = ELEMENT_ORDER_PRIORITY[b.type] ?? 999;
            return priorityA - priorityB;
        });

        // Add this row's elements to the main array
        elements.push(...rowElements);
    }

    return elements;
}

/**
 * Parses maxWidth from CSS string (e.g., "3.3in" -> 3.3)
 */
function parseMaxWidth(maxWidthStr: string | undefined, defaultWidth: number): number {
    if (!maxWidthStr) return defaultWidth;
    const match = maxWidthStr.match(/^([\d.]+)in$/);
    return match ? parseFloat(match[1]) : defaultWidth;
}

/**
 * Estimates the height needed for an element (for page break calculation)
 * @param excludeSpaceAfter - If true, excludes spaceAfterElement from calculation (useful for dialogue split calculations)
 */
function estimateElementHeight(
    pdf: jsPDF,
    element: ScreenplayElement,
    elementConfig: RecipeIngredient,
    recipe: PrintRecipe,
    marginLeft: number,
    rightEdge: number,
    excludeSpaceAfter: boolean = false
): number {
    const style = elementConfig.style as ScreenplayIngredientStyle;
    const textAlign = style.textAlign || "left";
    const xMargin = style.xMargin ?? 0;

    // Get max width from recipe
    const maxWidthStr = style.maxWidth;
    // Available width is from the element's start position to the right edge
    const availableWidth = textAlign === "left"
        ? rightEdge - (marginLeft + xMargin)  // Left-aligned: from indent to right edge
        : rightEdge - marginLeft;             // Right-aligned: from left edge to right edge
    const maxWidth = parseMaxWidth(maxWidthStr, availableWidth);

    // Get line height from font size and recipe lineHeight multiplier
    const fontSize = style.fontSize ?? 12;
    const fontSizeInches = fontSize / 72; // Convert pt to inches
    const lineHeightMultiplier = style.lineHeight ?? 1.25; // Default to 1.25 if not specified
    const lineHeight = fontSizeInches * lineHeightMultiplier;

    // Wrap text if needed for parentheticals (add parentheses)
    let textToMeasure = element.text;
    if (element.type === "parenthetical" && !textToMeasure.startsWith("(")) {
        textToMeasure = `(${textToMeasure})`;
    }

    // Split text into lines that fit within maxWidth
    const lines = pdf.splitTextToSize(textToMeasure, maxWidth);
    const numLines = Array.isArray(lines) ? lines.length : 1;

    // Calculate total height including spacing before/after
    // spaceBeforeElement/After are in em units, relative to font size (not line height)
    const spaceBeforeElement = elementConfig.style.spaceBeforeElement ?? 0;
    const spaceAfterElement = elementConfig.style.spaceAfterElement ?? 0;

    return spaceBeforeElement * fontSizeInches + numLines * lineHeight + (excludeSpaceAfter ? 0 : spaceAfterElement * fontSizeInches);
}

/**
 * Renders a single screenplay element to the PDF using recipe configuration
 * Returns an object with the new Y position and the element's spaceAfterElement value
 */
function renderElement(
    pdf: jsPDF,
    element: ScreenplayElement,
    currentY: number,
    recipe: PrintRecipe,
    marginLeft: number,
    rightEdge: number,
    showSceneNumbers: boolean,
    previousElementSpaceAfter: number = 0
): { y: number; spaceAfter: number } {
    const elementConfig = recipe.ingredients[element.type];
    if (!elementConfig) {
        console.warn(`No ingredient config found for type: ${element.type}`);
        return { y: currentY, spaceAfter: 0 };
    }

    const style = elementConfig.style as ScreenplayIngredientStyle;
    const fontSize = style.fontSize ?? 12;
    const fontSizeInches = fontSize / 72; // Convert pt to inches
    const lineHeightMultiplier = style.lineHeight ?? 1.25; // Default to 1.25 if not specified
    const lineHeight = fontSizeInches * lineHeightMultiplier;

    // Get indentation from recipe
    // xMargin is applied on top of page margin (measured from page margin edge)
    const textAlign = style.textAlign || "left";
    const xMargin = style.xMargin ?? 0;
    const indent = textAlign === "left" ? marginLeft + xMargin : rightEdge - xMargin;

    // Get max width from recipe
    const maxWidthStr = style.maxWidth;
    // Available width is from the element's start position to the right edge
    const availableWidth = textAlign === "left"
        ? rightEdge - (marginLeft + xMargin)  // Left-aligned: from indent to right edge
        : rightEdge - marginLeft;             // Right-aligned: from left edge to right edge
    const maxWidth = parseMaxWidth(maxWidthStr, availableWidth);

    // Apply spacing before element with CSS-style margin collapsing
    // In CSS, adjacent vertical margins collapse to the larger of the two
    // previousElementSpaceAfter is the spaceAfterElement from the previous element
    const spaceBeforeElement = style.spaceBeforeElement ?? 0;
    const collapsedSpacing = Math.max(previousElementSpaceAfter, spaceBeforeElement);
    let y = currentY + collapsedSpacing * fontSizeInches;

    // Render scene numbers if this is a scene heading and they're enabled
    if (element.type === "scene_heading" && showSceneNumbers && element.sceneNumber) {
        // Scene numbers appear 0.5" from the page edges (matching ScreenplayPrint)
        const pageWidth = (recipe.documentSettings.pageWidth as number) ?? 8.5;
        const sceneNumLeft = 0.5;
        const sceneNumRight = pageWidth - 0.5;

        pdf.setFontSize(fontSize);
        pdf.text(`${element.sceneNumber}.`, sceneNumLeft, y, { align: "left" });
        pdf.text(`${element.sceneNumber}.`, sceneNumRight, y, { align: "right" });
    }

    // Wrap text in parentheses for parenthetical elements
    let textToRender = element.text;
    if (element.type === "parenthetical" && !textToRender.startsWith("(")) {
        textToRender = `(${textToRender})`;
    }

    // Apply text transform
    if (style.textTransform === "uppercase") {
        textToRender = textToRender.toUpperCase();
    }

    // Set font weight (normal or bold)
    const fontWeight = style.fontWeight ?? 400;
    if (fontWeight >= 700) {
        pdf.setFont("CourierPrime", "bold");
    } else {
        pdf.setFont("CourierPrime", "normal");
    }

    // Set font size
    pdf.setFontSize(fontSize);

    // Split text into lines that fit within maxWidth
    const lines = pdf.splitTextToSize(textToRender, maxWidth);
    const linesArray = Array.isArray(lines) ? lines : [lines];

    // Render each line
    for (const line of linesArray) {
        if (textAlign === "right") {
            // For right-aligned elements (transitions), use indent which is already calculated as rightEdge - margin
            pdf.text(line, indent, y, { align: "right" });
        } else {
            // Left-aligned (most elements), indent is already calculated as marginLeft + margin
            pdf.text(line, indent, y, { align: "left" });
        }
        y += lineHeight;
    }

    // Don't add spaceAfterElement here - it will be used for margin collapsing with the next element
    // Return both the current Y position and the spaceAfterElement value
    const spaceAfterElement = style.spaceAfterElement ?? 0;

    return { y, spaceAfter: spaceAfterElement };
}

/**
 * Adds page numbers to all pages using recipe configuration
 */
function addPageNumbers(pdf: jsPDF, recipe: PrintRecipe, textColor: string): void {
    const totalPages = pdf.getNumberOfPages();
    const startPageNumber = (recipe.documentSettings.startPageNumber as number) ?? 1;
    const pageNumberMarginTop = (recipe.documentSettings.pageNumberMarginTop as number) ?? 0.25;
    const pageWidth = (recipe.documentSettings.pageWidth as number) ?? 8.5;
    const marginRight = (recipe.documentSettings.marginRight as number) ?? 1;

    for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFontSize(12);
        pdf.setFont("CourierPrime", "normal");
        pdf.setTextColor(textColor);

        // Calculate page number to display
        const displayPageNum = startPageNumber + i - 1;

        // Page numbers in top-right corner at right margin (screenplay standard)
        const pageNumText = `${displayPageNum}.`;
        const xPos = pageWidth - marginRight;
        pdf.text(pageNumText, xPos, pageNumberMarginTop, { align: "right" });
    }
}

/**
 * Adds watermark to all pages
 */
function addWatermark(
    pdf: jsPDF,
    watermark: NonNullable<ExportSettings["watermark"]>,
    defaultTextColor: string,
    pageWidth: number,
    pageHeight: number
): void {
    const totalPages = pdf.getNumberOfPages();

    for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFontSize(96);
        pdf.setFont("CourierPrime", "bold");
        pdf.setTextColor(watermark.color);

        // Save graphics state before changing opacity
        pdf.saveGraphicsState();
        (pdf as ExtendedJsPDF).setGState({ opacity: watermark.opacity });

        const x = pageWidth / 2;
        const y = pageHeight / 2;

        switch (watermark.position) {
            case "diagonal":
                pdf.text(watermark.text, x, y, {
                    align: "center",
                    angle: 45,
                });
                break;
            case "header":
                pdf.setFontSize(24);
                pdf.text(watermark.text, x, 0.5, { align: "center" });
                break;
            case "footer":
                pdf.setFontSize(24);
                pdf.text(watermark.text, x, pageHeight - 0.5, {
                    align: "center",
                });
                break;
        }

        // Restore graphics state (resets opacity)
        pdf.restoreGraphicsState();
        pdf.setTextColor(defaultTextColor);
    }
}

/**
 * Adds headers to all pages
 */
function addHeaders(pdf: jsPDF, headerText: string, textColor: string, pageWidth: number): void {
    const totalPages = pdf.getNumberOfPages();

    for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFontSize(10);
        pdf.setFont("CourierPrime", "normal");
        pdf.setTextColor(textColor);

        // Save graphics state before changing opacity
        pdf.saveGraphicsState();
        (pdf as ExtendedJsPDF).setGState({ opacity: 0.7 });

        pdf.text(headerText, pageWidth / 2, 0.5, {
            align: "center",
        });

        // Restore graphics state (resets opacity)
        pdf.restoreGraphicsState();
    }
}

/**
 * Adds footers to all pages
 */
function addFooters(
    pdf: jsPDF,
    footerText: string,
    textColor: string,
    pageWidth: number,
    pageHeight: number
): void {
    const totalPages = pdf.getNumberOfPages();

    for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFontSize(10);
        pdf.setFont("CourierPrime", "normal");
        pdf.setTextColor(textColor);

        // Save graphics state before changing opacity
        pdf.saveGraphicsState();
        (pdf as ExtendedJsPDF).setGState({ opacity: 0.7 });

        pdf.text(footerText, pageWidth / 2, pageHeight - 0.5, { align: "center" });

        // Restore graphics state (resets opacity)
        pdf.restoreGraphicsState();
    }
}
