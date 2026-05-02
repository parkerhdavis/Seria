// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * PDF Export Utilities
 *
 * Functions for exporting Print views to PDF with custom settings.
 * Uses html2canvas and jsPDF directly for full control over rendering context.
 */

import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { writeFile } from "@tauri-apps/plugin-fs";
import type { ExportSettings } from "@/components/prints/ExportDialog";
import { logger } from "@/utils/logger";
import { formatError } from "@/utils/tauriErrorHandler";

/**
 * Exports a Print view element to PDF with the specified settings
 *
 * @param printElement - The DOM element containing the Print view to export
 * @param settings - Export settings (colors, watermarks, page range, etc.)
 */
export async function exportPrintToPDF(
    printElement: HTMLElement,
    settings: ExportSettings
): Promise<void> {
    try {
        logger.debug("[PDF Export] Starting PDF export...");

        // Report initial progress
        settings.onProgress?.({
            stage: "Preparing export",
            current: 0,
            total: 100,
            percentage: 0,
        });

        // Clone the element so we can modify it without affecting the UI
        const clone = printElement.cloneNode(true) as HTMLElement;
        logger.debug("[PDF Export] Element cloned");

        // Count total elements for progress tracking
        // This gives users an accurate estimate of how many elements need to be processed
        const totalElements = countElements(clone);
        logger.debug(`[PDF Export] Total elements to process: ${totalElements}`);

        settings.onProgress?.({
            stage: "Cloning element",
            current: 0,
            total: totalElements,
            percentage: 5,
        });

        // Apply export-specific styling with progress tracking
        // This is the most time-consuming step, especially for large documents
        logger.debug("[PDF Export] Applying export styles...");
        applyExportStyles(clone, settings, totalElements);
        logger.debug("[PDF Export] Export styles applied");

        // Add watermark if enabled
        if (settings.watermark) {
            logger.debug("[PDF Export] Adding watermark...");
            addWatermark(clone, settings.watermark);
        }

        // Add headers/footers if enabled
        if (settings.includeHeaders && settings.headerText) {
            logger.debug("[PDF Export] Adding header...");
            addHeader(clone, settings.headerText);
        }
        if (settings.includeFooters && settings.footerText) {
            logger.debug("[PDF Export] Adding footer...");
            addFooter(clone, settings.footerText);
        }

        // Filter pages if custom page range is specified
        if (settings.pageRange === "custom" && settings.customPageStart && settings.customPageEnd) {
            logger.debug("[PDF Export] Filtering page range...");
            filterPageRange(clone, settings.customPageStart, settings.customPageEnd);
        }

        // CRITICAL: Create an isolated iframe to avoid oklch color function issues
        //
        // Problem: The main application uses Tailwind CSS v4 with daisyUI, which
        // uses the modern oklch() color function. html2canvas doesn't support
        // oklch and will throw an error if it encounters it in any stylesheet.
        //
        // Solution: Render the content in a completely isolated iframe that:
        // 1. Has NO access to the main document's stylesheets (which contain oklch)
        // 2. Only has a minimal RGB-based stylesheet we control
        // 3. Uses inlined styles (already converted from oklch to RGB by the browser)
        //
        // This way, html2canvas never sees any oklch color functions.
        const iframe = document.createElement("iframe");
        iframe.style.position = "absolute";
        iframe.style.left = "-9999px"; // Hide off-screen
        iframe.style.top = "0";
        iframe.style.width = "8.5in";  // US Letter width
        iframe.style.height = "11in";   // US Letter height
        document.body.appendChild(iframe);
        logger.debug("[PDF Export] Iframe created");

        // Wait for iframe to be fully initialized
        await new Promise((resolve) => {
            iframe.onload = resolve;
            if (!iframe.src) {
                iframe.src = "about:blank"; // Blank document, no external resources
            }
        });

        // Get the iframe's document
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!iframeDoc) {
            throw new Error("Failed to access iframe document");
        }

        // Add minimal RGB-only stylesheet to the iframe
        // This is the ONLY stylesheet html2canvas will see
        const style = iframeDoc.createElement("style");
        style.textContent = `
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            body {
                font-family: "Courier New", Courier, monospace;
                background-color: ${settings.backgroundColor};
                color: ${settings.textColor};
            }
        `;
        iframeDoc.head.appendChild(style);

        // Add the clone (with all inlined RGB styles) to the iframe body
        iframeDoc.body.appendChild(clone);
        logger.debug("[PDF Export] Clone added to iframe");

        // Force browser to recalculate layout before rendering
        void clone.offsetHeight;

        settings.onProgress?.({
            stage: "Creating isolated environment",
            current: totalElements,
            total: totalElements,
            percentage: 50,
        });

        logger.debug("[PDF Export] Generating canvas with html2canvas...");

        settings.onProgress?.({
            stage: "Rendering to canvas",
            current: 0,
            total: totalElements,
            percentage: 60,
        });

        // Render the cloned element to a canvas using html2canvas
        // This reads the element's styles and converts it to a raster image
        // This step can take a while for large/complex documents
        const canvas = await html2canvas(clone, {
            scale: 2, // 2x scale for high-quality output (retina-like)
            useCORS: true, // Allow cross-origin images if needed
            logging: true, // Enable debug logging to console
            backgroundColor: settings.backgroundColor,
            windowWidth: iframe.contentWindow?.innerWidth || 816, // 8.5" at 96dpi
            windowHeight: iframe.contentWindow?.innerHeight || 1056, // 11" at 96dpi
            foreignObjectRendering: false, // Disable SVG rendering (would try to access stylesheets)
        });

        logger.debug("[PDF Export] Canvas generated, creating PDF...");

        settings.onProgress?.({
            stage: "Creating PDF document",
            current: totalElements,
            total: totalElements,
            percentage: 80,
        });

        // Create a new PDF document with screenplay-standard dimensions
        // US Letter: 8.5" wide × 11" tall
        const pdf = new jsPDF({
            orientation: "portrait",
            unit: "in",
            format: "letter",
        });

        // Calculate image dimensions for the PDF
        // Screenplay margins: 1.5" left, 1" right, 1" top/bottom
        const imgWidth = 8.5 - 1.5 - 1;  // Available width: 6 inches
        const imgHeight = (canvas.height * imgWidth) / canvas.width; // Maintain aspect ratio
        const pageHeight = 11 - 1 - 1;   // Available height per page: 9 inches

        // Convert canvas to JPEG data URL for embedding in PDF
        const imgData = canvas.toDataURL("image/jpeg", 0.98);

        let heightLeft = imgHeight; // Track how much content remains
        let position = 1;           // Start at top margin (1 inch)

        // Add first page with the image
        pdf.addImage(imgData, "JPEG", 1.5, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;

        // If content is taller than one page, split across multiple pages
        while (heightLeft > 0) {
            position = heightLeft - imgHeight + 1; // Calculate negative offset for next page
            pdf.addPage();
            pdf.addImage(imgData, "JPEG", 1.5, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;
        }

        // Save the PDF to the user-specified path using Tauri's file system API
        // jsPDF generates the PDF as an ArrayBuffer, which we convert to bytes
        logger.debug("[PDF Export] Saving PDF to disk...");
        const pdfArrayBuffer = pdf.output("arraybuffer");
        const pdfBytes = new Uint8Array(pdfArrayBuffer);

        settings.onProgress?.({
            stage: "Saving PDF to disk",
            current: totalElements,
            total: totalElements,
            percentage: 90,
        });

        // Write the PDF file to disk at the exact path the user chose
        await writeFile(settings.savePath, pdfBytes);

        logger.debug("[PDF Export] PDF saved successfully");

        // Report completion
        settings.onProgress?.({
            stage: "Export complete",
            current: totalElements,
            total: totalElements,
            percentage: 100,
        });

        // Remove the temporary iframe
        document.body.removeChild(iframe);
        logger.debug("[PDF Export] Cleanup complete");
    } catch (error: unknown) {
        logger.error("PDF export failed:", error);
        throw new Error(`Failed to export PDF: ${formatError(error)}`);
    }
}

/**
 * Recursively converts all computed styles to inline styles and removes class names
 *
 * This is a critical step in the oklch workaround strategy:
 *
 * PROBLEM:
 * - Main app uses Tailwind CSS classes (e.g., "text-base", "bg-base-200")
 * - These classes are defined in stylesheets with oklch() color values
 * - html2canvas tries to look up class definitions in the original document's stylesheets
 * - Even when rendering in an isolated iframe, html2canvas finds these classes
 *   and attempts to parse the oklch() values, causing an error
 *
 * SOLUTION:
 * 1. Read all computed styles (browser has already converted oklch to RGB)
 * 2. Apply these RGB values as inline styles (style="color: rgb(...)")
 * 3. Remove ALL class names so html2canvas has nothing to look up
 * 4. Remove IDs too for safety
 *
 * Result: html2canvas only sees inline RGB styles, never encounters oklch
 *
 * @param element - The element to process (and all its children recursively)
 * @param onProgress - Optional callback to report progress (called with current element count)
 * @param elementCount - Internal counter for tracking progress across recursion
 * @returns Total number of elements processed
 */
function inlineAllComputedStyles(
    element: HTMLElement,
    onProgress?: (count: number) => void,
    elementCount: { value: number } = { value: 0 }
): number {
    // Get the browser's computed style for this element
    // This is where oklch gets converted to RGB automatically by the browser
    const computedStyle = window.getComputedStyle(element);

    logger.trace("[Style Inline] Processing element:", element.tagName, element.className);

    // Color properties are most likely to contain oklch, so prioritize them.
    // These get !important to override any remaining stylesheet rules.
    const criticalProps = new Set([
        "color",
        "background-color",
        "border-color",
        "border-top-color",
        "border-right-color",
        "border-bottom-color",
        "border-left-color",
        "outline-color",
        "fill", // SVG fill color
        "stroke", // SVG stroke color
    ]);

    // Build a single cssText string with all computed styles, then assign
    // it in one DOM write. This avoids ~400 individual setProperty calls
    // per element (each of which can trigger style recalculation).
    const styleParts: string[] = [];

    for (let i = 0; i < computedStyle.length; i++) {
        const prop = computedStyle[i];

        // Skip properties that might cause issues or aren't needed
        if (
            prop.startsWith("-webkit-") || // Browser-specific prefixes
            prop.startsWith("--") || // CSS custom properties (variables)
            prop === "d" || // SVG path data (not a style)
            prop === "content" // Pseudo-element content
        ) {
            continue;
        }

        const value = computedStyle.getPropertyValue(prop);
        if (!value) continue;

        if (criticalProps.has(prop)) {
            // Debug check: if we still see oklch here, something is wrong
            if (value.includes("oklch")) {
                logger.warn(`  WARNING: oklch found in ${prop}: ${value}`);
            }
            // Critical color properties get !important to override everything
            styleParts.push(`${prop}: ${value} !important`);
        } else {
            const priority = computedStyle.getPropertyPriority(prop);
            styleParts.push(
                priority ? `${prop}: ${value} !${priority}` : `${prop}: ${value}`
            );
        }
    }

    // Single DOM write instead of hundreds of individual setProperty calls
    element.style.cssText = styleParts.join("; ");

    // CRITICAL: Remove all class names so html2canvas doesn't try to look them up
    // in the original document's stylesheets (which contain oklch)
    //
    // Even in an isolated iframe, html2canvas can still find and parse the
    // main document's stylesheets if it sees class names on elements
    element.className = "";

    // Also remove id attribute to be extra safe
    element.removeAttribute("id");

    logger.trace(`  Removed classes and id from ${element.tagName}`);

    // Increment counter and report progress
    elementCount.value++;
    if (onProgress && elementCount.value % 50 === 0) {
        // Report every 50 elements to avoid overwhelming the UI with updates
        onProgress(elementCount.value);
    }

    // Recursively process all child elements
    Array.from(element.children).forEach((child) => {
        if (child instanceof HTMLElement) {
            inlineAllComputedStyles(child, onProgress, elementCount);
        }
    });

    return elementCount.value;
}

/**
 * Recursively counts all HTML elements in a tree
 *
 * Used to calculate the total number of elements for progress tracking.
 * This gives users an accurate estimate of export progress when processing
 * large Print views with thousands of elements.
 *
 * @param element - The root element to count from
 * @returns Total number of elements including the root and all descendants
 */
function countElements(element: HTMLElement): number {
    let count = 1; // Count the current element

    // Recursively count all child elements
    Array.from(element.children).forEach((child) => {
        if (child instanceof HTMLElement) {
            count += countElements(child);
        }
    });

    return count;
}

/**
 * Applies custom colors and styles to the cloned element
 *
 * This function coordinates the critical style inlining process that allows
 * html2canvas to render the element without encountering oklch color functions.
 * It also reports progress during the inlining process for large documents.
 *
 * @param element - The cloned element to style
 * @param settings - Export settings including colors and progress callback
 * @param totalElements - Total number of elements in the tree (for progress tracking)
 */
function applyExportStyles(
    element: HTMLElement,
    settings: ExportSettings,
    totalElements: number
): void {
    // IMPORTANT: Inline all computed styles to bypass oklch in stylesheets
    // html2canvas doesn't support oklch color function, but the browser
    // computes oklch to RGB, so by inlining we get RGB values
    //
    // We track progress during this operation since it can take time for large documents

    inlineAllComputedStyles(element, (currentCount) => {
        // Report progress: 5% to 40% of overall export progress
        const percentage = 5 + Math.floor((currentCount / totalElements) * 35);
        settings.onProgress?.({
            stage: "Inlining styles",
            current: currentCount,
            total: totalElements,
            percentage,
        });
    });

    // Apply background color
    element.style.backgroundColor = settings.backgroundColor;

    // Apply text color to all text elements
    const textElements = element.querySelectorAll("p, span, div, h1, h2, h3, h4, h5, h6");
    textElements.forEach((el) => {
        (el as HTMLElement).style.color = settings.textColor;
    });

    // Override any theme-specific background colors
    const pages = element.querySelectorAll(".screenplay-page");
    pages.forEach((page) => {
        (page as HTMLElement).style.backgroundColor = settings.backgroundColor;
    });

    // Hide UI elements that shouldn't be in the PDF
    const uiElements = element.querySelectorAll(
        ".editing-indicator, .selected-indicator, .cut-indicator, .context-menu"
    );
    uiElements.forEach((el) => {
        (el as HTMLElement).style.display = "none";
    });

    // Remove hover effects and interactive indicators
    const hoverElements = element.querySelectorAll("[onmouseenter], [onmouseleave]");
    hoverElements.forEach((el) => {
        (el as HTMLElement).style.pointerEvents = "none";
    });
}

/**
 * Adds a watermark to the element
 */
function addWatermark(
    element: HTMLElement,
    watermark: NonNullable<ExportSettings["watermark"]>
): void {
    const watermarkDiv = document.createElement("div");
    watermarkDiv.textContent = watermark.text;
    watermarkDiv.style.position = "fixed";
    watermarkDiv.style.fontSize = "96pt";
    watermarkDiv.style.fontWeight = "bold";
    watermarkDiv.style.fontFamily = "Courier, monospace";
    watermarkDiv.style.color = watermark.color;
    watermarkDiv.style.opacity = watermark.opacity.toString();
    watermarkDiv.style.pointerEvents = "none";
    watermarkDiv.style.zIndex = "9999";

    // Position based on watermark position setting
    switch (watermark.position) {
        case "diagonal":
            watermarkDiv.style.top = "50%";
            watermarkDiv.style.left = "50%";
            watermarkDiv.style.transform = "translate(-50%, -50%) rotate(-45deg)";
            watermarkDiv.style.whiteSpace = "nowrap";
            break;
        case "header":
            watermarkDiv.style.top = "0.5in";
            watermarkDiv.style.left = "50%";
            watermarkDiv.style.transform = "translateX(-50%)";
            watermarkDiv.style.fontSize = "24pt";
            break;
        case "footer":
            watermarkDiv.style.bottom = "0.5in";
            watermarkDiv.style.left = "50%";
            watermarkDiv.style.transform = "translateX(-50%)";
            watermarkDiv.style.fontSize = "24pt";
            break;
    }

    // Add watermark to all pages
    const pages = element.querySelectorAll(".screenplay-page");
    if (pages.length > 0) {
        pages.forEach((page) => {
            const watermarkClone = watermarkDiv.cloneNode(true) as HTMLElement;
            watermarkClone.style.position = "absolute"; // Use absolute for each page
            (page as HTMLElement).style.position = "relative";
            page.appendChild(watermarkClone);
        });
    } else {
        // If no pages found (continuous mode), add to main element
        element.appendChild(watermarkDiv);
    }
}

/**
 * Adds a header to all pages
 */
function addHeader(element: HTMLElement, headerText: string): void {
    const pages = element.querySelectorAll(".screenplay-page");

    const createHeaderElement = () => {
        const headerDiv = document.createElement("div");
        headerDiv.textContent = headerText;
        headerDiv.style.position = "absolute";
        headerDiv.style.top = "0.5in";
        headerDiv.style.left = "1.5in";
        headerDiv.style.right = "1in";
        headerDiv.style.fontSize = "10pt";
        headerDiv.style.fontFamily = "Courier, monospace";
        headerDiv.style.textAlign = "center";
        headerDiv.style.opacity = "0.7";
        return headerDiv;
    };

    if (pages.length > 0) {
        pages.forEach((page) => {
            (page as HTMLElement).style.position = "relative";
            page.appendChild(createHeaderElement());
        });
    }
}

/**
 * Adds a footer to all pages
 */
function addFooter(element: HTMLElement, footerText: string): void {
    const pages = element.querySelectorAll(".screenplay-page");

    const createFooterElement = () => {
        const footerDiv = document.createElement("div");
        footerDiv.textContent = footerText;
        footerDiv.style.position = "absolute";
        footerDiv.style.bottom = "0.5in";
        footerDiv.style.left = "1.5in";
        footerDiv.style.right = "1in";
        footerDiv.style.fontSize = "10pt";
        footerDiv.style.fontFamily = "Courier, monospace";
        footerDiv.style.textAlign = "center";
        footerDiv.style.opacity = "0.7";
        return footerDiv;
    };

    if (pages.length > 0) {
        pages.forEach((page) => {
            (page as HTMLElement).style.position = "relative";
            page.appendChild(createFooterElement());
        });
    }
}

/**
 * Filters pages to only include the specified page range
 */
function filterPageRange(element: HTMLElement, startPage: number, endPage: number): void {
    const pages = element.querySelectorAll(".screenplay-page");

    pages.forEach((page, index) => {
        const pageNumber = index + 1; // 1-indexed
        if (pageNumber < startPage || pageNumber > endPage) {
            (page as HTMLElement).style.display = "none";
        }
    });
}
