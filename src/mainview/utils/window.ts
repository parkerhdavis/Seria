/**
 * Drop-in replacement for @tauri-apps/api/window's getCurrentWindow(),
 * narrowed to just the methods Seria actually uses (minimize, toggle
 * maximize, close, isMaximized, onResized, label).
 *
 * The Electrobun side can't push resize events into the webview's RPC
 * stream, so `onResized` falls back to `window.addEventListener('resize')`
 * — close enough for refreshing the maximize/restore icon.
 */

import { rpcCall } from "./rpc";

type UnlistenFn = () => void;

const appWindow = {
	label: "main",

	minimize(): Promise<void> {
		return rpcCall.windowMinimize({});
	},

	close(): Promise<void> {
		return rpcCall.windowClose({});
	},

	async toggleMaximize(): Promise<void> {
		await rpcCall.windowToggleMaximize({});
	},

	isMaximized(): Promise<boolean> {
		return rpcCall.windowIsMaximized({});
	},

	onResized(callback: () => void): Promise<UnlistenFn> {
		const handler = () => callback();
		window.addEventListener("resize", handler);
		return Promise.resolve(() => window.removeEventListener("resize", handler));
	},
};

export function getCurrentWindow(): typeof appWindow {
	return appWindow;
}
