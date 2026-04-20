/**
 * Seria main process (Bun runtime under Electrobun).
 *
 * Creates the application window and wires every RPC handler — file I/O,
 * storage, converters (Step 4 + 5), native dialogs, clipboard, generic
 * filesystem — into the typed channel the mainview reaches back through.
 */

import { BrowserView, BrowserWindow } from "electrobun/bun";
import type { SeriaRPC } from "../shared/rpc";
import {
	openCellFile,
	saveCellFile,
	createTempFile,
	getFileIdentifiers,
} from "./file_ops";
import {
	loadPreferences,
	savePreferences,
	loadCustomPrints,
	saveCustomPrint,
	deleteCustomPrint,
	loadFileConfigs,
	saveFileConfigs,
	loadWorkspaceLayouts,
	saveWorkspaceLayouts,
} from "./storage";
import { pickFile, pickDirectory, pickSaveFile } from "./dialog";
import { readClipboard, writeClipboard } from "./clipboard";
import {
	readTextFile,
	writeTextFile,
	writeBinaryFile,
	listDirectory,
} from "./fs_ops";
import {
	convertScreenplayToCsv,
	convertCsvToScreenplay,
} from "./converters/screenplay";
// Step 5 will land compareCsvFiles. Until then, a sentinel throw keeps
// the RPC table shape correct without masking that it's unimplemented.
function notImplemented(name: string): () => never {
	return () => {
		throw new Error(`${name} is not yet implemented (port in progress)`);
	};
}

// 10s is too aggressive on Linux — the GTK file dialog blocks the event loop
// while open, so RPC responses queue up behind it. 60s keeps every dialog
// wrapper working regardless of how long the user spends picking.
const RPC_MAX_REQUEST_TIME = 60_000;

const rpc = BrowserView.defineRPC<SeriaRPC>({
	maxRequestTime: RPC_MAX_REQUEST_TIME,
	handlers: {
		requests: {
			openCellFile,
			saveCellFile,
			createTempFile,
			getFileIdentifiers,

			loadPreferences,
			savePreferences,
			loadCustomPrints,
			saveCustomPrint,
			deleteCustomPrint,
			loadFileConfigs,
			saveFileConfigs,
			loadWorkspaceLayouts,
			saveWorkspaceLayouts,

			convertScreenplayToCsv,
			convertCsvToScreenplay,
			compareCsvFiles: notImplemented("compareCsvFiles"),

			pickFile,
			pickDirectory,
			pickSaveFile,

			readClipboard,
			writeClipboard,

			readTextFile,
			writeTextFile,
			writeBinaryFile,
			listDirectory,
		},
		messages: {
			viewLog: ({ level, msg }) => {
				const line = `[view:${level}] ${msg}`;
				if (level === "error") console.error(line);
				else if (level === "warn") console.warn(line);
				else console.log(line);
			},
		},
	},
});

const win = new BrowserWindow({
	title: "Seria",
	url: "views://mainview/index.html",
	frame: { width: 1400, height: 900, x: 200, y: 200 },
	rpc,
});

if (process.env.ELECTROBUN_DEV) {
	win.webview.openDevTools();
}
