/**
 * OS-path RPC handlers. Thin wrappers around Utils.paths so the renderer
 * doesn't need to know about Electrobun's API.
 */

import { Utils } from "electrobun/bun";

export function getDownloadsDir(): string {
	return Utils.paths.downloads;
}
