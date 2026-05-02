// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Tests for dataTransformationPipeline utility
 *
 * Tests the centralized data transformation pipeline including
 * parse, transform, and serialize stages.
 */

import { describe, it, expect } from "bun:test";
import {
  parse,
  delimiterFromPath,
  filterRows,
  mapRows,
  selectColumns,
  renameColumns,
  transformColumn,
  removeEmptyRows,
  sortByColumn,
  serializeToCsv,
  serializeWithTemplate,
  executePipeline,
  executePipelineWithTemplate,
  applyTransforms,
  transformToScreenplayElements,
  transformToCards,
  transformToRenderedElements,
} from "@utils/dataTransformationPipeline";
import type { CellData } from "@/types/cellData";
import type { ExportTemplate } from "@/types/exportTemplate";
import type { PrintRecipe, RecipeConfiguration } from "@/types/printRecipe";

// ============================================================================
// Parse Stage Tests
// ============================================================================

describe("parse", () => {
  it("parses comma-separated CSV with auto-detection", () => {
    const result = parse("Name,Age,City\nAlice,30,NYC\nBob,25,LA");

    expect(result.data.headers).toEqual(["Name", "Age", "City"]);
    expect(result.data.data).toEqual([
      ["Alice", "30", "NYC"],
      ["Bob", "25", "LA"],
    ]);
    expect(result.delimiter).toBe(",");
    expect(result.warnings).toEqual([]);
  });

  it("parses tab-separated TSV with auto-detection", () => {
    const result = parse("Name\tAge\nAlice\t30");

    expect(result.data.headers).toEqual(["Name", "Age"]);
    expect(result.data.data).toEqual([["Alice", "30"]]);
    expect(result.delimiter).toBe("\t");
  });

  it("respects override delimiter", () => {
    const result = parse("Name;Age\nAlice;30", { delimiter: ";" });

    expect(result.data.headers).toEqual(["Name", "Age"]);
    expect(result.data.data).toEqual([["Alice", "30"]]);
    expect(result.delimiter).toBe(";");
  });

  it("handles firstRowIsHeaders=false", () => {
    const result = parse("Alice,30\nBob,25", { firstRowIsHeaders: false });

    expect(result.data.headers).toEqual(["Column 1", "Column 2"]);
    expect(result.data.data).toEqual([
      ["Alice", "30"],
      ["Bob", "25"],
    ]);
  });

  it("returns empty data for empty input", () => {
    const result = parse("");

    expect(result.data.headers).toEqual([]);
    expect(result.data.data).toEqual([]);
  });

  it("handles quoted fields with commas", () => {
    const result = parse('Name,Bio\nAlice,"Likes cats, dogs"');

    expect(result.data.headers).toEqual(["Name", "Bio"]);
    expect(result.data.data).toEqual([["Alice", "Likes cats, dogs"]]);
  });

  it("handles headers-only input", () => {
    const result = parse("Name,Age,City");

    expect(result.data.headers).toEqual(["Name", "Age", "City"]);
    expect(result.data.data).toEqual([]);
  });
});

describe("delimiterFromPath", () => {
  it("returns tab for .tsv files", () => {
    expect(delimiterFromPath("/path/to/file.tsv")).toBe("\t");
  });

  it("returns comma for .csv files", () => {
    expect(delimiterFromPath("/path/to/file.csv")).toBe(",");
  });

  it("returns comma for .cell files", () => {
    expect(delimiterFromPath("/path/to/file.cell")).toBe(",");
  });

  it("returns comma for unknown extensions", () => {
    expect(delimiterFromPath("/path/to/file.txt")).toBe(",");
  });
});

// ============================================================================
// Transform Stage Tests — Built-in Transforms
// ============================================================================

const sampleData: CellData = {
  headers: ["Name", "Age", "City"],
  data: [
    ["Alice", "30", "NYC"],
    ["Bob", "25", "LA"],
    ["Charlie", "35", "Chicago"],
    ["", "", ""],
  ],
};

describe("filterRows", () => {
  it("filters rows based on predicate", () => {
    const step = filterRows("age>25", (row, _, headers) => {
      const ageIdx = headers.indexOf("Age");
      return Number(row[ageIdx]) > 25;
    });

    const result = step.execute(sampleData);
    expect(result.data).toHaveLength(2);
    expect(result.data[0][0]).toBe("Alice");
    expect(result.data[1][0]).toBe("Charlie");
  });

  it("preserves headers", () => {
    const step = filterRows("all", () => true);
    const result = step.execute(sampleData);
    expect(result.headers).toEqual(sampleData.headers);
  });
});

describe("mapRows", () => {
  it("transforms each row", () => {
    const step = mapRows("uppercase-name", (row) => {
      return [row[0].toUpperCase(), row[1], row[2]];
    });

    const result = step.execute(sampleData);
    expect(result.data[0][0]).toBe("ALICE");
    expect(result.data[1][0]).toBe("BOB");
  });
});

describe("selectColumns", () => {
  it("selects specified columns in order", () => {
    const step = selectColumns(["City", "Name"]);
    const result = step.execute(sampleData);

    expect(result.headers).toEqual(["City", "Name"]);
    expect(result.data[0]).toEqual(["NYC", "Alice"]);
  });

  it("ignores non-existent columns", () => {
    const step = selectColumns(["Name", "NonExistent"]);
    const result = step.execute(sampleData);

    expect(result.headers).toEqual(["Name"]);
    expect(result.data[0]).toEqual(["Alice"]);
  });
});

describe("renameColumns", () => {
  it("renames specified columns", () => {
    const step = renameColumns({ Name: "FullName", City: "Location" });
    const result = step.execute(sampleData);

    expect(result.headers).toEqual(["FullName", "Age", "Location"]);
    // Data unchanged
    expect(result.data[0]).toEqual(["Alice", "30", "NYC"]);
  });

  it("leaves unmapped columns unchanged", () => {
    const step = renameColumns({ Name: "FullName" });
    const result = step.execute(sampleData);

    expect(result.headers).toEqual(["FullName", "Age", "City"]);
  });
});

describe("transformColumn", () => {
  it("applies uppercase transform to a column", () => {
    const step = transformColumn("Name", "uppercase");
    const result = step.execute(sampleData);

    expect(result.data[0][0]).toBe("ALICE");
    expect(result.data[1][0]).toBe("BOB");
    // Other columns unchanged
    expect(result.data[0][1]).toBe("30");
  });

  it("does nothing for non-existent column", () => {
    const step = transformColumn("NonExistent", "uppercase");
    const result = step.execute(sampleData);

    expect(result).toEqual(sampleData);
  });

  it("applies parseNumber transform", () => {
    const step = transformColumn("Age", "parseNumber");
    const result = step.execute(sampleData);

    expect(result.data[0][1]).toBe("30");
    expect(result.data[3][1]).toBe("0"); // Empty string -> "0"
  });
});

describe("removeEmptyRows", () => {
  it("removes rows where all cells are empty/whitespace", () => {
    const step = removeEmptyRows();
    const result = step.execute(sampleData);

    expect(result.data).toHaveLength(3);
    expect(result.data.map((r) => r[0])).toEqual(["Alice", "Bob", "Charlie"]);
  });
});

describe("sortByColumn", () => {
  it("sorts ascending by default", () => {
    const step = sortByColumn("Name");
    const result = step.execute(sampleData);

    expect(result.data[0][0]).toBe(""); // empty sorts first
    expect(result.data[1][0]).toBe("Alice");
    expect(result.data[2][0]).toBe("Bob");
    expect(result.data[3][0]).toBe("Charlie");
  });

  it("sorts descending", () => {
    const step = sortByColumn("Name", "desc");
    const result = step.execute(sampleData);

    expect(result.data[0][0]).toBe("Charlie");
    expect(result.data[1][0]).toBe("Bob");
    expect(result.data[2][0]).toBe("Alice");
  });

  it("sorts numerically when values are numbers", () => {
    const step = sortByColumn("Age");
    const dataWithoutEmpty: CellData = {
      headers: sampleData.headers,
      data: sampleData.data.filter((r) => r[0] !== ""),
    };
    const result = step.execute(dataWithoutEmpty);

    expect(result.data[0][1]).toBe("25");
    expect(result.data[1][1]).toBe("30");
    expect(result.data[2][1]).toBe("35");
  });
});

describe("applyTransforms", () => {
  it("chains multiple transforms", () => {
    const result = applyTransforms(sampleData, [
      removeEmptyRows(),
      transformColumn("Name", "uppercase"),
      selectColumns(["Name", "City"]),
    ]);

    expect(result.headers).toEqual(["Name", "City"]);
    expect(result.data).toHaveLength(3);
    expect(result.data[0]).toEqual(["ALICE", "NYC"]);
  });
});

// ============================================================================
// Serialize Stage Tests
// ============================================================================

describe("serializeToCsv", () => {
  const testData: CellData = {
    headers: ["Name", "Age"],
    data: [
      ["Alice", "30"],
      ["Bob", "25"],
    ],
  };

  it("serializes with comma delimiter", () => {
    const result = serializeToCsv(testData, { delimiter: "," });

    expect(result).toContain("Name");
    expect(result).toContain("Alice");
    // Should have headers and 2 data rows
    const lines = result.split("\n");
    expect(lines).toHaveLength(3);
  });

  it("serializes with tab delimiter", () => {
    const result = serializeToCsv(testData, { delimiter: "\t" });

    expect(result).toContain("\t");
  });

  it("excludes headers when includeHeaders is false", () => {
    const result = serializeToCsv(testData, { includeHeaders: false });

    const lines = result.split("\n");
    expect(lines).toHaveLength(2);
    expect(result).not.toContain("Name");
  });
});

describe("serializeWithTemplate", () => {
  const testData: CellData = {
    headers: ["Name", "Age"],
    data: [
      ["Alice", "30"],
      ["Bob", "25"],
    ],
  };

  it("serializes with JSON array template", () => {
    const template: ExportTemplate = {
      id: "test-json",
      name: "Test JSON",
      description: "",
      outputFormat: "json",
      fieldMappings: [],
      headerTemplate: "[\n",
      rowTemplate: "  {row_json}",
      footerTemplate: "\n]",
      rowSeparator: ",\n",
      options: {
        prettyPrint: true,
        indentation: 2,
        encoding: "utf-8",
        fileExtension: "json",
        includeEmpty: false,
      },
      isBuiltIn: true,
      category: "General",
    };

    const result = serializeWithTemplate(testData, template);

    expect(result).toContain("[");
    expect(result).toContain("]");
    expect(result).toContain("Alice");
    expect(result).toContain("30");
  });

  it("serializes with custom template using column placeholders", () => {
    const template: ExportTemplate = {
      id: "test-custom",
      name: "Test Custom",
      description: "",
      outputFormat: "custom",
      fieldMappings: [],
      headerTemplate: "-- START --\n",
      rowTemplate: "{Name} is {Age} years old",
      footerTemplate: "\n-- END --",
      rowSeparator: "\n",
      options: {
        prettyPrint: false,
        indentation: 0,
        encoding: "utf-8",
        fileExtension: "txt",
        includeEmpty: true,
      },
      isBuiltIn: false,
      category: "Custom",
    };

    const result = serializeWithTemplate(testData, template);

    expect(result).toContain("-- START --");
    expect(result).toContain("Alice is 30 years old");
    expect(result).toContain("Bob is 25 years old");
    expect(result).toContain("-- END --");
  });

  it("serializes with numeric index placeholders", () => {
    const template: ExportTemplate = {
      id: "test-idx",
      name: "Test Index",
      description: "",
      outputFormat: "custom",
      fieldMappings: [],
      headerTemplate: "",
      rowTemplate: "{0}: {1}",
      footerTemplate: "",
      rowSeparator: "\n",
      options: {
        prettyPrint: false,
        indentation: 0,
        encoding: "utf-8",
        fileExtension: "txt",
        includeEmpty: true,
      },
      isBuiltIn: false,
      category: "Custom",
    };

    const result = serializeWithTemplate(testData, template);
    expect(result).toBe("Alice: 30\nBob: 25");
  });
});

// ============================================================================
// Full Pipeline Tests
// ============================================================================

describe("executePipeline", () => {
  it("runs complete parse -> transform -> serialize pipeline", () => {
    const input = "Name,Age,City\nAlice,30,NYC\nBob,25,LA\n,,";
    const output = executePipeline(input, {
      transforms: [removeEmptyRows(), selectColumns(["Name", "City"])],
      serializeOptions: { delimiter: "\t" },
    });

    const lines = output.split("\n");
    expect(lines).toHaveLength(3); // header + 2 data rows
    expect(lines[0]).toContain("\t");
  });

  it("preserves original delimiter when none specified", () => {
    const input = "Name\tAge\nAlice\t30";
    const output = executePipeline(input, {});

    expect(output).toContain("\t");
  });
});

describe("executePipelineWithTemplate", () => {
  it("runs parse -> transform -> template serialize pipeline", () => {
    const input = "Name,Age\nAlice,30\nBob,25";
    const template: ExportTemplate = {
      id: "test",
      name: "Test",
      description: "",
      outputFormat: "custom",
      fieldMappings: [],
      headerTemplate: "People:\n",
      rowTemplate: "- {Name} ({Age})",
      footerTemplate: "",
      rowSeparator: "\n",
      options: {
        prettyPrint: false,
        indentation: 0,
        encoding: "utf-8",
        fileExtension: "txt",
        includeEmpty: true,
      },
      isBuiltIn: false,
      category: "Custom",
    };

    const output = executePipelineWithTemplate(input, template, undefined, [
      transformColumn("Name", "uppercase"),
    ]);

    expect(output).toContain("People:");
    expect(output).toContain("- ALICE (30)");
    expect(output).toContain("- BOB (25)");
  });
});

// ============================================================================
// Recipe-Based Transform Tests
// ============================================================================

describe("transformToScreenplayElements", () => {
  const screenplayData: CellData = {
    headers: [
      "Scene",
      "Character",
      "Dialogue",
      "Action",
      "Parenthetical",
      "Transition",
    ],
    data: [
      ["INT. OFFICE - DAY", "", "", "", "", ""],
      ["", "ALICE", "Hello, Bob.", "Alice enters the room.", "(smiling)", ""],
      ["", "BOB", "Hi, Alice!", "", "", ""],
      ["", "", "", "", "", "FADE OUT."],
    ],
  };

  const recipe: PrintRecipe = {
    id: "screenplay",
    name: "Screenplay",
    description: "",
    type: "screenplay",
    ingredients: {
      scene_heading: {
        setup: {
          name: "Scene",
          description: "",
          required: true,
          autoMapKeywords: [],
        },
        style: {
          fontFamily: "Courier",
          fontSize: 12,
          textAlign: "left",
          xMargin: 0,
          spaceBeforeElement: 1,
          spaceAfterElement: 0,
        },
      },
      character: {
        setup: {
          name: "Character",
          description: "",
          required: true,
          autoMapKeywords: [],
        },
        style: {
          fontFamily: "Courier",
          fontSize: 12,
          textAlign: "left",
          xMargin: 0,
          spaceBeforeElement: 1,
          spaceAfterElement: 0,
        },
      },
      dialogue: {
        setup: {
          name: "Dialogue",
          description: "",
          required: false,
          autoMapKeywords: [],
        },
        style: {
          fontFamily: "Courier",
          fontSize: 12,
          textAlign: "left",
          xMargin: 0,
          spaceBeforeElement: 0,
          spaceAfterElement: 0,
        },
      },
      action: {
        setup: {
          name: "Action",
          description: "",
          required: false,
          autoMapKeywords: [],
        },
        style: {
          fontFamily: "Courier",
          fontSize: 12,
          textAlign: "left",
          xMargin: 0,
          spaceBeforeElement: 0,
          spaceAfterElement: 0,
        },
      },
      parenthetical: {
        setup: {
          name: "Parenthetical",
          description: "",
          required: false,
          autoMapKeywords: [],
        },
        style: {
          fontFamily: "Courier",
          fontSize: 12,
          textAlign: "left",
          xMargin: 0,
          spaceBeforeElement: 0,
          spaceAfterElement: 0,
        },
      },
      transition: {
        setup: {
          name: "Transition",
          description: "",
          required: false,
          autoMapKeywords: [],
        },
        style: {
          fontFamily: "Courier",
          fontSize: 12,
          textAlign: "left",
          xMargin: 0,
          spaceBeforeElement: 0,
          spaceAfterElement: 0,
        },
      },
    },
    documentSettings: {},
    version: "1.0",
    isCustom: false,
  };

  const configuration: RecipeConfiguration = {
    recipeId: "screenplay",
    fieldMappings: [
      {
        ingredientId: "scene_heading",
        cellColumn: "Scene",
        isAutoMapped: true,
      },
      {
        ingredientId: "character",
        cellColumn: "Character",
        isAutoMapped: true,
      },
      { ingredientId: "dialogue", cellColumn: "Dialogue", isAutoMapped: true },
      { ingredientId: "action", cellColumn: "Action", isAutoMapped: true },
      {
        ingredientId: "parenthetical",
        cellColumn: "Parenthetical",
        isAutoMapped: true,
      },
      {
        ingredientId: "transition",
        cellColumn: "Transition",
        isAutoMapped: true,
      },
    ],
    renderSettings: {},
    lastModified: new Date(),
  };

  it("transforms CSV data to screenplay elements", () => {
    const elements = transformToScreenplayElements(
      screenplayData,
      recipe,
      configuration,
    );

    expect(elements.length).toBeGreaterThan(0);
  });

  it("creates scene_heading elements with scene numbers", () => {
    const elements = transformToScreenplayElements(
      screenplayData,
      recipe,
      configuration,
    );
    const sceneHeadings = elements.filter((e) => e.type === "scene_heading");

    expect(sceneHeadings).toHaveLength(1);
    expect(sceneHeadings[0].content).toBe("INT. OFFICE - DAY");
    expect(sceneHeadings[0].sceneNumber).toBe(1);
  });

  it("creates character + parenthetical + dialogue blocks", () => {
    const elements = transformToScreenplayElements(
      screenplayData,
      recipe,
      configuration,
    );
    const characters = elements.filter((e) => e.type === "character");
    const dialogues = elements.filter((e) => e.type === "dialogue");
    const parentheticals = elements.filter((e) => e.type === "parenthetical");

    expect(characters).toHaveLength(2);
    expect(dialogues).toHaveLength(2);
    expect(parentheticals).toHaveLength(1);
    expect(parentheticals[0].content).toBe("(smiling)");
  });

  it("creates transitions", () => {
    const elements = transformToScreenplayElements(
      screenplayData,
      recipe,
      configuration,
    );
    const transitions = elements.filter((e) => e.type === "transition");

    expect(transitions).toHaveLength(1);
    expect(transitions[0].content).toBe("FADE OUT.");
  });

  it("respects editing cell override", () => {
    const elements = transformToScreenplayElements(
      screenplayData,
      recipe,
      configuration,
      { row: 1, col: 1 }, // Character column of row 1
      "CHARLIE",
    );

    const characters = elements.filter((e) => e.type === "character");
    expect(characters[0].content).toBe("CHARLIE");
  });

  it("prioritizes transition over other elements", () => {
    const dataWithTransition: CellData = {
      headers: [
        "Scene",
        "Character",
        "Dialogue",
        "Action",
        "Parenthetical",
        "Transition",
      ],
      data: [["", "ALICE", "Hello", "walks in", "", "FADE IN:"]],
    };

    const elements = transformToScreenplayElements(
      dataWithTransition,
      recipe,
      configuration,
    );

    // Transition takes priority, so character/dialogue/action should be skipped
    expect(elements).toHaveLength(1);
    expect(elements[0].type).toBe("transition");
  });
});

describe("transformToCards", () => {
  const cardData: CellData = {
    headers: ["Title", "Subtitle", "Body", "Notes"],
    data: [
      ["Card 1", "Intro", "Hello World", "Note 1"],
      ["Card 2", "Middle", "Test", "Note 2"],
    ],
  };

  const configuration: RecipeConfiguration = {
    recipeId: "corkboard",
    fieldMappings: [
      { ingredientId: "title", cellColumn: "Title", isAutoMapped: true },
      { ingredientId: "subtitle", cellColumn: "Subtitle", isAutoMapped: true },
      { ingredientId: "content", cellColumn: "Body", isAutoMapped: true },
      {
        ingredientId: "content",
        cellColumn: "Notes",
        isAutoMapped: true,
        order: 1,
      },
    ],
    renderSettings: {},
    lastModified: new Date(),
  };

  it("transforms CSV data to card data", () => {
    const cards = transformToCards(cardData, configuration);

    expect(cards).toHaveLength(2);
    expect(cards[0].title).toBe("Card 1");
    expect(cards[0].subtitle).toBe("Intro");
    expect(cards[0].content).toEqual(["Hello World", "Note 1"]);
  });

  it("includes column name metadata", () => {
    const cards = transformToCards(cardData, configuration);

    expect(cards[0].titleColumnName).toBe("Title");
    expect(cards[0].subtitleColumnName).toBe("Subtitle");
    expect(cards[0].contentColumnNames).toEqual(["Body", "Notes"]);
  });

  it("respects editing cell override", () => {
    const cards = transformToCards(
      cardData,
      configuration,
      { row: 0, col: 0 }, // Title of first card
      "Edited Title",
    );

    expect(cards[0].title).toBe("Edited Title");
    expect(cards[1].title).toBe("Card 2"); // Unchanged
  });

  it("preserves row indices", () => {
    const cards = transformToCards(cardData, configuration);

    expect(cards[0].index).toBe(0);
    expect(cards[1].index).toBe(1);
  });
});

describe("transformToRenderedElements", () => {
  const data: CellData = {
    headers: ["Title", "Body"],
    data: [
      ["Hello", "World"],
      ["", "Only body"],
      ["Only title", ""],
    ],
  };

  const recipe: PrintRecipe = {
    id: "test",
    name: "Test",
    description: "",
    type: "custom",
    ingredients: {
      title: {
        setup: {
          name: "Title",
          description: "",
          required: true,
          autoMapKeywords: [],
        },
        style: {
          fontFamily: "Courier",
          fontSize: 14,
          textAlign: "left",
          xMargin: 0,
          spaceBeforeElement: 0,
          spaceAfterElement: 0,
        },
      },
      body: {
        setup: {
          name: "Body",
          description: "",
          required: false,
          autoMapKeywords: [],
        },
        style: {
          fontFamily: "Courier",
          fontSize: 12,
          textAlign: "left",
          xMargin: 0,
          spaceBeforeElement: 0,
          spaceAfterElement: 0,
        },
      },
    },
    documentSettings: {},
    version: "1.0",
    isCustom: false,
  };

  const configuration: RecipeConfiguration = {
    recipeId: "test",
    fieldMappings: [
      { ingredientId: "title", cellColumn: "Title", isAutoMapped: true },
      { ingredientId: "body", cellColumn: "Body", isAutoMapped: true },
    ],
    renderSettings: {},
    lastModified: new Date(),
  };

  it("creates rendered elements from data", () => {
    const elements = transformToRenderedElements(data, recipe, configuration);

    // Row 0: title + body = 2, Row 1: body only = 1, Row 2: title only = 1
    expect(elements).toHaveLength(4);
  });

  it("skips empty content cells", () => {
    const elements = transformToRenderedElements(data, recipe, configuration);
    const titles = elements.filter((e) => e.ingredientId === "title");
    const bodies = elements.filter((e) => e.ingredientId === "body");

    expect(titles).toHaveLength(2); // "Hello" and "Only title"
    expect(bodies).toHaveLength(2); // "World" and "Only body"
  });

  it("includes correct styles from recipe", () => {
    const elements = transformToRenderedElements(data, recipe, configuration);
    const titleElement = elements.find((e) => e.ingredientId === "title");

    expect(titleElement?.style.fontSize).toBe(14);
  });
});
