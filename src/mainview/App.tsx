import { useEffect, useState } from "react";
import type { Electroview } from "electrobun/view";
import type { SeriaRPC } from "../shared/rpc";

type SeriaRpc = ReturnType<typeof Electroview.defineRPC<SeriaRPC>>;

let rpc: Electroview<SeriaRpc> | null = null;
export function setRpc(view: Electroview<SeriaRpc>) {
	rpc = view;
}

// Placeholder shell. Step 6 replaces this with the migrated Seria UI tree
// (everything currently under frontend/src/).
export function App() {
	const [ready, setReady] = useState(false);

	useEffect(() => {
		rpc?.rpc?.send.viewLog({ level: "info", msg: "mainview mounted" });
		setReady(true);
	}, []);

	return (
		<div style={{ fontFamily: "system-ui, sans-serif", padding: "2rem" }}>
			<h1>Seria — Electrobun shell</h1>
			<p>{ready ? "RPC link established." : "Booting…"}</p>
		</div>
	);
}
