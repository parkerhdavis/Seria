/**
 * Typed RPC schema shared between the Bun main process and the mainview.
 *
 * Both sides import this module and get end-to-end type safety on requests
 * and messages. This replaces Tauri's `invoke()` + stringly-typed command
 * names with one shared schema.
 *
 * Step 1 keeps this schema minimal — a single viewLog message is enough to
 * validate the RPC plumbing while the shell boots. Step 2 fills in all 16
 * Seria commands + the dialog / clipboard wrappers.
 */

import type { RPCSchema } from "electrobun/bun";

export type SeriaRPC = {
	bun: RPCSchema<{
		requests: Record<string, never>;
		messages: {
			viewLog: { level: "info" | "warn" | "error"; msg: string };
		};
	}>;
	webview: RPCSchema<{
		requests: Record<string, never>;
		messages: Record<string, never>;
	}>;
};
