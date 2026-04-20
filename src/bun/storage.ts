/**
 * Storage for app-level persistent data: preferences, custom Print
 * templates, per-file configs, and workspace layouts.
 *
 * Ported from backend/src/storage.rs. Storage location is anchored at
 * `Utils.paths.config/seria/`, which resolves to the same directories
 * Tauri's `app_data_dir()` gave us (on all three platforms):
 *
 *   Linux:   ~/.config/seria/
 *   macOS:   ~/Library/Application Support/seria/
 *   Windows: %APPDATA%\seria\
 *
 * So existing preferences.json / prints/ / file-configs.json / workspaces.json
 * files from Tauri-era installs continue to load without migration.
 */

import { Utils } from "electrobun/bun";
import { promises as fs } from "node:fs";
import { join } from "node:path";

const APP_DIR_NAME = "seria";

function appDir(): string {
	return join(Utils.paths.config, APP_DIR_NAME);
}

function preferencesPath(): string {
	return join(appDir(), "preferences.json");
}

function printsDir(): string {
	return join(appDir(), "prints");
}

function fileConfigsPath(): string {
	return join(appDir(), "file-configs.json");
}

function workspacesPath(): string {
	return join(appDir(), "workspaces.json");
}

async function ensureParent(filePath: string): Promise<void> {
	await fs.mkdir(join(filePath, ".."), { recursive: true });
}

function sanitizePrintName(name: string): string {
	return Array.from(name)
		.filter((c) => /[A-Za-z0-9_-]/.test(c))
		.join("");
}

// ── Preferences ────────────────────────────────────────────────────────────

export async function loadPreferences(): Promise<string> {
	const p = preferencesPath();
	try {
		return await fs.readFile(p, "utf-8");
	} catch (err: unknown) {
		if ((err as NodeJS.ErrnoException).code === "ENOENT") return "{}";
		throw err;
	}
}

export async function savePreferences({ data }: { data: string }): Promise<void> {
	const p = preferencesPath();
	await ensureParent(p);
	await fs.writeFile(p, data, "utf-8");
}

// ── Custom Print templates ─────────────────────────────────────────────────

export async function loadCustomPrints(): Promise<string[]> {
	const dir = printsDir();
	let entries: string[];
	try {
		entries = await fs.readdir(dir);
	} catch (err: unknown) {
		if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
		throw err;
	}
	const results: string[] = [];
	for (const entry of entries) {
		if (!entry.endsWith(".json")) continue;
		results.push(await fs.readFile(join(dir, entry), "utf-8"));
	}
	return results;
}

export async function saveCustomPrint({
	name,
	data,
}: {
	name: string;
	data: string;
}): Promise<void> {
	const dir = printsDir();
	await fs.mkdir(dir, { recursive: true });
	const safeName = sanitizePrintName(name);
	await fs.writeFile(join(dir, `${safeName}.json`), data, "utf-8");
}

export async function deleteCustomPrint({ name }: { name: string }): Promise<void> {
	const safeName = sanitizePrintName(name);
	const target = join(printsDir(), `${safeName}.json`);
	try {
		await fs.unlink(target);
	} catch (err: unknown) {
		if ((err as NodeJS.ErrnoException).code === "ENOENT") return;
		throw err;
	}
}

// ── Per-file configs ───────────────────────────────────────────────────────

export async function loadFileConfigs(): Promise<string> {
	const p = fileConfigsPath();
	try {
		return await fs.readFile(p, "utf-8");
	} catch (err: unknown) {
		if ((err as NodeJS.ErrnoException).code === "ENOENT") {
			return '{"version":1,"configs":[]}';
		}
		throw err;
	}
}

export async function saveFileConfigs({ data }: { data: string }): Promise<void> {
	const p = fileConfigsPath();
	await ensureParent(p);
	await fs.writeFile(p, data, "utf-8");
}

// ── Workspace layouts ──────────────────────────────────────────────────────

export async function loadWorkspaceLayouts(): Promise<string> {
	const p = workspacesPath();
	try {
		return await fs.readFile(p, "utf-8");
	} catch (err: unknown) {
		if ((err as NodeJS.ErrnoException).code === "ENOENT") return "[]";
		throw err;
	}
}

export async function saveWorkspaceLayouts({
	layoutsJson,
}: {
	layoutsJson: string;
}): Promise<void> {
	const p = workspacesPath();
	await ensureParent(p);
	await fs.writeFile(p, layoutsJson, "utf-8");
}
