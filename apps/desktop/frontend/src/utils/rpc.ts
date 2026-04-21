/**
 * Renderer-side RPC singleton + typed helpers.
 *
 * Under Tauri we called `invoke("command_name", args)`. Under Electrobun
 * we instantiate one Electroview in main.tsx, set it here, and the rest
 * of the app reaches it through `getRpc().rpc.request.xxx(args)` with
 * end-to-end type safety.
 */

import type { Electroview } from "electrobun/view";
import type { SeriaRPC } from "@shared/rpc";

type SeriaRpcInstance = ReturnType<typeof Electroview.defineRPC<SeriaRPC>>;
type SeriaElectroview = Electroview<SeriaRpcInstance>;

let electroview: SeriaElectroview | null = null;

export function setRpc(view: SeriaElectroview): void {
	electroview = view;
}

export function getRpc(): SeriaElectroview {
	if (!electroview) {
		throw new Error("RPC singleton not initialized — main.tsx should call setRpc() before any UI renders");
	}
	return electroview;
}

/**
 * Shorthand so most callers can write `rpcCall.openCellFile({ path })`
 * instead of `getRpc().rpc!.request.openCellFile({ path })`. Kept as a
 * Proxy so it stays lazy — main.tsx sets the singleton before React
 * mounts, but module top-level code that imports this file still runs
 * first.
 */
export const rpcCall: NonNullable<SeriaRpcInstance["request"]> = new Proxy(
	{} as NonNullable<SeriaRpcInstance["request"]>,
	{
		get(_target, prop) {
			const view = getRpc();
			const rpc = view.rpc;
			if (!rpc) throw new Error("Electroview.rpc unavailable");
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			return (rpc.request as any)[prop];
		},
	},
);
