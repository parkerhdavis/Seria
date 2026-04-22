/**
 * Screenplay ↔ CSV converter tests. Ported from the `#[cfg(test)] mod tests`
 * block at the bottom of backend/src/converters/screenplay.rs. The
 * All-About-Eve test was `#[ignore]` under Rust; the TS port runs it in
 * the default suite because the sample file ships in `resources/` and
 * always resolves from the project root in both dev and built layouts.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { convertScreenplayToCsv, __internals } from "./screenplay";

const { isSceneHeading, isAllCaps, isTransition } = __internals;

describe("scene heading detection", () => {
	test("recognizes INT./EXT./INT/EXT prefixes", () => {
		expect(isSceneHeading("INT. OFFICE - DAY")).toBe(true);
		expect(isSceneHeading("EXT. STREET - NIGHT")).toBe(true);
		expect(isSceneHeading("INT/EXT CAR - MORNING")).toBe(true);
	});
	test("rejects lowercase or plain prose", () => {
		expect(isSceneHeading("interior office")).toBe(false);
		expect(isSceneHeading("John enters.")).toBe(false);
	});
});

describe("all caps detection", () => {
	test("plain names and name-with-paren are all-caps", () => {
		expect(isAllCaps("JOHN")).toBe(true);
		expect(isAllCaps("MARY (V.O.)")).toBe(true);
		expect(isAllCaps("DR. SMITH")).toBe(true);
	});
	test("mixed case fails", () => {
		expect(isAllCaps("John")).toBe(false);
		expect(isAllCaps("Hello there")).toBe(false);
	});
});

describe("transition detection", () => {
	test("FADE OUT, CUT TO, DISSOLVE TO", () => {
		expect(isTransition("FADE OUT.")).toBe(true);
		expect(isTransition("CUT TO:")).toBe(true);
		expect(isTransition("DISSOLVE TO:")).toBe(true);
	});
	test("prose does not match", () => {
		expect(isTransition("He walks to the door.")).toBe(false);
	});
});

describe("simple screenplay round-trip", () => {
	test("scene + action + two dialogue groups + transition", () => {
		let screenplay = "";
		screenplay += "INT. OFFICE - DAY\n";
		screenplay += "\n";
		screenplay += "John enters the room.\n";
		screenplay += "\n";
		screenplay += "                    JOHN\n"; // 20 sp
		screenplay += "          Hello, everyone!\n"; // 10 sp
		screenplay += "\n";
		screenplay += "                    MARY\n"; // 20 sp
		screenplay += "          Hi, John.\n"; // 10 sp
		screenplay += "\n";
		screenplay += "                                            FADE OUT.\n"; // 44 sp

		const csv = convertScreenplayToCsv({ content: screenplay });

		expect(csv.startsWith("Transition,Scene,Action,Character,Parenthetical,Dialogue\n")).toBe(true);
		expect(csv).toContain(",INT. OFFICE - DAY,,,,");
		expect(csv).toContain(",,John enters the room.,,,");
		expect(csv).toContain(',,,JOHN,,"Hello, everyone!"');
		expect(csv).toContain(',,,MARY,,"Hi, John."');
		expect(csv).toContain("FADE OUT.");
	});
});

describe("parenthetical", () => {
	test("character + parenthetical + dialogue on one row", () => {
		let screenplay = "";
		screenplay += "                    JOHN\n"; // 20 sp — Character
		screenplay += "               (nervously)\n"; // 15 sp — Parenthetical
		screenplay += "          I don't know what to say.\n"; // 10 sp — Dialogue

		const csv = convertScreenplayToCsv({ content: screenplay });
		expect(csv).toContain(",,,JOHN,(nervously),I don't know what to say.");
	});
});

describe("multi-line action", () => {
	test("three consecutive action lines collapse into one cell", () => {
		const screenplay = [
			"John walks to the window.",
			"He looks outside at the rain.",
			"The streets are empty.",
		].join("\n");

		const csv = convertScreenplayToCsv({ content: screenplay });
		expect(csv).toContain(
			",,John walks to the window. He looks outside at the rain. The streets are empty.,,,",
		);
	});
});

describe("All About Eve sample", () => {
	test("full text parses into the expected headings, characters, and transitions", () => {
		// resources/ ships at repo root alongside backend/src/. The test runs
		// from the repo root (bun test is invoked via bun from there), so
		// path.resolve anchors there too.
		const samplePath = resolve(process.cwd(), "resources/sample_aae_fulltext.txt");
		const screenplay = readFileSync(samplePath, "utf-8");
		const csv = convertScreenplayToCsv({ content: screenplay });

		expect(csv.startsWith("Transition,Scene,Action,Character,Parenthetical,Dialogue\n")).toBe(true);
		expect(csv).toContain("INT. EVE'S HOTEL APARTMENT - NIGHT");
		expect(csv).toContain(",,,EVE,");
		expect(csv).toContain(",,,GIRL,");
		expect(csv).toContain(",,,ADDISON,");
		expect(csv).toContain(",,,PHOEBE,");
		expect(csv).toContain("FADE OUT.");
		expect(csv).toContain(",(pauses),");
	});
});
