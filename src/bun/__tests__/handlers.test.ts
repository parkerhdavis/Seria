/**
 * Smoke tests for the ported file_ops + storage + fs_ops handlers.
 *
 * Excludes the Electrobun-dependent handlers (dialog, clipboard, storage —
 * which reads Utils.paths.config) so these tests run cleanly under plain
 * `bun test`. The full handler sweep happens during the acceptance-criteria
 * smoke via the real app.
 */

import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	openCellFile,
	saveCellFile,
	createTempFile,
	getFileIdentifiers,
} from "../file_ops";
import {
	readTextFile,
	writeTextFile,
	writeBinaryFile,
	listDirectory,
} from "../fs_ops";

async function mkSandbox(): Promise<string> {
	return mkdtemp(join(tmpdir(), "seria-test-"));
}

describe("file_ops", () => {
	test("openCellFile reads UTF-8 content", async () => {
		const dir = await mkSandbox();
		try {
			const path = join(dir, "sample.csv");
			await writeFile(path, "A,B\n1,2\n", "utf-8");
			expect(await openCellFile({ path })).toBe("A,B\n1,2\n");
		} finally {
			await rm(dir, { recursive: true });
		}
	});

	test("saveCellFile writes UTF-8 content", async () => {
		const dir = await mkSandbox();
		try {
			const path = join(dir, "out.csv");
			await saveCellFile({ path, content: "X,Y\na,b\n" });
			expect(await readFile(path, "utf-8")).toBe("X,Y\na,b\n");
		} finally {
			await rm(dir, { recursive: true });
		}
	});

	test("openCellFile rejects path traversal", async () => {
		await expect(openCellFile({ path: "/tmp/../etc/passwd" })).rejects.toThrow(
			/traversal/i,
		);
	});

	test("openCellFile rejects relative paths", async () => {
		await expect(openCellFile({ path: "relative.csv" })).rejects.toThrow(
			/absolute/i,
		);
	});

	test("createTempFile yields unique paths with default headers", async () => {
		const a = await createTempFile();
		const b = await createTempFile();
		expect(a).not.toBe(b);
		expect(await readFile(a, "utf-8")).toBe("Column1,Column2,Column3\n");
		await rm(a);
		await rm(b);
	});

	test("getFileIdentifiers returns filename + parent + size + os id", async () => {
		const dir = await mkSandbox();
		try {
			const path = join(dir, "id-me.csv");
			await writeFile(path, "hello", "utf-8");
			const id = await getFileIdentifiers({ path });
			expect(id.filename).toBe("id-me.csv");
			expect(id.fileSize).toBe(5);
			expect(id.contentHashPartial).toBeNull(); // below 100KB threshold
			// OS id: inode on Linux/macOS, hash on Windows. Non-null on all.
			expect(id.osFileId).toBeTruthy();
		} finally {
			await rm(dir, { recursive: true });
		}
	});

	test("getFileIdentifiers computes content hash for files over 100KB", async () => {
		const dir = await mkSandbox();
		try {
			const path = join(dir, "big.csv");
			await writeFile(path, "a".repeat(200_000), "utf-8");
			const id = await getFileIdentifiers({ path });
			expect(id.contentHashPartial).toMatch(/^[0-9a-f]{64}$/);
		} finally {
			await rm(dir, { recursive: true });
		}
	});
});

describe("fs_ops", () => {
	test("readTextFile / writeTextFile round-trip", async () => {
		const dir = await mkSandbox();
		try {
			const path = join(dir, "config.json");
			await writeTextFile({ path, content: '{"ok":true}' });
			expect(await readTextFile({ path })).toBe('{"ok":true}');
		} finally {
			await rm(dir, { recursive: true });
		}
	});

	test("writeBinaryFile decodes base64 and writes bytes", async () => {
		const dir = await mkSandbox();
		try {
			const path = join(dir, "blob.bin");
			const dataBase64 = Buffer.from([0xff, 0x00, 0x7f]).toString("base64");
			await writeBinaryFile({ path, dataBase64 });
			const bytes = await readFile(path);
			expect(Array.from(bytes)).toEqual([0xff, 0x00, 0x7f]);
		} finally {
			await rm(dir, { recursive: true });
		}
	});

	test("listDirectory separates files and directories", async () => {
		const dir = await mkSandbox();
		try {
			await writeFile(join(dir, "a.txt"), "", "utf-8");
			await writeFile(join(dir, "b.txt"), "", "utf-8");
			const entries = await listDirectory({ path: dir });
			const names = entries.map((e) => e.name).sort();
			expect(names).toEqual(["a.txt", "b.txt"]);
			expect(entries.every((e) => !e.isDirectory)).toBe(true);
		} finally {
			await rm(dir, { recursive: true });
		}
	});
});
