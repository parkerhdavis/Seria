/**
 * File operations for Cell files (CSV, TSV, JSON).
 *
 * Ported from backend/src/file_ops.rs. Shape of each command preserved so
 * the renderer's call sites can move to typed RPC with no behavioral
 * change.
 */

import { createHash } from "node:crypto";
import { promises as fs, readSync, openSync, closeSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, isAbsolute, dirname, basename, resolve } from "node:path";
import type { FileIdentifiers } from "@shared/rpc";

/**
 * Monotonic counter that, combined with a timestamp + pid, makes rapid
 * successive createTempFile calls collision-free.
 */
let tempFileCounter = 0;

function validatePathBasics(path: string): void {
	if (path.includes("..")) {
		throw new Error("Path traversal detected: '..' is not allowed in file paths");
	}
	if (path.includes("\0")) {
		throw new Error("Invalid path: null bytes are not allowed");
	}
	if (!isAbsolute(path)) {
		throw new Error("Only absolute file paths are allowed");
	}
}

async function validateFilePath(path: string): Promise<string> {
	validatePathBasics(path);
	const canonical = await fs.realpath(path);
	if (canonical.includes("..")) {
		throw new Error("Path traversal detected after canonicalization");
	}
	return canonical;
}

async function validateFilePathForWrite(path: string): Promise<string> {
	validatePathBasics(path);
	const parent = dirname(path);
	const canonicalParent = await fs.realpath(parent);
	if (canonicalParent.includes("..")) {
		throw new Error("Path traversal detected after canonicalization");
	}
	const filename = basename(path);
	if (!filename) throw new Error("Invalid path: no filename");
	return join(canonicalParent, filename);
}

export async function openCellFile({ path }: { path: string }): Promise<string> {
	const safe = await validateFilePath(path);
	return fs.readFile(safe, "utf-8");
}

export async function saveCellFile({
	path,
	content,
}: {
	path: string;
	content: string;
}): Promise<void> {
	const safe = await validateFilePathForWrite(path);
	await fs.writeFile(safe, content, "utf-8");
}

export async function createTempFile(): Promise<string> {
	const now = process.hrtime.bigint();
	// hrtime is nanoseconds since an arbitrary epoch; split into seconds/nanos
	// so the filename matches the Rust version's (secs, nanos, pid, counter)
	// shape. The exact epoch doesn't matter — uniqueness does.
	const ns = Number(now % 1_000_000_000n);
	const s = Number(now / 1_000_000_000n);
	const counter = tempFileCounter++;
	const name = `seria_temp_${s}_${ns}_${process.pid}_${counter}.csv`;
	const fullPath = join(tmpdir(), name);
	await fs.writeFile(fullPath, "Column1,Column2,Column3\n", "utf-8");
	return fullPath;
}

function calculateContentHashPartial(path: string): string {
	// First 1MB (or entire file if smaller), SHA-256'd. Matches the Rust
	// behavior of `read(&mut buffer)` with a 1MB buffer.
	const fd = openSync(path, "r");
	try {
		const buf = Buffer.alloc(1024 * 1024);
		const n = readSync(fd, buf, 0, buf.length, 0);
		return createHash("sha256").update(buf.subarray(0, n)).digest("hex");
	} finally {
		closeSync(fd);
	}
}

function getOsFileId(path: string): string | null {
	// Rust: inode on Unix, hash(path) on Windows. TS equivalent uses fs.stat's
	// ino on non-Windows (0 when unsupported) and a SHA256-of-path fallback on
	// Windows. Used to match file configs across renames/moves.
	if (process.platform === "win32") {
		const hash = createHash("sha256").update(path).digest("hex").slice(0, 16);
		return `fileid-${hash}`;
	}
	try {
		const s = statSync(path);
		if (s.ino === 0) return null;
		return `inode-${s.ino}`;
	} catch {
		return null;
	}
}

export async function getFileIdentifiers({
	path,
}: {
	path: string;
}): Promise<FileIdentifiers> {
	const safe = await validateFilePath(path);
	const filename = basename(safe);
	// Parent dir *name* only (not full path), matching the Rust semantics used
	// by file-config matching in the renderer.
	const parentDir = basename(dirname(safe));
	const meta = await fs.stat(safe);
	const fileSize = meta.size;
	const osFileId = getOsFileId(safe);
	const contentHashPartial =
		fileSize > 100_000 ? calculateContentHashPartial(safe) : null;
	return {
		absolutePath: resolve(safe),
		filename,
		parentDir,
		fileSize,
		contentHashPartial,
		osFileId,
	};
}
