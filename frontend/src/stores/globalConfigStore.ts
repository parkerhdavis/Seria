/**
 * Global Config Store
 *
 * Manages app-wide configuration and settings that persist across sessions.
 * This is separate from per-file configs (fileConfigStore) and user preferences
 * for UI settings (settingsStore).
 *
 * Stored in: ~/.config/seria/preferences.json (or platform equivalent)
 */

import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

/**
 * Global application configuration
 * Persisted across app sessions
 */
export interface GlobalConfig {
    // Session state
    lastOpenedFile: string | null;  // Absolute path to the last file the user had open
    recentFiles: string[];  // List of recently opened files (max 10)

    // Window state (for future use)
    lastWindowWidth?: number;
    lastWindowHeight?: number;
    lastWindowX?: number;
    lastWindowY?: number;
    wasMaximized?: boolean;

    // App behavior preferences
    autoReopenLastFile: boolean;  // Whether to automatically reopen the last file on startup
    confirmBeforeExit: boolean;  // Show confirmation dialog before closing if file is dirty
}

interface GlobalConfigStore {
    // State
    config: GlobalConfig | null;
    isLoaded: boolean;

    // Actions
    loadConfig: () => Promise<void>;
    saveConfig: () => Promise<void>;
    setLastOpenedFile: (filePath: string | null) => Promise<void>;
    addRecentFile: (filePath: string) => Promise<void>;
    clearRecentFiles: () => Promise<void>;
    updateConfig: (updates: Partial<GlobalConfig>) => Promise<void>;
}

// Default configuration
const DEFAULT_CONFIG: GlobalConfig = {
    lastOpenedFile: null,
    recentFiles: [],
    autoReopenLastFile: true,
    confirmBeforeExit: true,
};

export const useGlobalConfigStore = create<GlobalConfigStore>((set, get) => ({
    // Initial state
    config: null,
    isLoaded: false,

    // Load global config from storage
    loadConfig: async () => {
        try {
            const jsonData = await invoke<string>("load_preferences");
            if (jsonData && jsonData !== "{}") {
                const loadedConfig: GlobalConfig = JSON.parse(jsonData);
                // Merge with defaults to handle new fields
                const config = { ...DEFAULT_CONFIG, ...loadedConfig };
                set({ config, isLoaded: true });
            } else {
                // No existing config, use defaults
                set({ config: DEFAULT_CONFIG, isLoaded: true });
            }
        } catch (error) {
            console.error("Failed to load global config:", error);
            // Fall back to defaults on error
            set({ config: DEFAULT_CONFIG, isLoaded: true });
        }
    },

    // Save global config to storage
    saveConfig: async () => {
        const { config } = get();
        if (!config) return;

        try {
            const jsonData = JSON.stringify(config, null, 2);
            await invoke("save_preferences", { data: jsonData });
        } catch (error) {
            console.error("Failed to save global config:", error);
        }
    },

    // Update the last opened file and save
    setLastOpenedFile: async (filePath: string | null) => {
        const { config } = get();
        if (!config) return;

        const updatedConfig = {
            ...config,
            lastOpenedFile: filePath,
        };

        set({ config: updatedConfig });
        await get().saveConfig();
    },

    // Add a file to the recent files list
    addRecentFile: async (filePath: string) => {
        const { config } = get();
        if (!config) return;

        // Remove the file if it already exists in the list
        const filteredRecent = config.recentFiles.filter((f) => f !== filePath);

        // Add to the front of the list
        const updatedRecent = [filePath, ...filteredRecent];

        // Keep only the 10 most recent files
        const recentFiles = updatedRecent.slice(0, 10);

        const updatedConfig = {
            ...config,
            recentFiles,
        };

        set({ config: updatedConfig });
        await get().saveConfig();
    },

    // Clear the recent files list
    clearRecentFiles: async () => {
        const { config } = get();
        if (!config) return;

        const updatedConfig = {
            ...config,
            recentFiles: [],
        };

        set({ config: updatedConfig });
        await get().saveConfig();
    },

    // Update multiple config fields at once
    updateConfig: async (updates: Partial<GlobalConfig>) => {
        const { config } = get();
        if (!config) return;

        const updatedConfig = {
            ...config,
            ...updates,
        };

        set({ config: updatedConfig });
        await get().saveConfig();
    },
}));
