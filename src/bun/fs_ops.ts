/**
 * Generic filesystem RPC handlers — the renderer-side replacement for
 * @tauri-apps/plugin-fs's readTextFile, writeTextFile, writeFile, readDir.
 *
 * openCellFile / saveCellFile already cover cell-file I/O; these exist for
 * the renderer code that reads/writes *other* files (e.g., config JSON
 * export/import, PDF export binary payloads, directory listing for the
 * file tree).
 *
 * The binary variant takes base64 because the RPC channel is JSON — the
 * caller encodes a Uint8Array on the view side before invoking.
 */

import { promises as fs } from "node:fs";
import { isAbsolute } from "node:path";
import type { DirectoryEntry } from "../shared/rpc";

function assertAbsolute(path: string): void {
	if (!isAbsolute(path)) {
		throw new Error("Only absolute file paths are allowed");
	}
	if (path.includes("\0")) {
		throw new Error("Invalid path: null bytes are not allowed");
	}
}

export async function readTextFile({ path }: { path: string }): Promise<string> {
	assertAbsolute(path);
	return fs.readFile(path, "utf-8");
}

export async function writeTextFile({
	path,
	content,
}: {
	path: string;
	content: string;
}): Promise<void> {
	assertAbsolute(path);
	await fs.writeFile(path, content, "utf-8");
}

export async function writeBinaryFile({
	path,
	dataBase64,
}: {
	path: string;
	dataBase64: string;
}): Promise<void> {
	assertAbsolute(path);
	await fs.writeFile(path, Buffer.from(dataBase64, "base64"));
}

export async function listDirectory({
	path,
}: {
	path: string;
}): Promise<DirectoryEntry[]> {
	assertAbsolute(path);
	const entries = await fs.readdir(path, { withFileTypes: true });
	return entries.map((e) => ({
		name: e.name,
		isDirectory: e.isDirectory(),
	}));
}
