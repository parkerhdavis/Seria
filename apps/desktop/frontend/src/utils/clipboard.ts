/**
 * Drop-in replacement for @tauri-apps/plugin-clipboard-manager's
 * readText / writeText. Routes through the typed RPC.
 */

import { rpcCall } from "./rpc";

export async function readText(): Promise<string> {
	return rpcCall.readClipboard({});
}

export async function writeText(text: string): Promise<void> {
	await rpcCall.writeClipboard({ text });
}
