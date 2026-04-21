import React from "react";
import ReactDOM from "react-dom/client";
import { Electroview } from "electrobun/view";
import type { SeriaRPC } from "@shared/rpc";
import App from "./App";
import { setRpc } from "./utils/rpc";

// Typed RPC link to the Bun main process. Mirrors Step 2's schema.
// maxRequestTime is 60s on both sides (Linux GTK dialogs block the event
// loop — default 10s is too aggressive, see the spike retrospective).
const rpc = Electroview.defineRPC<SeriaRPC>({
	maxRequestTime: 60_000,
	handlers: {
		requests: {},
		messages: {},
	},
});

const electroview = new Electroview({ rpc });
setRpc(electroview);

// Global error handlers — surface any renderer-side crash in the Bun
// stdout via viewLog so we don't have to open devtools to debug.
window.addEventListener("error", (e) => {
	electroview.rpc?.send.viewLog({
		level: "error",
		msg: `window.error: ${e.message} @ ${e.filename}:${e.lineno}`,
	});
});
window.addEventListener("unhandledrejection", (e) => {
	electroview.rpc?.send.viewLog({
		level: "error",
		msg: `unhandledrejection: ${String(e.reason)}`,
	});
});

electroview.rpc?.send.viewLog({ level: "info", msg: "main.tsx: RPC bootstrapped" });

// Mount the React application
ReactDOM.createRoot(document.getElementById("root")!).render(
	<React.StrictMode>
		<App />
	</React.StrictMode>,
);

electroview.rpc?.send.viewLog({ level: "info", msg: "main.tsx: React mounted" });

// Hide loading screen after React mounts
document.body.classList.add("loaded");
