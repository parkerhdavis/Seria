import type { ElectrobunConfig } from "electrobun";

export default {
	app: {
		name: "seria",
		identifier: "seria.parkerhdavis.dev",
		version: "0.1.0",
	},
	build: {
		// Electrobun uses process.cwd() as project root. This config lives at
		// apps/desktop/, so we run electrobun from there and paths inside
		// are relative to apps/desktop/. Anything at the repo root (target/,
		// resources/) is reached via "../../".
		bun: {
			entrypoint: "backend/src/index.ts",
		},
		copy: {
			"frontend/dist": "views/mainview",
			"../../resources": "resources",
		},
		buildFolder: "../../target",
		artifactFolder: "../../target/artifacts",
		watchIgnore: ["frontend/dist/**"],
		mac: { bundleCEF: false },
		linux: { bundleCEF: false },
		win: { bundleCEF: false },
	},
} satisfies ElectrobunConfig;
