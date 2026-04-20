import React from "react";
import ReactDOM from "react-dom/client";
import { Electroview } from "electrobun/view";
import type { SeriaRPC } from "../shared/rpc";
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

// Mount the React application
ReactDOM.createRoot(document.getElementById("root")!).render(
	<React.StrictMode>
		<App />
	</React.StrictMode>,
);

// Hide loading screen after React mounts
document.body.classList.add("loaded");
