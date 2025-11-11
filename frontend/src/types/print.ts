/**
 * Print Template Types
 *
 * Type definitions for Print templates - custom rendering formats
 * for displaying CSV data in professional page layouts.
 */

/**
 * Text transformation functions
 */
export type TextTransform = "none" | "uppercase" | "lowercase" | "capitalize";

/**
 * Font family options
 */
export type FontFamily = "Courier" | "Times New Roman" | "Arial" | "Helvetica" | "Georgia" | "Verdana";

/**
 * Field style configuration
 */
export interface PrintFieldStyle {
    font: FontFamily;
    size: number;              // Font size in points
    indent: number;            // Left indent in pixels or percentage
    lineSpacing: number;       // Line spacing multiplier (1.0 = single, 2.0 = double)
    color?: string;            // Optional text color (hex or CSS color name)
    textTransform?: TextTransform;  // Optional text transformation
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
}

/**
 * Field mapping from CSV column to Print field
 */
export interface PrintFieldMapping {
    csvColumn: string;              // Which CSV column to use
    style: PrintFieldStyle;         // How to style this field
    transform?: (value: string) => string;  // Optional custom transformation
}

/**
 * Print template definition
 */
export interface PrintTemplate {
    id: string;
    name: string;
    description?: string;
    author?: string;
    version?: string;
    fieldMappings: {
        [printField: string]: PrintFieldMapping;
    };
}

/**
 * Print preview settings
 */
export interface PrintPreviewSettings {
    zoom: number;              // Zoom level (1.0 = 100%)
    showPageBreaks: boolean;   // Show page break indicators
    highlightSelection: boolean;  // Highlight selected CSV row in preview
}

/**
 * Bundled Print template IDs
 */
export type BundledPrintId = "screenplay" | "dialogue" | "game-design";

/**
 * Print template metadata
 */
export interface PrintTemplateMetadata {
    id: string;
    name: string;
    description: string;
    isBundled: boolean;
    createdAt?: Date;
    modifiedAt?: Date;
}
