/**
 * Drop-in replacement for the sliver of @tauri-apps/api/path Seria uses:
 * just `downloadDir()`. Routes through the typed RPC to Utils.paths.downloads.
 */

import { rpcCall } from "./rpc";

export async function downloadDir(): Promise<string> {
	return rpcCall.getDownloadsDir({});
}
