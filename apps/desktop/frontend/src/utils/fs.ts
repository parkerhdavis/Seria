/**
 * Drop-in replacements for the bits of @tauri-apps/plugin-fs Seria uses:
 * readTextFile, writeTextFile, writeFile (binary), readDir.
 *
 * Under the hood everything routes through the typed RPC to node:fs on
 * the Bun side.
 */

import { rpcCall } from "./rpc";

export async function readTextFile(path: string): Promise<string> {
	return rpcCall.readTextFile({ path });
}

export async function writeTextFile(
	path: string,
	content: string,
): Promise<void> {
	await rpcCall.writeTextFile({ path, content });
}

export async function writeFile(
	path: string,
	data: Uint8Array,
): Promise<void> {
	// RPC is JSON, so binary payloads travel as base64. Built-in Buffer-like
	// encoding in the browser — btoa on a binary string works for <~128KB;
	// for bigger payloads (PDF export) we use a chunked approach.
	const dataBase64 = uint8ArrayToBase64(data);
	await rpcCall.writeBinaryFile({ path, dataBase64 });
}

export type DirEntry = {
	name: string;
	isDirectory: boolean;
};

export async function readDir(path: string): Promise<DirEntry[]> {
	return rpcCall.listDirectory({ path });
}

/**
 * Byte-safe Uint8Array → base64. `btoa(String.fromCharCode(...bytes))`
 * blows up for large arrays (argument count limit) — chunk through it.
 */
function uint8ArrayToBase64(bytes: Uint8Array): string {
	const CHUNK = 0x8000; // 32KB — safely under the call-stack fromCharCode limit
	let binary = "";
	for (let i = 0; i < bytes.length; i += CHUNK) {
		const end = Math.min(i + CHUNK, bytes.length);
		binary += String.fromCharCode(...bytes.subarray(i, end));
	}
	return btoa(binary);
}
