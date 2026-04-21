/**
 * Dialog wrappers.
 *
 * Thin RPC surface around Utils.openFileDialog (for open / directory
 * pickers) plus platform-native save-as dialogs shelled out via zenity
 * / osascript / PowerShell, since Electrobun 1.16 doesn't expose a
 * native save dialog of its own.
 *
 * Two rough edges from the spike that this module papers over:
 *
 *   - openFileDialog returns a comma-joined string split into `[""]` when
 *     the user cancels. Collapse that to `null` before it reaches the view.
 *   - The default startingFolder is process.cwd(), which under Electrobun
 *     is the bundle's `bin/` directory — never what the user wants. Fall
 *     back to ~/Documents (pickers on cell files) or ~ (everything else).
 */

import { Utils } from "electrobun/bun";
import { isAbsolute, join, basename, dirname } from "node:path";
import type { DialogFilter } from "@shared/rpc";

function filtersToAllowedTypes(filters: DialogFilter[] | undefined): string {
	if (!filters || filters.length === 0) return "*";
	const exts = new Set<string>();
	for (const f of filters) {
		for (const ext of f.extensions) {
			if (!ext || ext === "*") return "*";
			exts.add(ext.replace(/^\./, ""));
		}
	}
	return Array.from(exts).join(",");
}

function firstRealPath(paths: string[]): string | null {
	const first = paths[0];
	if (!first) return null;
	return first;
}

export async function pickFile({
	filters,
	startingFolder,
}: {
	title?: string;
	filters?: DialogFilter[];
	startingFolder?: string;
}): Promise<string | null> {
	const paths = await Utils.openFileDialog({
		startingFolder: startingFolder ?? Utils.paths.documents,
		allowedFileTypes: filtersToAllowedTypes(filters),
		canChooseFiles: true,
		canChooseDirectory: false,
		allowsMultipleSelection: false,
	});
	return firstRealPath(paths);
}

export async function pickDirectory({
	startingFolder,
}: {
	title?: string;
	startingFolder?: string;
}): Promise<string | null> {
	const paths = await Utils.openFileDialog({
		startingFolder: startingFolder ?? Utils.paths.home,
		allowedFileTypes: "*",
		canChooseFiles: false,
		canChooseDirectory: true,
		allowsMultipleSelection: false,
	});
	return firstRealPath(paths);
}

// ═══════════════════════════════════════════════════════════════════════════
// Save-as dialog
// ═══════════════════════════════════════════════════════════════════════════
//
// Shell out to a platform-native save helper because Electrobun 1.16 doesn't
// wrap one. Each branch returns the chosen absolute path or null on cancel.

export async function pickSaveFile(params: {
	title?: string;
	filters?: DialogFilter[];
	defaultPath?: string;
	startingFolder?: string;
}): Promise<string | null> {
	const { title, filters, defaultPath, startingFolder } = params;

	// Resolve the default-path hint into a starting directory + filename.
	const { dir: startDir, name: startName } = splitDefault(
		defaultPath,
		startingFolder ?? Utils.paths.documents,
	);

	switch (process.platform) {
		case "linux":
			return saveDialogZenity({ title, filters, startDir, startName });
		case "darwin":
			return saveDialogOsascript({ title, filters, startDir, startName });
		case "win32":
			return saveDialogPowerShell({ title, filters, startDir, startName });
		default:
			throw new Error(`pickSaveFile: unsupported platform ${process.platform}`);
	}
}

function splitDefault(
	defaultPath: string | undefined,
	fallbackDir: string,
): { dir: string; name: string } {
	if (!defaultPath) return { dir: fallbackDir, name: "untitled" };
	if (isAbsolute(defaultPath)) {
		return { dir: dirname(defaultPath), name: basename(defaultPath) };
	}
	return { dir: fallbackDir, name: basename(defaultPath) };
}

// ── Linux: zenity ──────────────────────────────────────────────────────────

async function saveDialogZenity({
	title,
	filters,
	startDir,
	startName,
}: {
	title?: string;
	filters?: DialogFilter[];
	startDir: string;
	startName: string;
}): Promise<string | null> {
	const args = [
		"--file-selection",
		"--save",
		"--confirm-overwrite",
		`--filename=${join(startDir, startName)}`,
	];
	if (title) args.push(`--title=${title}`);
	for (const f of filters ?? []) {
		const patterns = f.extensions
			.map((e) => (e === "*" ? "*" : `*.${e.replace(/^\./, "")}`))
			.join(" ");
		args.push(`--file-filter=${f.name} | ${patterns}`);
	}

	const proc = Bun.spawn(["zenity", ...args], {
		stdout: "pipe",
		stderr: "pipe",
	});
	const stdout = await new Response(proc.stdout).text();
	const exitCode = await proc.exited;
	if (exitCode !== 0) return null; // 1 = cancelled, >1 = error
	const picked = stdout.trim();
	return picked || null;
}

// ── macOS: osascript ───────────────────────────────────────────────────────

async function saveDialogOsascript({
	title,
	startDir,
	startName,
}: {
	title?: string;
	filters?: DialogFilter[];
	startDir: string;
	startName: string;
}): Promise<string | null> {
	// `choose file name` doesn't take a filter list; filters are only advisory
	// on macOS save dialogs anyway since users can always type any extension.
	const prompt = (title ?? "Save as").replace(/"/g, '\\"');
	const safeName = startName.replace(/"/g, '\\"');
	const safeDir = startDir.replace(/"/g, '\\"');
	const script = `POSIX path of (choose file name with prompt "${prompt}" default name "${safeName}" default location (POSIX file "${safeDir}"))`;

	const proc = Bun.spawn(["osascript", "-e", script], {
		stdout: "pipe",
		stderr: "pipe",
	});
	const stdout = await new Response(proc.stdout).text();
	const exitCode = await proc.exited;
	if (exitCode !== 0) return null; // user cancelled → non-zero
	const picked = stdout.trim();
	return picked || null;
}

// ── Windows: PowerShell SaveFileDialog ────────────────────────────────────

async function saveDialogPowerShell({
	title,
	filters,
	startDir,
	startName,
}: {
	title?: string;
	filters?: DialogFilter[];
	startDir: string;
	startName: string;
}): Promise<string | null> {
	// Build the WinForms Filter string: "CSV (*.csv)|*.csv|All Files (*.*)|*.*"
	const filterPairs =
		filters && filters.length > 0
			? filters
					.map((f) => {
						const patterns = f.extensions
							.map((e) => (e === "*" ? "*.*" : `*.${e.replace(/^\./, "")}`))
							.join(";");
						return `${f.name} (${patterns})|${patterns}`;
					})
					.join("|")
			: "All Files (*.*)|*.*";

	// PowerShell script — emits the chosen path on stdout, or nothing on cancel.
	const script = [
		`Add-Type -AssemblyName System.Windows.Forms`,
		`$d = New-Object System.Windows.Forms.SaveFileDialog`,
		`$d.InitialDirectory = ${psQuote(startDir)}`,
		`$d.FileName = ${psQuote(startName)}`,
		`$d.Filter = ${psQuote(filterPairs)}`,
		`$d.OverwritePrompt = $true`,
		title ? `$d.Title = ${psQuote(title)}` : ``,
		`if ($d.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { $d.FileName }`,
	]
		.filter(Boolean)
		.join("; ");

	const proc = Bun.spawn(
		["powershell", "-NoProfile", "-NonInteractive", "-Command", script],
		{ stdout: "pipe", stderr: "pipe" },
	);
	const stdout = await new Response(proc.stdout).text();
	await proc.exited;
	const picked = stdout.trim();
	return picked || null;
}

function psQuote(s: string): string {
	// Single-quote for PowerShell; double internal single-quotes to escape.
	return `'${s.replace(/'/g, "''")}'`;
}
