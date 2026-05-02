// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Shared Worker Message Types
 *
 * Defines consistent message protocols for Web Workers across the application.
 * All workers should use these base types and extend them for specific needs.
 */

import type { PrintRecipe, RecipeConfiguration } from "./printRecipe";

// ============================================================================
// Base Message Types
// ============================================================================

/**
 * Base interface for all worker request messages.
 * Each worker defines its own specific request types that include a `type` discriminator.
 */
export interface BaseWorkerRequest {
    type: string;
}

/**
 * Base interface for all worker response messages.
 * Uses discriminated unions with `type` field for type-safe message handling.
 */
export interface BaseWorkerResponse {
    type: string;
}

/**
 * Standard error response used by all workers.
 */
export interface WorkerErrorResponse extends BaseWorkerResponse {
    type: "error";
    message: string;
}

// ============================================================================
// Print Worker Types (Screenplay, Card, etc.)
// ============================================================================

/**
 * Common fields for print calculation requests.
 * Used by ScreenplayPrint and CardPrint workers.
 */
export interface BasePrintCalculateRequest extends BaseWorkerRequest {
    type: "calculate";
    data: string[][];
    headers: string[];
    configuration: RecipeConfiguration;
    editingCell: { row: number; col: number } | null;
    editingValue: string;
}

/**
 * Screenplay-specific calculation request.
 */
export interface ScreenplayCalculateRequest extends BasePrintCalculateRequest {
    recipe: PrintRecipe;
    continuous: boolean;
}

/**
 * Card-specific calculation request.
 * Uses the base fields without additional properties.
 */
export type CardCalculateRequest = BasePrintCalculateRequest;

/**
 * Screenplay element type.
 */
export type ScreenplayElementType =
    | "scene_heading"
    | "action"
    | "character"
    | "dialogue"
    | "parenthetical"
    | "transition";

/**
 * A single screenplay element.
 */
export interface ScreenplayElement {
    type: ScreenplayElementType;
    content: string;
    rowIndex: number;
    columnName: string;
    sceneNumber?: number;
    splitIndex?: number;
}

/**
 * A page containing screenplay elements.
 */
export interface PageWithElements {
    elements: ScreenplayElement[];
    pageNumber: number;
}

/**
 * Screenplay calculation result.
 */
export interface ScreenplayCalculateResponse extends BaseWorkerResponse {
    type: "result";
    elements: ScreenplayElement[];
    pages: PageWithElements[];
}

/**
 * Card data structure.
 */
export interface CardData {
    index: number;
    title: string;
    subtitle: string;
    content: string[];
    titleColumnName?: string;
    subtitleColumnName?: string;
    contentColumnNames: string[];
}

/**
 * Card calculation result.
 */
export interface CardCalculateResponse extends BaseWorkerResponse {
    type: "result";
    cards: CardData[];
}

// ============================================================================
// Parser Worker Types
// ============================================================================

/**
 * Request to parse CSV/TSV content.
 */
export interface ParseRequest extends BaseWorkerRequest {
    type: "parse";
    fileContent: string;
    chunkSize?: number;
}

/**
 * Request to cancel ongoing parsing.
 */
export interface CancelRequest extends BaseWorkerRequest {
    type: "cancel";
}

/**
 * Parser worker request union type.
 */
export type ParserWorkerRequest = ParseRequest | CancelRequest;

/**
 * Metadata about the parsed file (sent early in parsing).
 */
export interface ParserMetadataResponse extends BaseWorkerResponse {
    type: "metadata";
    headers: string[];
    estimatedRows: number;
}

/**
 * A chunk of parsed data with progress info.
 */
export interface ParserChunkResponse extends BaseWorkerResponse {
    type: "chunk";
    data: string[][];
    progress: number; // 0-100
}

/**
 * Indicates parsing is complete.
 */
export interface ParserCompleteResponse extends BaseWorkerResponse {
    type: "complete";
}

/**
 * Parser worker response union type.
 */
export type ParserWorkerResponse =
    | ParserMetadataResponse
    | ParserChunkResponse
    | ParserCompleteResponse
    | WorkerErrorResponse;

// ============================================================================
// Union Types for Each Worker
// ============================================================================

/**
 * All possible screenplay worker responses.
 */
export type ScreenplayWorkerResponse = ScreenplayCalculateResponse | WorkerErrorResponse;

/**
 * All possible card worker responses.
 */
export type CardWorkerResponse = CardCalculateResponse | WorkerErrorResponse;

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for error responses.
 */
export function isWorkerError(response: BaseWorkerResponse): response is WorkerErrorResponse {
    return response.type === "error";
}

/**
 * Type guard for screenplay result responses.
 */
export function isScreenplayResult(
    response: ScreenplayWorkerResponse
): response is ScreenplayCalculateResponse {
    return response.type === "result";
}

/**
 * Type guard for card result responses.
 */
export function isCardResult(response: CardWorkerResponse): response is CardCalculateResponse {
    return response.type === "result";
}

/**
 * Type guard for parser metadata responses.
 */
export function isParserMetadata(
    response: ParserWorkerResponse
): response is ParserMetadataResponse {
    return response.type === "metadata";
}

/**
 * Type guard for parser chunk responses.
 */
export function isParserChunk(response: ParserWorkerResponse): response is ParserChunkResponse {
    return response.type === "chunk";
}

/**
 * Type guard for parser complete responses.
 */
export function isParserComplete(
    response: ParserWorkerResponse
): response is ParserCompleteResponse {
    return response.type === "complete";
}
