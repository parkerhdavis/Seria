/**
 * Window-control RPC handlers — backed by the Seria app window stashed
 * in src/bun/index.ts. Custom titlebar controls in the renderer call
 * windowMinimize / windowToggleMaximize / windowClose / windowIsMaximized
 * to drive native window behaviour.
 */

import type { BrowserWindow } from "electrobun/bun";

let appWindow: BrowserWindow | null = null;

export function registerWindow(win: BrowserWindow): void {
	appWindow = win;
}

function requireWindow(): BrowserWindow {
	if (!appWindow) throw new Error("App window not registered");
	return appWindow;
}

export function windowMinimize(): void {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const w = requireWindow() as any;
	if (typeof w.minimize === "function") w.minimize();
}

export function windowToggleMaximize(): boolean {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const w = requireWindow() as any;
	const isMax: boolean = typeof w.isMaximized === "function" ? !!w.isMaximized() : false;
	if (isMax) {
		if (typeof w.unmaximize === "function") w.unmaximize();
		return false;
	}
	if (typeof w.maximize === "function") w.maximize();
	return true;
}

export function windowClose(): void {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const w = requireWindow() as any;
	if (typeof w.close === "function") w.close();
}

export function windowIsMaximized(): boolean {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const w = requireWindow() as any;
	return typeof w.isMaximized === "function" ? !!w.isMaximized() : false;
}
