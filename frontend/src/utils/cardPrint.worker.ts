/**
 * Web Worker for CardPrint calculations
 *
 * Offloads expensive card data calculations to background thread
 * to keep UI responsive with large files (20k+ rows).
 */

import type { RecipeConfiguration } from "@/types/printRecipe";

interface CardData {
    index: number;
    title: string;
    subtitle: string;
    content: string[];
    titleColumnName?: string;
    subtitleColumnName?: string;
    contentColumnNames: string[];
}

interface CalculateRequest {
    type: "calculate";
    data: string[][];
    headers: string[];
    configuration: RecipeConfiguration;
    editingCell: { row: number; col: number } | null;
    editingValue: string;
}

interface CalculateResponse {
    type: "result";
    cards: CardData[];
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
        return mapping?.cellColumn;
    }
    // Fallback for object structure (if it exists)
    const mapping = (fieldMappings as any)[fieldName];
    return mapping?.csvColumn;
}

/**
 * Get mapped column names (for multi-value fields)
 * For arrays like content fields, cellColumn might be an array
 */
function getMappedColumns(fieldMappings: RecipeConfiguration["fieldMappings"], fieldName: string): string[] {
    if (Array.isArray(fieldMappings)) {
        const mapping = fieldMappings.find((m: any) => m.ingredientId === fieldName);
        if (!mapping) return [];
        if (Array.isArray(mapping.cellColumn)) {
            return mapping.cellColumn;
        }
        return mapping.cellColumn ? [mapping.cellColumn] : [];
    }
    // Fallback for object structure
    const mapping = (fieldMappings as any)[fieldName];
    if (!mapping) return [];
    if (Array.isArray(mapping.csvColumn)) {
        return mapping.csvColumn;
    }
    return mapping.csvColumn ? [mapping.csvColumn] : [];
}

self.addEventListener("message", (e: MessageEvent<CalculateRequest>) => {
    const message = e.data;

    if (message.type === "calculate") {
        try {
            const { data, headers, configuration, editingCell, editingValue } = message;

            // Get field mappings
            const titleColumn = getMappedColumn(configuration.fieldMappings, "title");
            const subtitleColumn = getMappedColumn(configuration.fieldMappings, "subtitle");
            const contentColumns = getMappedColumns(configuration.fieldMappings, "content");

            // Helper to get cell value
            const getCellValue = (rowIndex: number, colIndex: number): string => {
                if (editingCell && editingCell.row === rowIndex && editingCell.col === colIndex) {
                    return editingValue;
                }
                return data[rowIndex]?.[colIndex] || "";
            };

            // Build cards array
            const cards: CardData[] = data.map((row, index) => {
                const titleIdx = titleColumn ? headers.indexOf(titleColumn) : -1;
                const subtitleIdx = subtitleColumn ? headers.indexOf(subtitleColumn) : -1;
                const contentIndices = contentColumns
                    .map(col => headers.indexOf(col))
                    .filter(idx => idx >= 0);

                return {
                    index,
                    title: titleIdx >= 0 ? getCellValue(index, titleIdx) : "",
                    subtitle: subtitleIdx >= 0 ? getCellValue(index, subtitleIdx) : "",
                    content: contentIndices.map(idx => getCellValue(index, idx)).filter(text => text && text.trim()),
                    titleColumnName: titleColumn ?? undefined,
                    subtitleColumnName: subtitleColumn ?? undefined,
                    contentColumnNames: contentColumns,
                };
            });

            // Send result back
            const response: CalculateResponse = {
                type: "result",
                cards,
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
