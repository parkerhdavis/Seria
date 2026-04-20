import type { ElectrobunConfig } from "electrobun";

export default {
	app: {
		name: "seria",
		identifier: "seria.parkerhdavis.dev",
		version: "0.2.0",
	},
	build: {
		// Bun.build HTML mode outputs index.html + hashed chunk-*.js + assets at
		// the dist/ root (no subdirs). Copy the whole tree into views/mainview/
		// so the relative chunk references in index.html resolve inside the
		// Electrobun bundle layout (Resources/app/views/mainview/).
		//
		// Workers live under dist/workers/ and land alongside the mainview so
		// new Worker(new URL("./workers/foo.js", import.meta.url)) resolves.
		//
		// resources/ ships the sample files referenced by the screenplay
		// converter's roundtrip test and any future bundled defaults.
		copy: {
			"dist": "views/mainview",
			"resources": "resources",
		},
		watchIgnore: ["dist/**"],
		mac: { bundleCEF: false },
		linux: { bundleCEF: false },
		win: { bundleCEF: false },
	},
} satisfies ElectrobunConfig;
