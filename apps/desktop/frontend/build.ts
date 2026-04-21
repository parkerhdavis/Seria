/**
 * Build the mainview HTML + JS bundle and the web workers via Bun.build.
 * Tailwind is processed by bun-plugin-tailwind (Seria's CSS uses
 * @import "tailwindcss" + @plugin "daisyui", which the plugin resolves).
 *
 * Paths are relative to the repo root so this script runs the same whether
 * invoked as `bun frontend/build.ts` or `cd frontend && bun build.ts`.
 */

import { cp, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import tailwind from "bun-plugin-tailwind";

const FRONTEND = dirname(fileURLToPath(import.meta.url));
const DIST = resolve(FRONTEND, "dist");
const SRC = resolve(FRONTEND, "src");
const PUBLIC = resolve(SRC, "public");
const isDebug = !!process.env.ELECTROBUN_DEV;

const WORKER_ENTRY_POINTS = [
	resolve(SRC, "utils/cellParser.worker.ts"),
	resolve(SRC, "utils/cardPrint.worker.ts"),
	resolve(SRC, "utils/screenplayPrint.worker.ts"),
];

// Bun.build doesn't have emptyOutDir — clean manually so stale chunks don't
// survive into the Electrobun bundle copy step.
await rm(DIST, { recursive: true, force: true });

// Main view: HTML entrypoint mode picks up <script src="./index.tsx"> and
// <link href="./styles.css"> references, bundles them, and rewrites the paths.
const viewResult = await Bun.build({
	entrypoints: [resolve(SRC, "index.html")],
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
		outdir: resolve(DIST, "workers"),
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
