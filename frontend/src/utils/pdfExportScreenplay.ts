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
import type { ExportSettings, ExportProgress } from "@/components/prints/ExportDialog";
import type { PrintRecipe, RecipeConfiguration } from "@/types/printRecipe";

/**
 * Screenplay element with its formatting information
 */
interface ScreenplayElement {
    type: string; // scene_heading, action, character, dialogue, parenthetical, transition
    text: string;
    sceneNumber?: string; // For Scene elements
}

/**
 * Mapping of ingredient IDs to display names
 */
const ELEMENT_TYPE_NAMES: Record<string, string> = {
    scene_heading: "Scene",
    action: "Action",
    character: "Character",
    dialogue: "Dialogue",
    parenthetical: "Parenthetical",
    transition: "Transition",
};

/**
 * Screenplay formatting constants (in inches)
 * Based on industry-standard screenplay format
 */
const SCREENPLAY_FORMAT = {
    // Page dimensions (US Letter)
    PAGE_WIDTH: 8.5,
    PAGE_HEIGHT: 11,

    // Standard margins
    MARGIN_LEFT: 1.5,
    MARGIN_RIGHT: 1.0,
    MARGIN_TOP: 1.0,
    MARGIN_BOTTOM: 1.0,

    // Element indentation (from left edge of page)
    SCENE_INDENT: 1.5,
    ACTION_INDENT: 1.5,
    CHARACTER_INDENT: 3.7,
    DIALOGUE_INDENT: 2.5,
    PARENTHETICAL_INDENT: 3.1,
    TRANSITION_INDENT: 6.0,

    // Element widths (maximum width before wrapping)
    ACTION_WIDTH: 6.0,
    DIALOGUE_WIDTH: 3.5,
    PARENTHETICAL_WIDTH: 2.0,

    // Line spacing
    LINE_HEIGHT: 12 / 72, // 12pt in inches
    FONT_SIZE: 12,

    // Extra spacing
    SCENE_SPACING_AFTER: 12 / 72, // Extra line after scene headings
    ACTION_SPACING_AFTER: 12 / 72, // Extra line between consecutive actions
    CHARACTER_SPACING_AFTER: 0, // No extra space after character name
    PARENTHETICAL_SPACING_AFTER: 0,
    DIALOGUE_SPACING_AFTER: 12 / 72,
    TRANSITION_SPACING_AFTER: 12 / 72,

    // Scene number position (from edges)
    SCENE_NUMBER_LEFT: 0.5,
    SCENE_NUMBER_RIGHT: 7.5,
};

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
        const elements = parseScreenplayElements(data, headers, recipe, configuration);
        console.log(`[Screenplay PDF Export] Parsed ${elements.length} screenplay elements`);

        settings.onProgress?.({
            stage: "Parsing screenplay elements",
            current: elements.length,
            total: elements.length,
            percentage: 10,
        });

        // Create PDF document
        const pdf = new jsPDF({
            orientation: "portrait",
            unit: "in",
            format: "letter",
        });

        // Set background color
        pdf.setFillColor(settings.backgroundColor);
        pdf.rect(
            0,
            0,
            SCREENPLAY_FORMAT.PAGE_WIDTH,
            SCREENPLAY_FORMAT.PAGE_HEIGHT,
            "F"
        );

        // Set text color
        pdf.setTextColor(settings.textColor);

        // Set font (Courier is the screenplay standard)
        pdf.setFont("courier");
        pdf.setFontSize(SCREENPLAY_FORMAT.FONT_SIZE);

        settings.onProgress?.({
            stage: "Rendering screenplay text",
            current: 0,
            total: elements.length,
            percentage: 20,
        });

        // Render all elements
        let currentY = SCREENPLAY_FORMAT.MARGIN_TOP;
        let previousElementType: string | null = null;

        for (let i = 0; i < elements.length; i++) {
            const element = elements[i];

            // Report progress every 50 elements
            if (i % 50 === 0) {
                settings.onProgress?.({
                    stage: "Rendering screenplay text",
                    current: i,
                    total: elements.length,
                    percentage: 20 + Math.floor((i / elements.length) * 60),
                });
            }

            // Add page break if needed
            const elementHeight = estimateElementHeight(pdf, element);
            if (
                currentY + elementHeight >
                SCREENPLAY_FORMAT.PAGE_HEIGHT - SCREENPLAY_FORMAT.MARGIN_BOTTOM
            ) {
                pdf.addPage();
                // Set background color for new page
                pdf.setFillColor(settings.backgroundColor);
                pdf.rect(
                    0,
                    0,
                    SCREENPLAY_FORMAT.PAGE_WIDTH,
                    SCREENPLAY_FORMAT.PAGE_HEIGHT,
                    "F"
                );
                pdf.setTextColor(settings.textColor);
                currentY = SCREENPLAY_FORMAT.MARGIN_TOP;
                previousElementType = null; // Reset for new page
            }

            // Add extra spacing between consecutive Action elements
            if (element.type === "action" && previousElementType === "action") {
                currentY += SCREENPLAY_FORMAT.ACTION_SPACING_AFTER;
            }

            // Render the element
            currentY = renderElement(pdf, element, currentY);

            previousElementType = element.type;
        }

        settings.onProgress?.({
            stage: "Adding page numbers",
            current: elements.length,
            total: elements.length,
            percentage: 85,
        });

        // Add page numbers if enabled
        if (settings.includePageNumbers) {
            addPageNumbers(pdf, settings.textColor);
        }

        // Add watermark if enabled
        if (settings.watermark) {
            addWatermark(pdf, settings.watermark, settings.textColor);
        }

        // Add headers/footers if enabled
        if (settings.includeHeaders && settings.headerText) {
            addHeaders(pdf, settings.headerText, settings.textColor);
        }
        if (settings.includeFooters && settings.footerText) {
            addFooters(pdf, settings.footerText, settings.textColor);
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

    // Get scene number column if mapped
    const sceneNumberColumn = getMappedColumn(configuration.fieldMappings, "scene_number");
    const sceneNumberIndex = sceneNumberColumn ? headers.indexOf(sceneNumberColumn) : -1;

    if (columnMappings.size === 0) {
        throw new Error("No screenplay element columns are mapped");
    }

    // Parse each row
    for (const row of data) {
        // Check each ingredient type to see if this row has content for it
        columnMappings.forEach((columnIndex, ingredientId) => {
            const text = row[columnIndex]?.trim() || "";

            if (text) {
                // Get scene number if this is a scene heading
                const sceneNumber =
                    ingredientId === "scene_heading" && sceneNumberIndex !== -1
                        ? row[sceneNumberIndex]?.trim() || undefined
                        : undefined;

                elements.push({
                    type: ingredientId,
                    text,
                    sceneNumber,
                });
            }
        });
    }

    return elements;
}

/**
 * Estimates the height needed for an element (for page break calculation)
 */
function estimateElementHeight(pdf: jsPDF, element: ScreenplayElement): number {
    const format = SCREENPLAY_FORMAT;

    // Get the appropriate width for text wrapping
    let maxWidth: number;
    switch (element.type) {
        case "dialogue":
            maxWidth = format.DIALOGUE_WIDTH;
            break;
        case "parenthetical":
            maxWidth = format.PARENTHETICAL_WIDTH;
            break;
        default:
            maxWidth = format.ACTION_WIDTH;
    }

    // Split text into lines that fit within maxWidth
    const lines = pdf.splitTextToSize(element.text, maxWidth);
    const numLines = Array.isArray(lines) ? lines.length : 1;

    return numLines * format.LINE_HEIGHT;
}

/**
 * Renders a single screenplay element to the PDF
 */
function renderElement(
    pdf: jsPDF,
    element: ScreenplayElement,
    currentY: number
): number {
    const format = SCREENPLAY_FORMAT;
    let y = currentY;

    // Determine indent and width based on element type
    let indent: number;
    let maxWidth: number;
    let align: "left" | "right" = "left";

    switch (element.type) {
        case "scene_heading":
            indent = format.SCENE_INDENT;
            maxWidth = format.ACTION_WIDTH;
            // Render scene numbers if present
            if (element.sceneNumber) {
                // Left scene number
                pdf.text(element.sceneNumber, format.SCENE_NUMBER_LEFT, y, {
                    align: "left",
                });
                // Right scene number
                pdf.text(element.sceneNumber, format.SCENE_NUMBER_RIGHT, y, {
                    align: "right",
                });
            }
            break;
        case "character":
            indent = format.CHARACTER_INDENT;
            maxWidth = format.ACTION_WIDTH;
            break;
        case "dialogue":
            indent = format.DIALOGUE_INDENT;
            maxWidth = format.DIALOGUE_WIDTH;
            break;
        case "parenthetical":
            indent = format.PARENTHETICAL_INDENT;
            maxWidth = format.PARENTHETICAL_WIDTH;
            break;
        case "transition":
            indent = format.TRANSITION_INDENT;
            maxWidth = format.ACTION_WIDTH;
            align = "right";
            break;
        case "action":
        default:
            indent = format.ACTION_INDENT;
            maxWidth = format.ACTION_WIDTH;
            break;
    }

    // Split text into lines that fit within maxWidth
    const lines = pdf.splitTextToSize(element.text, maxWidth);
    const linesArray = Array.isArray(lines) ? lines : [lines];

    // Render each line
    for (const line of linesArray) {
        pdf.text(line, indent, y, { align });
        y += format.LINE_HEIGHT;
    }

    // Add spacing after element based on type
    switch (element.type) {
        case "scene_heading":
            y += format.SCENE_SPACING_AFTER;
            break;
        case "character":
            y += format.CHARACTER_SPACING_AFTER;
            break;
        case "parenthetical":
            y += format.PARENTHETICAL_SPACING_AFTER;
            break;
        case "dialogue":
            y += format.DIALOGUE_SPACING_AFTER;
            break;
        case "transition":
            y += format.TRANSITION_SPACING_AFTER;
            break;
        // Action spacing is handled in the main loop (consecutive actions)
    }

    return y;
}

/**
 * Adds page numbers to all pages
 */
function addPageNumbers(pdf: jsPDF, textColor: string): void {
    const totalPages = pdf.getNumberOfPages();

    for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFontSize(12);
        pdf.setTextColor(textColor);

        // Page numbers in top-right corner (screenplay standard)
        const pageNumText = `${i}.`;
        pdf.text(pageNumText, 7.5, 0.5, { align: "right" });
    }
}

/**
 * Adds watermark to all pages
 */
function addWatermark(
    pdf: jsPDF,
    watermark: NonNullable<ExportSettings["watermark"]>,
    defaultTextColor: string
): void {
    const totalPages = pdf.getNumberOfPages();

    for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFontSize(96);
        pdf.setTextColor(watermark.color);

        // Save graphics state before changing opacity
        pdf.saveGraphicsState();
        (pdf as any).setGState({ opacity: watermark.opacity });

        const x = SCREENPLAY_FORMAT.PAGE_WIDTH / 2;
        const y = SCREENPLAY_FORMAT.PAGE_HEIGHT / 2;

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
                pdf.text(watermark.text, x, SCREENPLAY_FORMAT.PAGE_HEIGHT - 0.5, {
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
function addHeaders(pdf: jsPDF, headerText: string, textColor: string): void {
    const totalPages = pdf.getNumberOfPages();

    for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFontSize(10);
        pdf.setTextColor(textColor);

        // Save graphics state before changing opacity
        pdf.saveGraphicsState();
        (pdf as any).setGState({ opacity: 0.7 });

        pdf.text(headerText, SCREENPLAY_FORMAT.PAGE_WIDTH / 2, 0.5, {
            align: "center",
        });

        // Restore graphics state (resets opacity)
        pdf.restoreGraphicsState();
    }
}

/**
 * Adds footers to all pages
 */
function addFooters(pdf: jsPDF, footerText: string, textColor: string): void {
    const totalPages = pdf.getNumberOfPages();

    for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFontSize(10);
        pdf.setTextColor(textColor);

        // Save graphics state before changing opacity
        pdf.saveGraphicsState();
        (pdf as any).setGState({ opacity: 0.7 });

        pdf.text(
            footerText,
            SCREENPLAY_FORMAT.PAGE_WIDTH / 2,
            SCREENPLAY_FORMAT.PAGE_HEIGHT - 0.5,
            { align: "center" }
        );

        // Restore graphics state (resets opacity)
        pdf.restoreGraphicsState();
    }
}
