/**
 * Web Worker for CardPrint calculations
 *
 * Offloads expensive card data calculations to background thread
 * to keep UI responsive with large files (20k+ rows).
 */

import type {
    CardCalculateRequest,
    CardCalculateResponse,
    CardData,
    WorkerErrorResponse,
} from "@/types/workerMessages";
import { getMappedColumn, getMappedColumns } from "./mappingUtils";

// Use shared types from workerMessages.ts
type CalculateRequest = CardCalculateRequest;
type CalculateResponse = CardCalculateResponse;
type ErrorResponse = WorkerErrorResponse;

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
        } catch (error: unknown) {
            const errorResponse: ErrorResponse = {
                type: "error",
                message: error instanceof Error ? error.message : "Unknown error",
            };
            self.postMessage(errorResponse);
        }
    }
});
