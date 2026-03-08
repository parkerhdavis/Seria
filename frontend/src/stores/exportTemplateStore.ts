/**
 * Export Template Store
 *
 * Zustand store for managing export templates.
 * Handles built-in and custom templates, template CRUD operations,
 * and the export execution logic.
 */

import { create } from "zustand";
import type { ExportTemplate, TransformFunction } from "@/types/exportTemplate";
import { BUILT_IN_TEMPLATES } from "@/data/exportTemplates";
import { invoke } from "@tauri-apps/api/core";
import { logger } from "@utils/logger";

interface ExportTemplateStore {
    /** All available templates (built-in + custom) */
    templates: ExportTemplate[];
    /** Currently selected template ID */
    selectedTemplateId: string | null;
    /** Whether templates have been loaded */
    isLoaded: boolean;

    /** Load all templates (built-in + custom from storage) */
    loadTemplates: () => Promise<void>;
    /** Save a custom template */
    saveCustomTemplate: (template: ExportTemplate) => Promise<void>;
    /** Delete a custom template */
    deleteCustomTemplate: (id: string) => Promise<void>;
    /** Select a template */
    selectTemplate: (id: string) => void;
    /** Get currently selected template */
    getSelectedTemplate: () => ExportTemplate | null;
    /** Execute export with a template */
    executeExport: (
        template: ExportTemplate,
        headers: string[],
        data: string[][]
    ) => string;
}

/**
 * Apply a transform function to a cell value.
 *
 * @param value - Raw cell value
 * @param transform - Transform function to apply
 * @returns Transformed value
 */
function applyTransform(value: string, transform?: TransformFunction): string {
    if (!transform) return value;

    switch (transform) {
        case "uppercase":
            return value.toUpperCase();
        case "lowercase":
            return value.toLowerCase();
        case "trim":
            return value.trim();
        case "parseNumber": {
            const num = Number(value);
            return isNaN(num) ? "0" : String(num);
        }
        case "parseBoolean":
            return ["true", "1", "yes", "on"].includes(value.toLowerCase())
                ? "true"
                : "false";
        case "escapeHtml":
            return value
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#39;");
        case "escapeJson":
            return value
                .replace(/\\/g, "\\\\")
                .replace(/"/g, '\\"')
                .replace(/\n/g, "\\n")
                .replace(/\r/g, "\\r")
                .replace(/\t/g, "\\t");
        default:
            return value;
    }
}

/**
 * Generate a JSON object string for a single row.
 *
 * @param headers - Column headers
 * @param row - Row data
 * @param template - Export template
 * @param indent - Indentation string
 * @returns JSON object string
 */
function generateRowJson(
    headers: string[],
    row: string[],
    template: ExportTemplate,
    indent: string
): string {
    const fields: Record<string, string> = {};

    if (template.fieldMappings.length > 0) {
        // Use explicit field mappings
        for (const mapping of template.fieldMappings) {
            const colIdx = headers.indexOf(mapping.csvColumn);
            let value = colIdx >= 0 ? (row[colIdx] || "") : (mapping.defaultValue || "");
            value = applyTransform(value, mapping.transform);

            if (!template.options.includeEmpty && !value) continue;
            fields[mapping.exportField] = value;
        }
    } else {
        // Auto-map: use all columns with headers as keys
        for (let i = 0; i < headers.length; i++) {
            const value = row[i] || "";
            if (!template.options.includeEmpty && !value) continue;
            fields[headers[i]] = value;
        }
    }

    // Build JSON object
    const entries = Object.entries(fields).map(([key, val]) => {
        // Attempt to preserve numeric and boolean types
        const num = Number(val);
        if (val !== "" && !isNaN(num) && val.trim() === String(num)) {
            return `${indent}"${key}": ${num}`;
        }
        if (val === "true" || val === "false") {
            return `${indent}"${key}": ${val}`;
        }
        const escaped = val.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
        return `${indent}"${key}": "${escaped}"`;
    });

    if (template.options.prettyPrint) {
        return `{\n${entries.join(",\n")}\n${indent.slice(0, -2) || ""}}`
            .replace(/\n\n/g, "\n");
    }
    return `{${entries.join(", ")}}`;
}

/**
 * Generate YAML fields for a single row.
 */
function generateRowYaml(headers: string[], row: string[], template: ExportTemplate): string {
    const lines: string[] = [];
    const mappings = template.fieldMappings.length > 0 ? template.fieldMappings : null;

    if (mappings) {
        for (const mapping of mappings) {
            const colIdx = headers.indexOf(mapping.csvColumn);
            let value = colIdx >= 0 ? (row[colIdx] || "") : (mapping.defaultValue || "");
            value = applyTransform(value, mapping.transform);
            if (!template.options.includeEmpty && !value) continue;
            lines.push(`  ${mapping.exportField}: "${value}"`);
        }
    } else {
        for (let i = 0; i < headers.length; i++) {
            const value = row[i] || "";
            if (!template.options.includeEmpty && !value) continue;
            // Sanitize key for YAML
            const key = headers[i].replace(/[^a-zA-Z0-9_]/g, "_");
            lines.push(`  ${key}: "${value}"`);
        }
    }

    return lines.join("\n");
}

/**
 * Generate XML fields for a single row.
 */
function generateRowXml(headers: string[], row: string[], template: ExportTemplate): string {
    const lines: string[] = [];
    const mappings = template.fieldMappings.length > 0 ? template.fieldMappings : null;

    if (mappings) {
        for (const mapping of mappings) {
            const colIdx = headers.indexOf(mapping.csvColumn);
            let value = colIdx >= 0 ? (row[colIdx] || "") : (mapping.defaultValue || "");
            value = applyTransform(value, mapping.transform);
            if (!template.options.includeEmpty && !value) continue;
            const escapedValue = value
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;");
            lines.push(`    <${mapping.exportField}>${escapedValue}</${mapping.exportField}>`);
        }
    } else {
        for (let i = 0; i < headers.length; i++) {
            const value = row[i] || "";
            if (!template.options.includeEmpty && !value) continue;
            const tag = headers[i].replace(/[^a-zA-Z0-9_]/g, "_");
            const escapedValue = value
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;");
            lines.push(`    <${tag}>${escapedValue}</${tag}>`);
        }
    }

    return lines.join("\n");
}

/**
 * Process a custom template row by replacing placeholders.
 * Supports {columnName} and {N} (0-indexed column) placeholders.
 */
function processCustomTemplate(
    rowTemplate: string,
    headers: string[],
    row: string[],
    template: ExportTemplate
): string {
    let result = rowTemplate;

    // Replace {N} numeric placeholders
    for (let i = 0; i < row.length; i++) {
        result = result.replace(new RegExp(`\\{${i}\\}`, "g"), row[i] || "");
    }

    // Replace {columnName} placeholders
    for (let i = 0; i < headers.length; i++) {
        const value = row[i] || "";
        result = result.replace(new RegExp(`\\{${headers[i].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\}`, "g"), value);
    }

    // Replace special composite placeholders
    if (result.includes("{row_json}")) {
        const indent = "    ";
        result = result.replace("{row_json}", generateRowJson(headers, row, template, indent));
    }
    if (result.includes("{row_fields_yaml}")) {
        result = result.replace("{row_fields_yaml}", "\n" + generateRowYaml(headers, row, template));
    }
    if (result.includes("{row_fields_xml}")) {
        result = result.replace("{row_fields_xml}", generateRowXml(headers, row, template));
    }
    if (result.includes("{row_fields}")) {
        // Generic key:value fields
        const fields = headers.map((h, i) => {
            const val = row[i] || "";
            const escaped = val.replace(/"/g, '\\"');
            return `"${h}": "${escaped}"`;
        });
        result = result.replace("{row_fields}", fields.join(", "));
    }
    if (result.includes("{row_fields_godot}")) {
        const fields = headers.map((h, i) => {
            const key = h.replace(/[^a-zA-Z0-9_]/g, "_");
            return `${key} = "${row[i] || ""}"`;
        });
        result = result.replace("{row_fields_godot}", fields.join("\n"));
    }

    return result;
}

export const useExportTemplateStore = create<ExportTemplateStore>((set, get) => ({
    templates: [],
    selectedTemplateId: null,
    isLoaded: false,

    loadTemplates: async () => {
        try {
            // Start with built-in templates
            const templates = [...BUILT_IN_TEMPLATES];

            // Try to load custom templates from storage
            try {
                const customJson = await invoke<string>("load_preferences", {});
                const prefs = JSON.parse(customJson);
                if (prefs.exportTemplates && Array.isArray(prefs.exportTemplates)) {
                    templates.push(...prefs.exportTemplates);
                }
            } catch {
                // No custom templates yet, that's fine
                logger.debug("No custom export templates found");
            }

            set({ templates, isLoaded: true });
        } catch (error: unknown) {
            logger.error("Failed to load export templates:", error);
            set({ templates: [...BUILT_IN_TEMPLATES], isLoaded: true });
        }
    },

    saveCustomTemplate: async (template: ExportTemplate) => {
        try {
            const { templates } = get();
            const existingIdx = templates.findIndex((t) => t.id === template.id);
            const updatedTemplates =
                existingIdx >= 0
                    ? templates.map((t) => (t.id === template.id ? template : t))
                    : [...templates, template];

            set({ templates: updatedTemplates });

            // Persist custom templates
            const customTemplates = updatedTemplates.filter((t) => !t.isBuiltIn);
            try {
                const prefsJson = await invoke<string>("load_preferences", {});
                const prefs = JSON.parse(prefsJson);
                prefs.exportTemplates = customTemplates;
                await invoke("save_preferences", { data: JSON.stringify(prefs) });
            } catch {
                logger.warn("Failed to persist custom export templates");
            }
        } catch (error: unknown) {
            logger.error("Failed to save export template:", error);
        }
    },

    deleteCustomTemplate: async (id: string) => {
        try {
            const { templates } = get();
            const template = templates.find((t) => t.id === id);
            if (template?.isBuiltIn) {
                logger.warn("Cannot delete built-in templates");
                return;
            }

            const updatedTemplates = templates.filter((t) => t.id !== id);
            set({ templates: updatedTemplates });

            // Persist
            const customTemplates = updatedTemplates.filter((t) => !t.isBuiltIn);
            try {
                const prefsJson = await invoke<string>("load_preferences", {});
                const prefs = JSON.parse(prefsJson);
                prefs.exportTemplates = customTemplates;
                await invoke("save_preferences", { data: JSON.stringify(prefs) });
            } catch {
                logger.warn("Failed to persist export template deletion");
            }
        } catch (error: unknown) {
            logger.error("Failed to delete export template:", error);
        }
    },

    selectTemplate: (id: string) => {
        set({ selectedTemplateId: id });
    },

    getSelectedTemplate: () => {
        const { templates, selectedTemplateId } = get();
        return templates.find((t) => t.id === selectedTemplateId) || null;
    },

    executeExport: (
        template: ExportTemplate,
        headers: string[],
        data: string[][]
    ): string => {
        const rows: string[] = [];

        for (const row of data) {
            let rowStr: string;

            switch (template.outputFormat) {
                case "json": {
                    const indent = " ".repeat(template.options.indentation);
                    // If template uses {row_json} or custom format, process as custom
                    if (template.rowTemplate.includes("{row_json}") || template.rowTemplate.includes("{")) {
                        rowStr = processCustomTemplate(template.rowTemplate, headers, row, template);
                    } else {
                        rowStr = indent + generateRowJson(headers, row, template, indent + "  ");
                    }
                    break;
                }
                case "yaml": {
                    if (template.rowTemplate.includes("{row_fields_yaml}") || template.rowTemplate.includes("{")) {
                        rowStr = processCustomTemplate(template.rowTemplate, headers, row, template);
                    } else {
                        rowStr = "- " + generateRowYaml(headers, row, template);
                    }
                    break;
                }
                case "xml": {
                    if (template.rowTemplate.includes("{row_fields_xml}") || template.rowTemplate.includes("{")) {
                        rowStr = processCustomTemplate(template.rowTemplate, headers, row, template);
                    } else {
                        rowStr = "  <row>\n" + generateRowXml(headers, row, template) + "\n  </row>";
                    }
                    break;
                }
                case "custom":
                default:
                    rowStr = processCustomTemplate(template.rowTemplate, headers, row, template);
                    break;
            }

            rows.push(rowStr);
        }

        return template.headerTemplate + rows.join(template.rowSeparator) + template.footerTemplate;
    },
}));
