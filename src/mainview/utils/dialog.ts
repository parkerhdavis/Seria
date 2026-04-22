/**
 * Drop-in replacements for the bits of @tauri-apps/plugin-dialog Seria
 * actually used: `open` (file or directory picker) and `save` (save-as
 * location). Under the hood they go through the typed RPC to the Bun
 * side, which calls Utils.openFileDialog.
 *
 * The signatures are kept compatible with the plugin-dialog API so
 * call sites keep working after a single import-path change.
 */

import { rpcCall } from "./rpc";
import type { DialogFilter } from "../../shared/rpc";

export type OpenDialogOptions = {
	title?: string;
	filters?: DialogFilter[];
	directory?: boolean;
	multiple?: boolean;
	defaultPath?: string;
	// Electrobun's openFileDialog uses startingFolder; plugin-dialog never
	// exposed one explicitly — defaultPath was used both as filename hint
	// and directory hint. Accept it here for parity.
};

export async function open(
	opts: OpenDialogOptions = {},
): Promise<string | null> {
	if (opts.directory) {
		return rpcCall.pickDirectory({
			title: opts.title,
			startingFolder: opts.defaultPath,
		});
	}
	return rpcCall.pickFile({
		title: opts.title,
		filters: opts.filters,
		startingFolder: opts.defaultPath,
	});
}

export type SaveDialogOptions = {
	title?: string;
	filters?: DialogFilter[];
	defaultPath?: string;
};

export async function save(
	opts: SaveDialogOptions = {},
): Promise<string | null> {
	return rpcCall.pickSaveFile({
		title: opts.title,
		filters: opts.filters,
		defaultPath: opts.defaultPath,
	});
}
