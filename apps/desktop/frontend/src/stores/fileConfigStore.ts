/**
 * File Config Store
 *
 * Manages persistent per-file configurations using a hybrid multi-identifier approach.
 * This allows configs to survive file renames, moves, and other filesystem changes.
 *
 * Matching Algorithm Priority:
 * 1. Absolute path (fast path - most common case)
 * 2. OS file ID + filename + size (survives rename in same volume)
 * 3. Filename + parent directory + file size
 * 4. Partial content hash (first 1MB or 100 rows)
 */

import { create } from "zustand";
import { rpcCall } from "@utils/rpc";
import { logger } from "@/utils/logger";
// Re-export the RPC's canonical FileIdentifiers shape so the rest of the
// renderer can keep importing it from here without knowing about the RPC
// schema path. The port flipped `contentHashPartial`/`osFileId` from
// undefined-optional to nullable, so make that explicit at the seam.
import type { FileIdentifiers } from "@shared/rpc";
export type { FileIdentifiers };

// Per-recipe display settings
export interface RecipeDisplaySettings {
    continuous?: boolean;      // If false, shows gaps between pages
    followCell?: boolean;      // If false, won't scroll to element when Cell is edited
    theme?: string;            // Theme name (coming soon)
    gridSize?: number;         // Grid size for card layouts (columns for right drawer, rows for bottom)
}

// Per-file configuration data
export interface FileConfig {
    id: string;  // UUID for this config
    identifiers: FileIdentifiers;
    lastSeen: string;  // ISO timestamp
    config: {
        // Column display settings
        columnWidths?: Record<number, number>;
        columnOrder?: number[];  // Persistent column ordering (array of column indices)

        // Column summaries
        columnSummaries?: Record<string, string>;

        // Filtering and sorting (from filterStore)
        filters?: Array<{
            field: string;
            operation: string;
            value: string;
        }>;
        sortBy?: {
            field: string;
            direction: "asc" | "desc";
        } | null;
        groupBy?: string | null;

        // Display settings (from settingsStore)
        rowColoringMode?: string;
        rowColorFilter?: {
            field: string;
            operation: string;
            value: string;
            color: string;
        } | null;
        wrapText?: boolean;
        showColumnSeparators?: boolean;
        autoFitColumns?: boolean;
        hoverHighlightMode?: string;

        // Drawer settings (from drawerStore)
        drawerPosition?: "right" | "bottom" | null;
        rightDrawerSize?: number;
        bottomDrawerSize?: number;

        // Print recipe settings
        selectedRecipeId?: string;  // Currently selected recipe for this file
        recipeSettings?: Record<string, RecipeDisplaySettings>;  // Settings per recipe ID
    };
}

// Root structure for the config file
export interface FileConfigData {
    version: number;
    configs: FileConfig[];
}

// Store preferences for config management
interface ConfigPreferences {
    autoSaveConfigs: boolean;
    configRetentionDays: number;
    promptForAmbiguousMatches: boolean;
}

interface FileConfigStore {
    // State
    configData: FileConfigData | null;
    preferences: ConfigPreferences;
    isLoaded: boolean;

    // Actions
    loadConfigs: () => Promise<void>;
    saveConfigs: () => Promise<void>;
    findConfigForFile: (identifiers: FileIdentifiers) => FileConfig | null;
    saveConfigForFile: (identifiers: FileIdentifiers, config: FileConfig["config"]) => Promise<void>;
    exportConfigs: () => string;
    importConfigs: (jsonData: string) => Promise<void>;
    cleanupOldConfigs: (retentionDays?: number) => Promise<void>;
    updatePreferences: (preferences: Partial<ConfigPreferences>) => void;
}

export const useFileConfigStore = create<FileConfigStore>((set, get) => ({
    // Initial state
    configData: null,
    preferences: {
        autoSaveConfigs: true,
        configRetentionDays: 180,
        promptForAmbiguousMatches: true,
    },
    isLoaded: false,

    // Load configs from storage
    loadConfigs: async () => {
        try {
            const jsonData = await rpcCall.loadFileConfigs({});
            const data: FileConfigData = JSON.parse(jsonData);
            set({ configData: data, isLoaded: true });
        } catch (error: unknown) {
            // If file doesn't exist or is invalid, start with empty config
            logger.debug("No existing config file, starting fresh:", error);
            set({
                configData: {
                    version: 1,
                    configs: [],
                },
                isLoaded: true,
            });
        }
    },

    // Save configs to storage
    saveConfigs: async () => {
        const { configData } = get();
        if (!configData) return;

        try {
            const jsonData = JSON.stringify(configData, null, 2);
            await rpcCall.saveFileConfigs({ data: jsonData });
        } catch (error: unknown) {
            logger.error("Failed to save file configs:", error);
        }
    },

    // Find a config matching the given file identifiers
    findConfigForFile: (identifiers: FileIdentifiers): FileConfig | null => {
        const { configData } = get();
        if (!configData) return null;

        // Priority 1: Exact absolute path match
        let match = configData.configs.find(
            (c) => c.identifiers.absolutePath === identifiers.absolutePath
        );
        if (match) {
            logger.debug("Config found via absolute path match");
            return match;
        }

        // Priority 2: OS file ID + filename + size
        if (identifiers.osFileId) {
            match = configData.configs.find(
                (c) =>
                    c.identifiers.osFileId === identifiers.osFileId &&
                    c.identifiers.filename === identifiers.filename &&
                    c.identifiers.fileSize === identifiers.fileSize
            );
            if (match) {
                logger.debug("Config found via OS file ID match");
                return match;
            }
        }

        // Priority 3: Filename + parent directory + file size
        match = configData.configs.find(
            (c) =>
                c.identifiers.filename === identifiers.filename &&
                c.identifiers.parentDir === identifiers.parentDir &&
                c.identifiers.fileSize === identifiers.fileSize
        );
        if (match) {
            logger.debug("Config found via filename + parent + size match");
            return match;
        }

        // Priority 4: Partial content hash
        if (identifiers.contentHashPartial) {
            match = configData.configs.find(
                (c) =>
                    c.identifiers.contentHashPartial === identifiers.contentHashPartial &&
                    c.identifiers.filename === identifiers.filename
            );
            if (match) {
                logger.debug("Config found via content hash match");
                return match;
            }
        }

        logger.debug("No config found for file");
        return null;
    },

    // Save or update a config for a file
    saveConfigForFile: async (identifiers: FileIdentifiers, config: FileConfig["config"]) => {
        const { configData, preferences } = get();
        if (!configData) return;

        // Find existing config or create new one
        const existingIndex = configData.configs.findIndex(
            (c) => c.identifiers.absolutePath === identifiers.absolutePath
        );

        const now = new Date().toISOString();

        if (existingIndex >= 0) {
            // Update existing config
            configData.configs[existingIndex] = {
                ...configData.configs[existingIndex],
                identifiers,  // Update identifiers in case file moved
                lastSeen: now,
                config,
            };
        } else {
            // Create new config
            const newConfig: FileConfig = {
                id: crypto.randomUUID(),
                identifiers,
                lastSeen: now,
                config,
            };
            configData.configs.push(newConfig);
        }

        set({ configData: { ...configData } });

        // Auto-save if enabled
        if (preferences.autoSaveConfigs) {
            await get().saveConfigs();
        }
    },

    // Export configs as JSON string
    exportConfigs: (): string => {
        const { configData } = get();
        if (!configData) return "{}";

        const exportData = {
            version: configData.version,
            exported: new Date().toISOString(),
            configs: configData.configs,
            exportMode: "absolute",  // Could add "portable" mode later
        };

        return JSON.stringify(exportData, null, 2);
    },

    // Import configs from JSON string
    importConfigs: async (jsonData: string) => {
        try {
            const importedData = JSON.parse(jsonData);

            // Validate structure
            if (!importedData.configs || !Array.isArray(importedData.configs)) {
                throw new Error("Invalid config format");
            }

            // Merge with existing configs (prefer imported)
            const { configData } = get();
            const existingConfigs = configData?.configs || [];

            // Create a map of existing configs by absolute path
            const existingMap = new Map(
                existingConfigs.map((c) => [c.identifiers.absolutePath, c])
            );

            // Merge imported configs
            for (const importedConfig of importedData.configs) {
                existingMap.set(importedConfig.identifiers.absolutePath, importedConfig);
            }

            const newConfigData: FileConfigData = {
                version: importedData.version || 1,
                configs: Array.from(existingMap.values()),
            };

            set({ configData: newConfigData });
            await get().saveConfigs();
        } catch (error: unknown) {
            logger.error("Failed to import configs:", error);
            throw error;
        }
    },

    // Clean up configs for files not seen recently
    cleanupOldConfigs: async (retentionDays?: number) => {
        const { configData, preferences } = get();
        if (!configData) return;

        const days = retentionDays ?? preferences.configRetentionDays;
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);

        const filteredConfigs = configData.configs.filter((config) => {
            const lastSeen = new Date(config.lastSeen);
            return lastSeen >= cutoffDate;
        });

        const removedCount = configData.configs.length - filteredConfigs.length;

        if (removedCount > 0) {
            logger.debug(`Cleaned up ${removedCount} old config(s)`);
            set({
                configData: {
                    ...configData,
                    configs: filteredConfigs,
                },
            });
            await get().saveConfigs();
        }
    },

    // Update preferences
    updatePreferences: (newPreferences: Partial<ConfigPreferences>) => {
        const { preferences } = get();
        set({
            preferences: {
                ...preferences,
                ...newPreferences,
            },
        });
    },
}));
