// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Data Transformation Pipeline
 *
 * Centralized service for parsing, transforming, and serializing data
 * in Seria. Provides a unified pipeline: content -> parse() -> transform() -> serialize() -> output
 *
 * This consolidates scattered transformation logic from cellParser, printRecipeMapper,
 * exportTemplateStore, and the various print workers into a single composable system.
 */

import Papa from "papaparse";
import type { CellData } from "@/types/cellData";
import type {
  PrintRecipe,
  RecipeConfiguration,
  RenderedElement,
} from "@/types/printRecipe";
import type { ExportTemplate, TransformFunction } from "@/types/exportTemplate";
import type { ScreenplayElement, CardData } from "@/types/workerMessages";
import {
  getMappedColumn,
  getMappedColumns,
  getMappedColumnIndex,
} from "@/utils/mappingUtils";
import { logger } from "@/utils/logger";

// ============================================================================
// Core Types
// ============================================================================

/** Supported input file formats */
export type FileFormat = "csv" | "tsv" | "cell" | "json";

/** Supported output formats for serialization */
export type OutputFormat = "csv" | "tsv" | "json" | "yaml" | "xml" | "custom";

/** Result of the parse stage */
export interface ParseResult {
  data: CellData;
  delimiter: string;
  warnings: string[];
}

/** Options for the parse stage */
export interface ParseOptions {
  /** Override delimiter detection (otherwise auto-detected) */
  delimiter?: string;
  /** Whether first row is headers (default: true) */
  firstRowIsHeaders?: boolean;
  /** Skip empty lines (default: true) */
  skipEmptyLines?: boolean;
}

/** A single step in a transformation pipeline */
export interface TransformStep {
  /** Unique name for this step (for debugging/logging) */
  name: string;
  /** The transformation function */
  execute: (data: CellData) => CellData;
}

/** Options for the serialize stage */
export interface SerializeOptions {
  /** Delimiter for CSV/TSV output */
  delimiter?: string;
  /** Whether to quote all fields */
  quoteAll?: boolean;
  /** Whether to include headers in output */
  includeHeaders?: boolean;
}

/** Complete pipeline configuration */
export interface PipelineConfig {
  parseOptions?: ParseOptions;
  transforms?: TransformStep[];
  serializeOptions?: SerializeOptions;
}

// ============================================================================
// Parse Stage
// ============================================================================

/**
 * Parse raw file content into structured CellData.
 *
 * @param content - Raw file content string
 * @param options - Parse configuration options
 * @returns ParseResult with data, detected delimiter, and any warnings
 */
export function parse(
  content: string,
  options: ParseOptions = {},
): ParseResult {
  const {
    delimiter: overrideDelimiter,
    firstRowIsHeaders = true,
    skipEmptyLines = true,
  } = options;

  const warnings: string[] = [];

  const parseConfig: Papa.ParseConfig = {
    header: false,
    skipEmptyLines,
    ...(overrideDelimiter
      ? { delimiter: overrideDelimiter }
      : { delimitersToGuess: [",", "\t", "|", ";"] as string[] }),
  };

  const result = Papa.parse<string[]>(content, parseConfig);

  if (result.errors.length > 0) {
    for (const error of result.errors) {
      warnings.push(`Row ${error.row}: ${error.message}`);
    }
  }

  const rawData = result.data;
  const delimiter = overrideDelimiter || result.meta.delimiter || ",";

  if (rawData.length === 0) {
    return {
      data: { headers: [], data: [] },
      delimiter,
      warnings,
    };
  }

  let headers: string[];
  let data: string[][];

  if (firstRowIsHeaders) {
    headers = rawData[0];
    data = rawData.slice(1);
  } else {
    // Generate column names: Column 1, Column 2, ...
    headers = rawData[0].map((_, i) => `Column ${i + 1}`);
    data = rawData;
  }

  return {
    data: { headers, data },
    delimiter,
    warnings,
  };
}

/**
 * Detect the appropriate delimiter from a file path extension.
 *
 * @param filePath - Path to the file
 * @returns The delimiter character
 */
export function delimiterFromPath(filePath: string): string {
  const extension = filePath.split(".").pop()?.toLowerCase();
  switch (extension) {
    case "tsv":
      return "\t";
    case "csv":
    case "cell":
    default:
      return ",";
  }
}

// ============================================================================
// Transform Stage — Built-in Transforms
// ============================================================================

/**
 * Create a transform step that filters rows based on a predicate.
 *
 * @param name - Step name for debugging
 * @param predicate - Function that returns true for rows to keep
 * @returns TransformStep
 */
export function filterRows(
  name: string,
  predicate: (row: string[], rowIndex: number, headers: string[]) => boolean,
): TransformStep {
  return {
    name,
    execute: (data: CellData): CellData => ({
      headers: data.headers,
      data: data.data.filter((row, i) => predicate(row, i, data.headers)),
    }),
  };
}

/**
 * Create a transform step that maps/transforms each row.
 *
 * @param name - Step name for debugging
 * @param mapper - Function that transforms a row
 * @returns TransformStep
 */
export function mapRows(
  name: string,
  mapper: (row: string[], rowIndex: number, headers: string[]) => string[],
): TransformStep {
  return {
    name,
    execute: (data: CellData): CellData => ({
      headers: data.headers,
      data: data.data.map((row, i) => mapper(row, i, data.headers)),
    }),
  };
}

/**
 * Create a transform step that selects specific columns.
 *
 * @param columnNames - Array of column names to keep (in order)
 * @returns TransformStep
 */
export function selectColumns(columnNames: string[]): TransformStep {
  return {
    name: `selectColumns(${columnNames.join(", ")})`,
    execute: (data: CellData): CellData => {
      const indices = columnNames
        .map((name) => data.headers.indexOf(name))
        .filter((idx) => idx >= 0);

      return {
        headers: indices.map((i) => data.headers[i]),
        data: data.data.map((row) => indices.map((i) => row[i] || "")),
      };
    },
  };
}

/**
 * Create a transform step that renames columns.
 *
 * @param renameMap - Map of old column name -> new column name
 * @returns TransformStep
 */
export function renameColumns(
  renameMap: Record<string, string>,
): TransformStep {
  return {
    name: "renameColumns",
    execute: (data: CellData): CellData => ({
      headers: data.headers.map((h) => renameMap[h] || h),
      data: data.data,
    }),
  };
}

/**
 * Create a transform step that applies a text transform to specific columns.
 *
 * @param columnName - Column to transform
 * @param transformFn - Transform function name
 * @returns TransformStep
 */
export function transformColumn(
  columnName: string,
  transformFn: TransformFunction,
): TransformStep {
  return {
    name: `transformColumn(${columnName}, ${transformFn})`,
    execute: (data: CellData): CellData => {
      const colIdx = data.headers.indexOf(columnName);
      if (colIdx < 0) return data;

      return {
        headers: data.headers,
        data: data.data.map((row) => {
          const newRow = [...row];
          newRow[colIdx] = applyValueTransform(row[colIdx] || "", transformFn);
          return newRow;
        }),
      };
    },
  };
}

/**
 * Create a transform step that removes empty rows.
 *
 * @returns TransformStep
 */
export function removeEmptyRows(): TransformStep {
  return {
    name: "removeEmptyRows",
    execute: (data: CellData): CellData => ({
      headers: data.headers,
      data: data.data.filter((row) => row.some((cell) => cell.trim() !== "")),
    }),
  };
}

/**
 * Create a transform step that sorts rows by a column.
 *
 * @param columnName - Column to sort by
 * @param direction - Sort direction ("asc" or "desc")
 * @returns TransformStep
 */
export function sortByColumn(
  columnName: string,
  direction: "asc" | "desc" = "asc",
): TransformStep {
  return {
    name: `sortByColumn(${columnName}, ${direction})`,
    execute: (data: CellData): CellData => {
      const colIdx = data.headers.indexOf(columnName);
      if (colIdx < 0) return data;

      const sorted = [...data.data].sort((a, b) => {
        const valA = a[colIdx] || "";
        const valB = b[colIdx] || "";
        const cmp = valA.localeCompare(valB, undefined, { numeric: true });
        return direction === "asc" ? cmp : -cmp;
      });

      return { headers: data.headers, data: sorted };
    },
  };
}

// ============================================================================
// Transform Stage — Recipe-Based Transforms
// ============================================================================

/**
 * Transform CellData into ScreenplayElements using a recipe configuration.
 * Consolidates the element parsing logic that was duplicated between
 * screenplayPrint.worker.ts and pdfExportScreenplay.ts.
 *
 * @param data - Cell data to transform
 * @param recipe - Screenplay print recipe
 * @param configuration - Recipe field mapping configuration
 * @param editingCell - Currently editing cell (null if none)
 * @param editingValue - Current editing value
 * @returns Array of ScreenplayElements
 */
export function transformToScreenplayElements(
  data: CellData,
  recipe: PrintRecipe,
  configuration: RecipeConfiguration,
  editingCell: { row: number; col: number } | null = null,
  editingValue: string = "",
): ScreenplayElement[] {
  const { headers, data: rows } = data;
  const { fieldMappings } = configuration;

  // Resolve column indices for each element type
  const transitionIdx = getMappedColumnIndex(
    fieldMappings,
    "transition",
    headers,
  );
  const sceneHeadingIdx = getMappedColumnIndex(
    fieldMappings,
    "scene_heading",
    headers,
  );
  const characterIdx = getMappedColumnIndex(
    fieldMappings,
    "character",
    headers,
  );
  const dialogueIdx = getMappedColumnIndex(fieldMappings, "dialogue", headers);
  const parentheticalIdx = getMappedColumnIndex(
    fieldMappings,
    "parenthetical",
    headers,
  );
  const actionIdx = getMappedColumnIndex(fieldMappings, "action", headers);

  const elements: ScreenplayElement[] = [];
  let sceneNumber = 0;

  const getCellValue = (rowIndex: number, colIndex: number): string => {
    if (
      editingCell &&
      editingCell.row === rowIndex &&
      editingCell.col === colIndex
    ) {
      return editingValue;
    }
    return rows[rowIndex]?.[colIndex] || "";
  };

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    // Check each element type in priority order
    const transition =
      transitionIdx >= 0 ? getCellValue(rowIndex, transitionIdx).trim() : "";
    const sceneHeading =
      sceneHeadingIdx >= 0
        ? getCellValue(rowIndex, sceneHeadingIdx).trim()
        : "";
    const character =
      characterIdx >= 0 ? getCellValue(rowIndex, characterIdx).trim() : "";
    const dialogue =
      dialogueIdx >= 0 ? getCellValue(rowIndex, dialogueIdx).trim() : "";
    const parenthetical =
      parentheticalIdx >= 0
        ? getCellValue(rowIndex, parentheticalIdx).trim()
        : "";
    const action =
      actionIdx >= 0 ? getCellValue(rowIndex, actionIdx).trim() : "";

    // Transition (highest priority)
    if (transition) {
      elements.push({
        type: "transition",
        content: transition,
        rowIndex,
        columnName: headers[transitionIdx] || "",
      });
      continue;
    }

    // Scene heading
    if (sceneHeading) {
      sceneNumber++;
      elements.push({
        type: "scene_heading",
        content: sceneHeading,
        rowIndex,
        columnName: headers[sceneHeadingIdx] || "",
        sceneNumber,
      });
    }

    // Character + parenthetical + dialogue block
    if (character) {
      elements.push({
        type: "character",
        content: character,
        rowIndex,
        columnName: headers[characterIdx] || "",
      });

      if (parenthetical) {
        elements.push({
          type: "parenthetical",
          content: parenthetical,
          rowIndex,
          columnName: headers[parentheticalIdx] || "",
        });
      }

      if (dialogue) {
        elements.push({
          type: "dialogue",
          content: dialogue,
          rowIndex,
          columnName: headers[dialogueIdx] || "",
        });
      }
    }

    // Action (lowest priority, only if no character on this row)
    if (action && !character) {
      elements.push({
        type: "action",
        content: action,
        rowIndex,
        columnName: headers[actionIdx] || "",
      });
    }
  }

  return elements;
}

/**
 * Transform CellData into CardData using a recipe configuration.
 * Consolidates the card transformation logic from cardPrint.worker.ts.
 *
 * @param data - Cell data to transform
 * @param configuration - Recipe field mapping configuration
 * @param editingCell - Currently editing cell (null if none)
 * @param editingValue - Current editing value
 * @returns Array of CardData
 */
export function transformToCards(
  data: CellData,
  configuration: RecipeConfiguration,
  editingCell: { row: number; col: number } | null = null,
  editingValue: string = "",
): CardData[] {
  const { headers, data: rows } = data;
  const { fieldMappings } = configuration;

  const titleColumn = getMappedColumn(fieldMappings, "title");
  const subtitleColumn = getMappedColumn(fieldMappings, "subtitle");
  const contentColumns = getMappedColumns(fieldMappings, "content");

  const titleIdx = titleColumn ? headers.indexOf(titleColumn) : -1;
  const subtitleIdx = subtitleColumn ? headers.indexOf(subtitleColumn) : -1;
  const contentIndices = contentColumns
    .map((col) => headers.indexOf(col))
    .filter((idx) => idx >= 0);

  const getCellValue = (rowIndex: number, colIndex: number): string => {
    if (
      editingCell &&
      editingCell.row === rowIndex &&
      editingCell.col === colIndex
    ) {
      return editingValue;
    }
    return rows[rowIndex]?.[colIndex] || "";
  };

  return rows.map((_, rowIndex) => ({
    index: rowIndex,
    title: titleIdx >= 0 ? getCellValue(rowIndex, titleIdx) : "",
    subtitle: subtitleIdx >= 0 ? getCellValue(rowIndex, subtitleIdx) : "",
    content: contentIndices.map((colIdx) => getCellValue(rowIndex, colIdx)),
    titleColumnName: titleColumn || undefined,
    subtitleColumnName: subtitleColumn || undefined,
    contentColumnNames: contentColumns,
  }));
}

/**
 * Transform CellData into RenderedElements using a generic recipe.
 * Uses the RecipeRenderer-compatible output format.
 *
 * @param data - Cell data to transform
 * @param recipe - Print recipe
 * @param configuration - Recipe field mapping configuration
 * @returns Array of RenderedElements
 */
export function transformToRenderedElements(
  data: CellData,
  recipe: PrintRecipe,
  configuration: RecipeConfiguration,
): RenderedElement[] {
  const { headers, data: rows } = data;
  const { fieldMappings } = configuration;
  const elements: RenderedElement[] = [];

  for (const row of rows) {
    for (const [ingredientId, ingredient] of Object.entries(
      recipe.ingredients,
    )) {
      const column = getMappedColumn(fieldMappings, ingredientId);
      if (!column) continue;

      const colIdx = headers.indexOf(column);
      if (colIdx < 0) continue;

      const content = row[colIdx] || "";
      if (!content.trim()) continue;

      elements.push({
        ingredientId,
        content,
        style: { ...ingredient.style },
      });
    }
  }

  return elements;
}

// ============================================================================
// Serialize Stage
// ============================================================================

/**
 * Serialize CellData to a CSV/TSV string.
 *
 * @param data - CellData to serialize
 * @param options - Serialization options
 * @returns Serialized string
 */
export function serializeToCsv(
  data: CellData,
  options: SerializeOptions = {},
): string {
  const { delimiter = ",", quoteAll = true, includeHeaders = true } = options;

  const rows = includeHeaders ? [data.headers, ...data.data] : data.data;

  return Papa.unparse(rows, {
    quotes: quoteAll,
    quoteChar: '"',
    escapeChar: '"',
    delimiter,
    newline: "\n",
  });
}

/**
 * Serialize CellData using an export template.
 * This is the template execution engine that processes header/row/footer templates
 * with placeholder substitution.
 *
 * @param data - CellData to serialize
 * @param template - Export template to use
 * @returns Serialized string in the template's format
 */
export function serializeWithTemplate(
  data: CellData,
  template: ExportTemplate,
): string {
  const { headers, data: rows } = data;
  const processedRows: string[] = [];

  for (const row of rows) {
    let rowStr: string;

    switch (template.outputFormat) {
      case "json": {
        const indent = " ".repeat(template.options.indentation);
        if (template.rowTemplate.includes("{")) {
          rowStr = processTemplatePlaceholders(
            template.rowTemplate,
            headers,
            row,
            template,
          );
        } else {
          rowStr =
            indent + generateJsonObject(headers, row, template, indent + "  ");
        }
        break;
      }
      case "yaml": {
        if (template.rowTemplate.includes("{")) {
          rowStr = processTemplatePlaceholders(
            template.rowTemplate,
            headers,
            row,
            template,
          );
        } else {
          rowStr = "- " + generateYamlFields(headers, row, template);
        }
        break;
      }
      case "xml": {
        if (template.rowTemplate.includes("{")) {
          rowStr = processTemplatePlaceholders(
            template.rowTemplate,
            headers,
            row,
            template,
          );
        } else {
          rowStr =
            "  <row>\n" +
            generateXmlFields(headers, row, template) +
            "\n  </row>";
        }
        break;
      }
      case "custom":
      default:
        rowStr = processTemplatePlaceholders(
          template.rowTemplate,
          headers,
          row,
          template,
        );
        break;
    }

    processedRows.push(rowStr);
  }

  return (
    template.headerTemplate +
    processedRows.join(template.rowSeparator) +
    template.footerTemplate
  );
}

// ============================================================================
// Pipeline Execution
// ============================================================================

/**
 * Execute a complete transformation pipeline: parse -> transform -> serialize.
 *
 * @param content - Raw file content
 * @param config - Pipeline configuration
 * @returns Serialized output string
 *
 * @example
 * ```ts
 * const output = executePipeline(rawCsv, {
 *     parseOptions: { delimiter: "," },
 *     transforms: [
 *         removeEmptyRows(),
 *         selectColumns(["Name", "Dialogue"]),
 *         transformColumn("Name", "uppercase"),
 *     ],
 *     serializeOptions: { delimiter: "\t" },
 * });
 * ```
 */
export function executePipeline(
  content: string,
  config: PipelineConfig,
): string {
  // Parse
  const parseResult = parse(content, config.parseOptions);
  if (parseResult.warnings.length > 0) {
    logger.debug("Parse warnings:", parseResult.warnings);
  }

  // Transform
  let data = parseResult.data;
  if (config.transforms) {
    for (const step of config.transforms) {
      logger.debug(`Pipeline step: ${step.name}`);
      data = step.execute(data);
    }
  }

  // Serialize
  return serializeToCsv(data, {
    delimiter: config.serializeOptions?.delimiter ?? parseResult.delimiter,
    ...config.serializeOptions,
  });
}

/**
 * Execute a transformation pipeline with template-based serialization.
 *
 * @param content - Raw file content
 * @param template - Export template
 * @param parseOptions - Parse options
 * @param transforms - Transform steps to apply before serialization
 * @returns Serialized output string
 */
export function executePipelineWithTemplate(
  content: string,
  template: ExportTemplate,
  parseOptions?: ParseOptions,
  transforms?: TransformStep[],
): string {
  // Parse
  const parseResult = parse(content, parseOptions);

  // Transform
  let data = parseResult.data;
  if (transforms) {
    for (const step of transforms) {
      data = step.execute(data);
    }
  }

  // Serialize with template
  return serializeWithTemplate(data, template);
}

/**
 * Apply a sequence of transforms to existing CellData (no parse/serialize).
 * Useful when data is already loaded in a store.
 *
 * @param data - Input CellData
 * @param transforms - Transform steps to apply
 * @returns Transformed CellData
 */
export function applyTransforms(
  data: CellData,
  transforms: TransformStep[],
): CellData {
  let result = data;
  for (const step of transforms) {
    result = step.execute(result);
  }
  return result;
}

// ============================================================================
// Internal Helpers
// ============================================================================

/**
 * Apply a value transform function to a string.
 */
function applyValueTransform(
  value: string,
  transform: TransformFunction,
): string {
  switch (transform) {
    case "uppercase":
      return value.toUpperCase();
    case "lowercase":
      return value.toLowerCase();
    case "trim":
      return value.trim();
    case "parseNumber": {
      const num = Number(value);
      return isNaN(num) ? "0" : String(num);
    }
    case "parseBoolean":
      return ["true", "1", "yes", "on"].includes(value.toLowerCase())
        ? "true"
        : "false";
    case "escapeHtml":
      return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    case "escapeJson":
      return value
        .replace(/\\/g, "\\\\")
        .replace(/"/g, '\\"')
        .replace(/\n/g, "\\n")
        .replace(/\r/g, "\\r")
        .replace(/\t/g, "\\t");
    default:
      return value;
  }
}

/**
 * Generate a JSON object string for a single row.
 */
function generateJsonObject(
  headers: string[],
  row: string[],
  template: ExportTemplate,
  indent: string,
): string {
  const fields: Record<string, string> = {};

  if (template.fieldMappings.length > 0) {
    for (const mapping of template.fieldMappings) {
      const colIdx = headers.indexOf(mapping.csvColumn);
      let value = colIdx >= 0 ? row[colIdx] || "" : mapping.defaultValue || "";
      value = applyValueTransform(value, mapping.transform || "trim");
      if (mapping.transform) {
        value = applyValueTransform(value, mapping.transform);
      } else {
        // No double-transform: just use raw value
        value = colIdx >= 0 ? row[colIdx] || "" : mapping.defaultValue || "";
      }
      if (!template.options.includeEmpty && !value) continue;
      fields[mapping.exportField] = value;
    }
  } else {
    for (let i = 0; i < headers.length; i++) {
      const value = row[i] || "";
      if (!template.options.includeEmpty && !value) continue;
      fields[headers[i]] = value;
    }
  }

  const entries = Object.entries(fields).map(([key, val]) => {
    const num = Number(val);
    if (val !== "" && !isNaN(num) && val.trim() === String(num)) {
      return `${indent}"${key}": ${num}`;
    }
    if (val === "true" || val === "false") {
      return `${indent}"${key}": ${val}`;
    }
    const escaped = val
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/\n/g, "\\n");
    return `${indent}"${key}": "${escaped}"`;
  });

  if (template.options.prettyPrint) {
    return `{\n${entries.join(",\n")}\n${indent.slice(0, -2) || ""}}`.replace(
      /\n\n/g,
      "\n",
    );
  }
  return `{${entries.join(", ")}}`;
}

/**
 * Generate YAML fields for a single row.
 */
function generateYamlFields(
  headers: string[],
  row: string[],
  template: ExportTemplate,
): string {
  const lines: string[] = [];
  const mappings =
    template.fieldMappings.length > 0 ? template.fieldMappings : null;

  if (mappings) {
    for (const mapping of mappings) {
      const colIdx = headers.indexOf(mapping.csvColumn);
      let value = colIdx >= 0 ? row[colIdx] || "" : mapping.defaultValue || "";
      if (mapping.transform) {
        value = applyValueTransform(value, mapping.transform);
      }
      if (!template.options.includeEmpty && !value) continue;
      lines.push(`  ${mapping.exportField}: "${value}"`);
    }
  } else {
    for (let i = 0; i < headers.length; i++) {
      const value = row[i] || "";
      if (!template.options.includeEmpty && !value) continue;
      const key = headers[i].replace(/[^a-zA-Z0-9_]/g, "_");
      lines.push(`  ${key}: "${value}"`);
    }
  }

  return lines.join("\n");
}

/**
 * Generate XML fields for a single row.
 */
function generateXmlFields(
  headers: string[],
  row: string[],
  template: ExportTemplate,
): string {
  const lines: string[] = [];
  const mappings =
    template.fieldMappings.length > 0 ? template.fieldMappings : null;

  if (mappings) {
    for (const mapping of mappings) {
      const colIdx = headers.indexOf(mapping.csvColumn);
      let value = colIdx >= 0 ? row[colIdx] || "" : mapping.defaultValue || "";
      if (mapping.transform) {
        value = applyValueTransform(value, mapping.transform);
      }
      if (!template.options.includeEmpty && !value) continue;
      const escapedValue = value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      lines.push(
        `    <${mapping.exportField}>${escapedValue}</${mapping.exportField}>`,
      );
    }
  } else {
    for (let i = 0; i < headers.length; i++) {
      const value = row[i] || "";
      if (!template.options.includeEmpty && !value) continue;
      const tag = headers[i].replace(/[^a-zA-Z0-9_]/g, "_");
      const escapedValue = value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      lines.push(`    <${tag}>${escapedValue}</${tag}>`);
    }
  }

  return lines.join("\n");
}

/**
 * Process a template string by replacing all placeholders.
 * Supports {columnName}, {N} (0-indexed column), and composite placeholders.
 */
function processTemplatePlaceholders(
  rowTemplate: string,
  headers: string[],
  row: string[],
  template: ExportTemplate,
): string {
  let result = rowTemplate;

  // Replace {N} numeric placeholders
  for (let i = 0; i < row.length; i++) {
    result = result.replace(new RegExp(`\\{${i}\\}`, "g"), row[i] || "");
  }

  // Replace {columnName} placeholders
  for (let i = 0; i < headers.length; i++) {
    const value = row[i] || "";
    result = result.replace(
      new RegExp(
        `\\{${headers[i].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\}`,
        "g",
      ),
      value,
    );
  }

  // Replace composite placeholders
  if (result.includes("{row_json}")) {
    const indent = "    ";
    result = result.replace(
      "{row_json}",
      generateJsonObject(headers, row, template, indent),
    );
  }
  if (result.includes("{row_fields_yaml}")) {
    result = result.replace(
      "{row_fields_yaml}",
      "\n" + generateYamlFields(headers, row, template),
    );
  }
  if (result.includes("{row_fields_xml}")) {
    result = result.replace(
      "{row_fields_xml}",
      generateXmlFields(headers, row, template),
    );
  }
  if (result.includes("{row_fields}")) {
    const fields = headers.map((h, i) => {
      const val = row[i] || "";
      const escaped = val.replace(/"/g, '\\"');
      return `"${h}": "${escaped}"`;
    });
    result = result.replace("{row_fields}", fields.join(", "));
  }
  if (result.includes("{row_fields_godot}")) {
    const fields = headers.map((h, i) => {
      const key = h.replace(/[^a-zA-Z0-9_]/g, "_");
      return `${key} = "${row[i] || ""}"`;
    });
    result = result.replace("{row_fields_godot}", fields.join("\n"));
  }

  return result;
}
