// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Export Template Type Definitions
 *
 * Defines the structure for custom export templates that transform
 * CSV/TSV data into various output formats (JSON, YAML, XML, custom text).
 */

/** Available transform functions for field values */
export type TransformFunction =
    | "uppercase"
    | "lowercase"
    | "trim"
    | "parseNumber"
    | "parseBoolean"
    | "escapeHtml"
    | "escapeJson";

/** Maps a CSV column to an export field with optional transformation */
export interface FieldMapping {
    /** CSV column header name */
    csvColumn: string;
    /** Output field name in the export */
    exportField: string;
    /** Optional transformation to apply to the value */
    transform?: TransformFunction;
    /** Default value if the CSV cell is empty */
    defaultValue?: string;
}

/** Export output format */
export type ExportFormat = "json" | "yaml" | "xml" | "custom";

/** Export template options */
export interface ExportOptions {
    /** Pretty-print output with indentation */
    prettyPrint: boolean;
    /** Indentation size (spaces) */
    indentation: number;
    /** File encoding */
    encoding: string;
    /** File extension for the output */
    fileExtension: string;
    /** Whether to include empty/null fields in output */
    includeEmpty: boolean;
}

/** Complete export template definition */
export interface ExportTemplate {
    /** Unique identifier */
    id: string;
    /** Display name */
    name: string;
    /** Description of the template */
    description: string;
    /** Output format type */
    outputFormat: ExportFormat;
    /** Field mappings from CSV columns to export fields */
    fieldMappings: FieldMapping[];
    /** Template string for file header (before data) */
    headerTemplate: string;
    /** Template string for each data row - uses {fieldName} placeholders */
    rowTemplate: string;
    /** Template string for file footer (after data) */
    footerTemplate: string;
    /** Separator between rows */
    rowSeparator: string;
    /** Export options */
    options: ExportOptions;
    /** Whether this is a built-in template */
    isBuiltIn: boolean;
    /** Category for organization */
    category: string;
}
