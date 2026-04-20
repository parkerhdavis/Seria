/**
 * Typed RPC schema shared between the Bun main process and the mainview.
 *
 * Both sides import this module and get end-to-end type safety on requests
 * and messages. Collapses Tauri's stringly-typed `invoke()` plus the
 * `@tauri-apps/plugin-*` API surface into one schema:
 *
 *   - The 16 Seria commands that used to live in the Rust backend
 *   - Dialog, clipboard, filesystem, and directory-listing wrappers that
 *     used to come from Tauri plugins (so the renderer never has to know
 *     about Electrobun's `Utils.*` API directly)
 */

import type { RPCSchema } from "electrobun/bun";

export type FileIdentifiers = {
	absolutePath: string;
	filename: string;
	parentDir: string;
	fileSize: number;
	contentHashPartial: string | null;
	osFileId: string | null;
};

export type DiffResult = {
	addedRows: number[];
	deletedRows: number[];
	modifiedCells: Array<{ row: number; col: number; old: string; new: string }>;
	columnChanges: { added: number[]; deleted: number[] };
	headers: { old: string[]; new: string[] };
	oldGrid: string[][];
	newGrid: string[][];
	rowCounts: { old: number; new: number };
};

export type DialogFilter = {
	name: string;
	extensions: string[];
};

export type DirectoryEntry = {
	name: string;
	isDirectory: boolean;
};

export type SeriaRPC = {
	bun: RPCSchema<{
		requests: {
			// ── Cell file I/O ────────────────────────────────────────────
			openCellFile: { params: { path: string }; response: string };
			saveCellFile: { params: { path: string; content: string }; response: void };
			createTempFile: { params: Record<string, never>; response: string };
			getFileIdentifiers: { params: { path: string }; response: FileIdentifiers };

			// ── Preferences ──────────────────────────────────────────────
			loadPreferences: { params: Record<string, never>; response: string };
			savePreferences: { params: { data: string }; response: void };

			// ── Custom print templates ───────────────────────────────────
			loadCustomPrints: { params: Record<string, never>; response: string[] };
			saveCustomPrint: { params: { name: string; data: string }; response: void };
			deleteCustomPrint: { params: { name: string }; response: void };

			// ── Per-file configs ─────────────────────────────────────────
			loadFileConfigs: { params: Record<string, never>; response: string };
			saveFileConfigs: { params: { data: string }; response: void };

			// ── Workspace layouts ────────────────────────────────────────
			loadWorkspaceLayouts: { params: Record<string, never>; response: string };
			saveWorkspaceLayouts: { params: { layoutsJson: string }; response: void };

			// ── Screenplay ↔ CSV converter ───────────────────────────────
			convertScreenplayToCsv: { params: { content: string }; response: string };
			convertCsvToScreenplay: { params: { csvContent: string }; response: string };

			// ── CSV diff ─────────────────────────────────────────────────
			compareCsvFiles: {
				params: { oldContent: string; newContent: string };
				response: DiffResult;
			};

			// ── Native dialogs (wrappers around Utils.openFileDialog) ────
			pickFile: {
				params: {
					title?: string;
					filters?: DialogFilter[];
					startingFolder?: string;
				};
				response: string | null;
			};
			pickDirectory: {
				params: {
					title?: string;
					startingFolder?: string;
				};
				response: string | null;
			};
			pickSaveFile: {
				params: {
					title?: string;
					filters?: DialogFilter[];
					defaultPath?: string;
					startingFolder?: string;
				};
				response: string | null;
			};

			// ── Clipboard (wrappers around Utils.clipboard*) ─────────────
			readClipboard: { params: Record<string, never>; response: string };
			writeClipboard: { params: { text: string }; response: void };

			// ── Generic filesystem (wrappers for the former plugin-fs) ───
			readTextFile: { params: { path: string }; response: string };
			writeTextFile: { params: { path: string; content: string }; response: void };
			// Binary content is transferred as base64 — the RPC channel is JSON.
			writeBinaryFile: { params: { path: string; dataBase64: string }; response: void };
			listDirectory: { params: { path: string }; response: DirectoryEntry[] };
		};
		messages: {
			viewLog: { level: "info" | "warn" | "error"; msg: string };
		};
	}>;
	webview: RPCSchema<{
		requests: Record<string, never>;
		messages: Record<string, never>;
	}>;
};
