/**
 * Seria main process (Bun runtime under Electrobun).
 *
 * Creates the application window, registers the typed RPC channel the
 * mainview uses to reach the backend, and brokers every native-OS touch
 * point (file I/O, dialogs, clipboard, user-data storage) from here.
 */

import { BrowserView, BrowserWindow } from "electrobun/bun";
import type { SeriaRPC } from "../shared/rpc";

// 10s is too aggressive on Linux — the GTK file dialog blocks the event loop
// while open, so RPC responses queue up behind it. 60s keeps every wrapper
// working regardless of how long the user takes in a native dialog.
const RPC_MAX_REQUEST_TIME = 60_000;

const rpc = BrowserView.defineRPC<SeriaRPC>({
	maxRequestTime: RPC_MAX_REQUEST_TIME,
	handlers: {
		requests: {},
		messages: {
			viewLog: ({ level, msg }) => {
				const line = `[view:${level}] ${msg}`;
				if (level === "error") console.error(line);
				else if (level === "warn") console.warn(line);
				else console.log(line);
			},
		},
	},
});

const win = new BrowserWindow({
	title: "Seria",
	url: "views://mainview/index.html",
	frame: { width: 1400, height: 900, x: 200, y: 200 },
	rpc,
});

if (process.env.ELECTROBUN_DEV) {
	win.webview.openDevTools();
}
