/**
 * Export Template Store
 *
 * Zustand store for managing export templates.
 * Handles built-in and custom templates, template CRUD operations,
 * and the export execution logic (delegated to the data transformation pipeline).
 */

import { create } from "zustand";
import type { ExportTemplate } from "@/types/exportTemplate";
import { BUILT_IN_TEMPLATES } from "@/data/exportTemplates";
import { invoke } from "@tauri-apps/api/core";
import { logger } from "@utils/logger";
import { serializeWithTemplate } from "@utils/dataTransformationPipeline";

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
    data: string[][],
  ) => string;
}

export const useExportTemplateStore = create<ExportTemplateStore>(
  (set, get) => ({
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
      data: string[][],
    ): string => {
      // Delegate to the centralized data transformation pipeline
      return serializeWithTemplate({ headers, data }, template);
    },
  }),
);
