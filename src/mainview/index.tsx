import { createRoot } from "react-dom/client";
import { Electroview } from "electrobun/view";
import type { SeriaRPC } from "../shared/rpc";
import { App, setRpc } from "./App";

const rpc = Electroview.defineRPC<SeriaRPC>({
	maxRequestTime: 60_000,
	handlers: {
		requests: {},
		messages: {},
	},
});

const electroview = new Electroview({ rpc });
setRpc(electroview);

createRoot(document.getElementById("root")!).render(<App />);
