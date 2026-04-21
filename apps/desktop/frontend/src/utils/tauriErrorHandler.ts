/**
 * Error-formatting helpers. The file name dates back to the Tauri era;
 * nothing about the contents is Tauri-specific any more (the old
 * invoke-wrapping helpers were unused). Kept under the same filename so
 * the 12 existing imports don't have to change on the port.
 */

/**
 * Result shape for back-end operations.
 */
export type TauriResult<T> =
	| { success: true; data: T }
	| { success: false; error: string };

/**
 * Format an unknown error into a user-friendly message.
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
 * Type guard to check if an error has a specific message.
 */
export function isErrorWithMessage(
	error: unknown,
	message: string,
): error is Error {
	return error instanceof Error && error.message === message;
}
