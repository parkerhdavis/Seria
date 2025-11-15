/**
 * Web Worker for CSV/TSV Parsing
 *
 * Offloads CSV parsing to a background thread to prevent UI freezing
 * during large file loads. Supports chunked parsing with progress updates.
 */

import Papa from "papaparse";

/**
 * Message types sent from main thread to worker
 */
interface ParseRequest {
    type: "parse";
    fileContent: string;
    chunkSize?: number;
}

interface CancelRequest {
    type: "cancel";
}

type WorkerRequest = ParseRequest | CancelRequest;

/**
 * Message types sent from worker to main thread
 */
interface MetadataMessage {
    type: "metadata";
    headers: string[];
    estimatedRows: number;
}

interface ChunkMessage {
    type: "chunk";
    data: string[][];
    progress: number; // 0-100
}

interface CompleteMessage {
    type: "complete";
}

interface ErrorMessage {
    type: "error";
    message: string;
}

type WorkerResponse = MetadataMessage | ChunkMessage | CompleteMessage | ErrorMessage;

// Global state for cancellation
let shouldCancel = false;
let currentParser: Papa.Parser | null = null;

/**
 * Handle incoming messages from main thread
 */
self.addEventListener("message", (e: MessageEvent<WorkerRequest>) => {
    const message = e.data;

    if (message.type === "cancel") {
        shouldCancel = true;
        if (currentParser) {
            currentParser.abort();
            currentParser = null;
        }
        return;
    }

    if (message.type === "parse") {
        shouldCancel = false;
        parseCSVInChunks(message.fileContent, message.chunkSize || 1000);
    }
});

/**
 * Parse CSV/TSV file in chunks with progress reporting
 */
function parseCSVInChunks(fileContent: string, chunkSize: number) {
    try {
        // Phase 1: Quick metadata extraction (first row only)
        const metadataResult = Papa.parse(fileContent, {
            header: false,
            preview: 1,
            skipEmptyLines: true,
            delimitersToGuess: [",", "\t", "|", ";"],
        });

        if (metadataResult.errors.length > 0) {
            postError(`Parse error: ${metadataResult.errors[0].message}`);
            return;
        }

        const headers = metadataResult.data[0] as string[];

        // Estimate row count (rough approximation)
        const avgLineLength = fileContent.length / (fileContent.split("\n").length || 1);
        const estimatedRows = Math.floor(fileContent.length / avgLineLength) - 1; // -1 for header

        // Send metadata immediately
        const metadataMsg: MetadataMessage = {
            type: "metadata",
            headers: headers,
            estimatedRows: Math.max(0, estimatedRows),
        };
        self.postMessage(metadataMsg);

        // Phase 2: Parse full file in chunks
        let processedRows = 0;
        const totalBytes = fileContent.length;
        let processedBytes = 0;

        Papa.parse(fileContent, {
            header: false,
            skipEmptyLines: true,
            delimitersToGuess: [",", "\t", "|", ";"],
            chunk: (results: Papa.ParseResult<string[]>, parser: Papa.Parser) => {
                // Store parser reference for potential cancellation
                currentParser = parser;

                if (shouldCancel) {
                    parser.abort();
                    currentParser = null;
                    return;
                }

                // Remove header row from first chunk
                let chunkData = results.data;
                if (processedRows === 0 && chunkData.length > 0) {
                    chunkData = chunkData.slice(1); // Skip header
                }

                processedRows += chunkData.length;

                // Estimate progress based on bytes processed
                // This is approximate but gives good user feedback
                processedBytes += new Blob([JSON.stringify(results.data)]).size;
                const progress = Math.min(99, Math.floor((processedBytes / totalBytes) * 100));

                // Send chunk to main thread
                const chunkMsg: ChunkMessage = {
                    type: "chunk",
                    data: chunkData,
                    progress: progress,
                };
                self.postMessage(chunkMsg);

                // Pause parsing briefly to allow UI to remain responsive
                // Using a small delay prevents blocking the event loop
                if (processedRows % (chunkSize * 3) === 0) {
                    parser.pause();
                    setTimeout(() => {
                        if (!shouldCancel) {
                            parser.resume();
                        }
                    }, 10);
                }
            },
            complete: () => {
                currentParser = null;
                if (!shouldCancel) {
                    const completeMsg: CompleteMessage = {
                        type: "complete",
                    };
                    self.postMessage(completeMsg);
                }
            },
            error: (error: Error) => {
                currentParser = null;
                postError(error.message);
            },
        });
    } catch (error) {
        postError(error instanceof Error ? error.message : String(error));
    }
}

/**
 * Helper to send error messages
 */
function postError(message: string) {
    const errorMsg: ErrorMessage = {
        type: "error",
        message: message,
    };
    self.postMessage(errorMsg);
}

// Export types for use in main thread (TypeScript only, not runtime)
export type {
    WorkerRequest,
    WorkerResponse,
    MetadataMessage,
    ChunkMessage,
    CompleteMessage,
    ErrorMessage,
};
