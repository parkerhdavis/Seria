/**
 * Dialog wrappers.
 *
 * Thin RPC surface around Utils.openFileDialog so the renderer never has to
 * know about Electrobun's native dialog API — it just calls pickFile /
 * pickDirectory / pickSaveFile and gets back a string-or-null the same way
 * Tauri's @tauri-apps/plugin-dialog used to hand one over.
 *
 * Two rough edges from the spike that this module papers over:
 *
 *   - openFileDialog returns a comma-joined string split into `[""]` when
 *     the user cancels. Collapse that to `null` before it reaches the view.
 *   - The default startingFolder is process.cwd(), which under Electrobun
 *     is the bundle's `bin/` directory — never what the user wants. Fall
 *     back to ~/Documents (pickers on cell files) or ~ (everything else).
 *
 * Electrobun doesn't expose a native save-as dialog in 1.16, so pickSaveFile
 * picks a directory and joins it with the caller-supplied `defaultFilename`.
 * A richer save modal can be built in-renderer later.
 */

import { Utils } from "electrobun/bun";
import { join } from "node:path";
import type { DialogFilter } from "../shared/rpc";

function filtersToAllowedTypes(filters: DialogFilter[] | undefined): string {
	if (!filters || filters.length === 0) return "*";
	const exts = new Set<string>();
	for (const f of filters) {
		for (const ext of f.extensions) {
			if (!ext || ext === "*") return "*";
			exts.add(ext.replace(/^\./, ""));
		}
	}
	return Array.from(exts).join(",");
}

function firstRealPath(paths: string[]): string | null {
	const first = paths[0];
	if (!first) return null;
	return first;
}

export async function pickFile({
	filters,
	startingFolder,
}: {
	title?: string;
	filters?: DialogFilter[];
	startingFolder?: string;
}): Promise<string | null> {
	const paths = await Utils.openFileDialog({
		startingFolder: startingFolder ?? Utils.paths.documents,
		allowedFileTypes: filtersToAllowedTypes(filters),
		canChooseFiles: true,
		canChooseDirectory: false,
		allowsMultipleSelection: false,
	});
	return firstRealPath(paths);
}

export async function pickDirectory({
	startingFolder,
}: {
	title?: string;
	startingFolder?: string;
}): Promise<string | null> {
	const paths = await Utils.openFileDialog({
		startingFolder: startingFolder ?? Utils.paths.home,
		allowedFileTypes: "*",
		canChooseFiles: false,
		canChooseDirectory: true,
		allowsMultipleSelection: false,
	});
	return firstRealPath(paths);
}

export async function pickSaveFile({
	filters,
	defaultPath,
	startingFolder,
}: {
	title?: string;
	filters?: DialogFilter[];
	// In the Tauri plugin-dialog, `defaultPath` accepted a full path or just a
	// filename. Here it's used as the trailing filename segment only.
	defaultPath?: string;
	startingFolder?: string;
}): Promise<string | null> {
	const paths = await Utils.openFileDialog({
		startingFolder: startingFolder ?? Utils.paths.documents,
		allowedFileTypes: filtersToAllowedTypes(filters),
		canChooseFiles: false,
		canChooseDirectory: true,
		allowsMultipleSelection: false,
	});
	const dir = firstRealPath(paths);
	if (!dir) return null;
	const filename = defaultPath ?? "untitled";
	// If defaultPath was already absolute, respect the user's directory pick
	// but keep just the basename from defaultPath.
	const leaf = filename.replace(/^.*[\\/]/, "") || "untitled";
	return join(dir, leaf);
}
