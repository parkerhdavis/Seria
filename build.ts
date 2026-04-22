/**
 * Build the mainview HTML + JS bundle and the web workers via Bun.build.
 * Mirrors Poppy's apps/web/build.ts. Tailwind is processed by
 * bun-plugin-tailwind (Seria's CSS uses @import "tailwindcss" + @plugin
 * "daisyui", which the plugin resolves).
 */

import { cp, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import tailwind from "bun-plugin-tailwind";

const DIST = "./dist";
const PUBLIC = "./src/mainview/public";
const isDebug = !!process.env.ELECTROBUN_DEV;

const WORKER_ENTRY_POINTS = [
	"./src/mainview/utils/cellParser.worker.ts",
	"./src/mainview/utils/cardPrint.worker.ts",
	"./src/mainview/utils/screenplayPrint.worker.ts",
];

// Bun.build doesn't have emptyOutDir — clean manually so stale chunks don't
// survive into the Electrobun bundle copy step.
await rm(DIST, { recursive: true, force: true });

// Main view: HTML entrypoint mode picks up <script src="./index.tsx"> and
// <link href="./styles.css"> references, bundles them, and rewrites the paths.
const viewResult = await Bun.build({
	entrypoints: ["./src/mainview/index.html"],
	outdir: DIST,
	minify: !isDebug,
	sourcemap: isDebug ? "linked" : "none",
	plugins: [tailwind],
});

if (!viewResult.success) {
	console.error("View build failed:");
	for (const log of viewResult.logs) console.error(log);
	process.exit(1);
}

// Workers: separate bundles, loaded via new Worker(new URL("./workers/...")).
const workersPresent = WORKER_ENTRY_POINTS.every(existsSync);
if (workersPresent) {
	const workerResult = await Bun.build({
		entrypoints: WORKER_ENTRY_POINTS,
		outdir: `${DIST}/workers`,
		target: "browser",
		naming: "[name].js",
		minify: !isDebug,
		sourcemap: isDebug ? "linked" : "none",
	});
	if (!workerResult.success) {
		console.error("Worker build failed:");
		for (const log of workerResult.logs) console.error(log);
		process.exit(1);
	}
}

// Copy static assets (fonts etc.) into dist/ so the Electrobun bundle's
// views/mainview/ directory has them alongside index.html. /fonts/... in
// CSS then resolves correctly at webview load time.
if (existsSync(PUBLIC)) {
	await cp(PUBLIC, DIST, { recursive: true });
}

console.log(`Build complete: ${viewResult.outputs.length} view file(s)${workersPresent ? ` + ${WORKER_ENTRY_POINTS.length} workers` : ""}`);
