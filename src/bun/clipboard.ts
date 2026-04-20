/**
 * Clipboard wrappers. The renderer uses the RPC methods below instead of
 * touching Electrobun's Utils.clipboard* directly, matching how the old
 * @tauri-apps/plugin-clipboard-manager surface looked.
 */

import { Utils } from "electrobun/bun";

export function readClipboard(): string {
	// Utils.clipboardReadText returns string | null (null when the clipboard
	// has no text payload — e.g. just an image). The renderer treats absence
	// as an empty string, so normalize here.
	return Utils.clipboardReadText() ?? "";
}

export function writeClipboard({ text }: { text: string }): void {
	Utils.clipboardWriteText(text);
}
