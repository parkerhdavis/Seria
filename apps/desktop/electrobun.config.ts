import type { ElectrobunConfig } from "electrobun";
import pkg from "./package.json";

export default {
	app: {
		name: "seria",
		identifier: "seria.parkerhdavis.dev",
		version: pkg.version,
	},
	build: {
		// Electrobun uses process.cwd() as project root. This config lives at
		// apps/desktop/, so we run electrobun from there and paths inside
		// are relative to apps/desktop/. Anything at the repo root (target/,
		// resources/) is reached via "../../".
		//
		// Per-version buildFolder so `make build` across multiple versions
		// keeps each bundle alongside its installer under target/v<X.Y.Z>/.
		bun: {
			entrypoint: "backend/src/index.ts",
		},
		copy: {
			"frontend/dist": "views/mainview",
			"../../resources": "resources",
		},
		buildFolder: `../../target/v${pkg.version}`,
		artifactFolder: "../../target/artifacts",
		watchIgnore: ["frontend/dist/**"],
		mac: { bundleCEF: false },
		linux: { bundleCEF: false },
		win: { bundleCEF: false },
	},
} satisfies ElectrobunConfig;
