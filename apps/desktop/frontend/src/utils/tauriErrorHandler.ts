/**
 * Centralized Tauri Error Handler
 *
 * Provides consistent error handling for Tauri API calls.
 * Wraps invoke calls with proper error handling and type safety.
 */

import { invoke } from "@tauri-apps/api/core";
import { logger } from "./logger";

/**
 * Result type for Tauri operations
 */
export type TauriResult<T> =
    | { success: true; data: T }
    | { success: false; error: string };

/**
 * Format an unknown error into a user-friendly message
 */
export function formatError(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    if (typeof error === "string") {
        return error;
    }
    return "An unknown error occurred";
}

/**
 * Safely invoke a Tauri command with error handling
 *
 * @param cmd - The Tauri command name
 * @param args - Optional arguments for the command
 * @returns Promise with success/error result
 *
 * @example
 * const result = await invokeSafe<string>("open_cell_file", { path: "/path/to/file" });
 * if (result.success) {
 *     console.log("File content:", result.data);
 * } else {
 *     console.error("Failed:", result.error);
 * }
 */
export async function invokeSafe<T>(
    cmd: string,
    args?: Record<string, unknown>
): Promise<TauriResult<T>> {
    try {
        const result = await invoke<T>(cmd, args);
        return { success: true, data: result };
    } catch (error: unknown) {
        const message = formatError(error);
        logger.error(`Tauri command "${cmd}" failed:`, message);
        return { success: false, error: message };
    }
}

/**
 * Invoke a Tauri command and throw on error (for use in try/catch blocks)
 *
 * @param cmd - The Tauri command name
 * @param args - Optional arguments for the command
 * @returns Promise with the result data
 * @throws Error if the command fails
 *
 * @example
 * try {
 *     const content = await invokeOrThrow<string>("open_cell_file", { path });
 * } catch (error) {
 *     handleError(error);
 * }
 */
export async function invokeOrThrow<T>(
    cmd: string,
    args?: Record<string, unknown>
): Promise<T> {
    try {
        return await invoke<T>(cmd, args);
    } catch (error: unknown) {
        const message = formatError(error);
        logger.error(`Tauri command "${cmd}" failed:`, message);
        throw new Error(message);
    }
}

/**
 * Type guard to check if an error has a specific message
 */
export function isErrorWithMessage(
    error: unknown,
    message: string
): error is Error {
    return error instanceof Error && error.message === message;
}
